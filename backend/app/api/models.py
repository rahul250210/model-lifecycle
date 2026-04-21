from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
import io
import csv
from fastapi.responses import StreamingResponse

from app.api.deps import get_db
from app.models.model import Model
from app.models.algorithm import Algorithm
from app.models.version import ModelVersion
from app.schemas.model import ModelCreate, ModelOut
from app.utils.logger import logger

router = APIRouter()

# ======================================================
# CREATE MODEL
# ======================================================
@router.post(
    "/{factory_id}/algorithms/{algorithm_id}/models",
    response_model=ModelOut,
    status_code=status.HTTP_201_CREATED,
)
def create_model(
    factory_id: int,
    algorithm_id: int,
    model: ModelCreate,
    db: Session = Depends(get_db),
):
    algorithm = (
        db.query(Algorithm)
        .filter(
            Algorithm.id == algorithm_id,
            Algorithm.factory_id == factory_id,
        )
        .first()
    )
    if not algorithm:
        raise HTTPException(404, "Algorithm not found")

    # Prevent duplicate model names
    existing = (
        db.query(Model)
        .filter(
            Model.algorithm_id == algorithm_id,
            func.lower(Model.name) == model.name.lower(),
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Model with this name already exists",
        )

    db_model = Model(
        name=model.name,
        description=model.description,
        algorithm_id=algorithm_id,
    )
    db.add(db_model)
    db.commit()
    db.refresh(db_model)

    logger.info(f"Model created: {db_model.name} (ID: {db_model.id})")

    return db_model


# ======================================================
# LIST MODELS (WITH VERSION COUNT)
# ======================================================
@router.get(
    "/{factory_id}/algorithms/{algorithm_id}/models",
    response_model=list[ModelOut],
)
def list_models(
    factory_id: int,
    algorithm_id: int,
    db: Session = Depends(get_db),
):
    algorithm = (
        db.query(Algorithm)
        .filter(
            Algorithm.id == algorithm_id,
            Algorithm.factory_id == factory_id,
        )
        .first()
    )
    if not algorithm:
        raise HTTPException(404, "Algorithm not found")

    models = (
        db.query(
            Model,
            func.count(ModelVersion.id).label("versions_count"),
        )
        .outerjoin(ModelVersion, ModelVersion.model_id == Model.id)
        .filter(Model.algorithm_id == algorithm_id)
        .group_by(Model.id)
        .order_by(Model.created_at.desc())
        .all()
    )

    results = []
    for model, count in models:
        model.versions_count = count
        results.append(model)

    return results


# ======================================================
# UPDATE MODEL (SAFE EDIT)
# ======================================================
@router.put(
    "/{factory_id}/algorithms/{algorithm_id}/models/{model_id}",
    response_model=ModelOut,
)
def update_model(
    factory_id: int,
    algorithm_id: int,
    model_id: int,
    model: ModelCreate,
    db: Session = Depends(get_db),
):
    db_model = (
        db.query(Model)
        .filter(
            Model.id == model_id,
            Model.algorithm_id == algorithm_id,
        )
        .first()
    )

    if not db_model:
        raise HTTPException(404, "Model not found")

    # Prevent duplicate name (exclude self)
    existing = (
        db.query(Model)
        .filter(
            Model.algorithm_id == algorithm_id,
            func.lower(Model.name) == model.name.lower(),
            Model.id != model_id,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Another model with this name already exists",
        )

    db_model.name = model.name
    db_model.description = model.description

    db.commit()
    db.refresh(db_model)

    logger.info(f"Model updated: {db_model.name} (ID: {db_model.id})")

    return db_model


# ======================================================
# DELETE MODEL (SAFE DELETE)
# ======================================================
@router.delete(
    "/{factory_id}/algorithms/{algorithm_id}/models/{model_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_model(
    factory_id: int,
    algorithm_id: int,
    model_id: int,
    db: Session = Depends(get_db),
):
    model = (
        db.query(Model)
        .filter(
            Model.id == model_id,
            Model.algorithm_id == algorithm_id,
        )
        .first()
    )

    if not model:
        raise HTTPException(404, "Model not found")

    #  BLOCK DELETE IF VERSIONS EXIST
    version_count = (
        db.query(func.count(ModelVersion.id))
        .filter(ModelVersion.model_id == model_id)
        .scalar()
    )

   # delete versions first
    db.query(ModelVersion).filter(
        ModelVersion.model_id == model_id
    ).delete()




    db.delete(model)
    db.commit()
    logger.info(f"Model deleted: {model.name} (ID: {model.id})")


# ======================================================
# GET MODEL BY ID
# ======================================================
@router.get(
    "/{factory_id}/algorithms/{algorithm_id}/models/{model_id}",
    response_model=ModelOut,
)
def get_model(
    factory_id: int,
    algorithm_id: int,
    model_id: int,
    db: Session = Depends(get_db),
):
    model = (
        db.query(Model)
        .filter(
            Model.id == model_id,
            Model.algorithm_id == algorithm_id,
        )
        .first()
    )

    if not model:
        raise HTTPException(404, "Model not found")

    # attach versions_count (for UI consistency)
    model.versions_count = (
        db.query(func.count(ModelVersion.id))
        .filter(ModelVersion.model_id == model_id)
        .scalar()
    )

    return model

# ======================================================
# GENERATE REPORT (CSV)
# ======================================================
@router.get(
    "/{factory_id}/algorithms/{algorithm_id}/models/{model_id}/report",
)
def generate_model_report(
    factory_id: int,
    algorithm_id: int,
    model_id: int,
    db: Session = Depends(get_db),
):
    model = (
        db.query(Model)
        .filter(
            Model.id == model_id,
            Model.algorithm_id == algorithm_id,
        )
        .first()
    )

    if not model:
        raise HTTPException(404, "Model not found")

    versions = (
        db.query(ModelVersion)
        .filter(ModelVersion.model_id == model_id)
        .order_by(ModelVersion.version_number.asc())
        .all()
    )

    stream = io.StringIO()
    csv_writer = csv.writer(stream)
    
    # Header Row
    csv_writer.writerow([
        "Version Number",
        "Created At",
        "Description",
        "Dataset Total Count",
        "Accuracy",
        "Precision",
        "Recall",
        "F1 Score",
        "CPU Utilization (%)",
        "GPU Utilization (%)",
        "Inference Time (ms)",
        "Hyperparameters"
    ])

    for v in versions:
        # Get total dataset count from delta if available
        dataset_count = v.delta.dataset_count if v.delta and v.delta.dataset_count is not None else 0
        
        # Format hyperparameters
        hyperparameters = str(v.parameters) if v.parameters else "None"
        
        # Format created_at to clean string (day-month-year time)
        created_at_str = v.created_at.strftime("%d-%m-%Y %H:%M:%S") if v.created_at else "N/A"

        csv_writer.writerow([
            v.version_number,
            created_at_str,
            v.note or "",
            dataset_count,
            v.accuracy if v.accuracy is not None else "N/A",
            v.precision if v.precision is not None else "N/A",
            v.recall if v.recall is not None else "N/A",
            v.f1_score if v.f1_score is not None else "N/A",
            v.cpu_utilization if v.cpu_utilization is not None else "N/A",
            v.gpu_utilization if v.gpu_utilization is not None else "N/A",
            v.inference_time if v.inference_time is not None else "N/A",
            hyperparameters
        ])

    response = StreamingResponse(
        iter([stream.getvalue()]),
        media_type="text/csv"
    )
    safe_name = model.name.replace(" ", "_").lower()
    response.headers["Content-Disposition"] = f"attachment; filename=model_{safe_name}_report.csv"
    return response
