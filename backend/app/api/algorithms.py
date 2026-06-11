from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
import io
import csv
from fastapi.responses import StreamingResponse

from app.api.deps import get_db
from app.models.algorithm import Algorithm
from app.models.factory import Factory
from app.models.model import Model
from app.models.version import ModelVersion
from app.schemas.algorithm import (
    AlgorithmCreate,
    AlgorithmUpdate,
    AlgorithmOut,
)
from app.utils.logger import logger

router = APIRouter()

# ======================================================
# CREATE ALGORITHM (GLOBAL)
# ======================================================
@router.post(
    "/",
    response_model=AlgorithmOut,
    status_code=status.HTTP_201_CREATED,
)
def create_algorithm(
    algorithm: AlgorithmCreate,
    db: Session = Depends(get_db),
):
    existing = (
        db.query(Algorithm)
        .filter(func.lower(Algorithm.name) == algorithm.name.lower())
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Algorithm with this name already exists",
        )

    db_algorithm = Algorithm(
        name=algorithm.name,
        description=algorithm.description,
    )

    db.add(db_algorithm)
    db.commit()
    db.refresh(db_algorithm)

    logger.info(f"Algorithm created: {db_algorithm.name} (ID: {db_algorithm.id})")

    db_algorithm.models_count = 0
    return db_algorithm


# ======================================================
# LIST ALGORITHMS (GLOBAL)
# ======================================================
@router.get(
    "/",
    response_model=list[AlgorithmOut],
)
def list_algorithms(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    rows = (
        db.query(
            Algorithm,
            func.count(Model.id).label("models_count"),
        )
        .outerjoin(Model, Model.algorithm_id == Algorithm.id)
        .group_by(Algorithm.id)
        .order_by(Algorithm.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    results = []
    for algo, count in rows:
        algo.models_count = count
        results.append(algo)

    return results


# ======================================================
# GET SINGLE ALGORITHM
# ======================================================
@router.get(
    "/{algorithm_id}",
    response_model=AlgorithmOut,
)
def get_algorithm(
    algorithm_id: int,
    db: Session = Depends(get_db),
):
    row = (
        db.query(
            Algorithm,
            func.count(Model.id).label("models_count"),
        )
        .outerjoin(Model, Model.algorithm_id == Algorithm.id)
        .filter(Algorithm.id == algorithm_id)
        .group_by(Algorithm.id)
        .first()
    )

    if not row:
        raise HTTPException(404, "Algorithm not found")

    algo, count = row
    algo.models_count = count
    return algo


# ======================================================
# UPDATE ALGORITHM
# ======================================================
@router.put(
    "/{algorithm_id}",
    response_model=AlgorithmOut,
)
def update_algorithm(
    algorithm_id: int,
    payload: AlgorithmUpdate,
    db: Session = Depends(get_db),
):
    algo = db.query(Algorithm).filter(Algorithm.id == algorithm_id).first()

    if not algo:
        raise HTTPException(404, "Algorithm not found")

    # Duplicate name check
    if payload.name and payload.name.lower() != algo.name.lower():
        exists = (
            db.query(Algorithm)
            .filter(
                func.lower(Algorithm.name) == payload.name.lower(),
                Algorithm.id != algorithm_id,
            )
            .first()
        )
        if exists:
            raise HTTPException(
                status_code=400,
                detail="Algorithm with this name already exists",
            )

        algo.name = payload.name

    if payload.description is not None:
        algo.description = payload.description

    db.commit()
    db.refresh(algo)

    logger.info(f"Algorithm updated: {algo.name} (ID: {algo.id})")

    algo.models_count = (
        db.query(func.count(Model.id))
        .filter(Model.algorithm_id == algo.id)
        .scalar()
    )

    return algo


# ======================================================
# DELETE ALGORITHM
# ======================================================
@router.delete(
    "/{algorithm_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_algorithm(
    algorithm_id: int,
    db: Session = Depends(get_db),
):
    algo = db.query(Algorithm).filter(Algorithm.id == algorithm_id).first()

    if not algo:
        raise HTTPException(404, "Algorithm not found")

    db.delete(algo)
    db.commit()
    logger.info(f"Algorithm deleted: {algo.name} (ID: {algo.id})")


# ======================================================
# LIST ALL FACTORIES RUNNING AN ALGORITHM
# ======================================================
@router.get(
    "/{algorithm_id}/factories"
)
def list_factories_for_algorithm(
    algorithm_id: int,
    db: Session = Depends(get_db)
):
    # Verify algorithm exists
    algo = db.query(Algorithm).filter(Algorithm.id == algorithm_id).first()
    if not algo:
        raise HTTPException(404, "Algorithm not found")

    rows = (
        db.query(
            Factory.id,
            Factory.name,
            Factory.description,
            Factory.created_at,
            func.count(Model.id).label("models_count")
        )
        .outerjoin(Model, (Model.factory_id == Factory.id) & (Model.algorithm_id == algorithm_id))
        .filter((Model.id.isnot(None)) | (Factory.created_by_algorithm_id == algorithm_id))
        .group_by(Factory.id)
        .order_by(Factory.name.asc())
        .all()
    )

    return [
        {
            "id": r.id,
            "name": r.name,
            "description": r.description,
            "created_at": r.created_at,
            "models_count": r.models_count,
        }
        for r in rows
    ]


# ======================================================
# LIST ALL VERSIONS UNDER AN ALGORITHM (FOR INHERITANCE)
# ======================================================
@router.get(
    "/{algorithm_id}/versions"
)
def list_all_versions_for_algorithm(
    algorithm_id: int,
    db: Session = Depends(get_db)
):
    rows = (
        db.query(
            ModelVersion.id,
            ModelVersion.version_number,
            ModelVersion.accuracy,
            ModelVersion.precision,
            ModelVersion.recall,
            ModelVersion.f1_score,
            ModelVersion.created_at,
            Model.name.label("model_name"),
            Factory.name.label("factory_name")
        )
        .join(Model, Model.id == ModelVersion.model_id)
        .join(Factory, Factory.id == Model.factory_id)
        .filter(Model.algorithm_id == algorithm_id)
        .order_by(Factory.name, Model.name, ModelVersion.version_number.desc())
        .all()
    )
    return [
        {
            "id": r.id,
            "version_number": r.version_number,
            "accuracy": r.accuracy,
            "precision": r.precision,
            "recall": r.recall,
            "f1_score": r.f1_score,
            "created_at": r.created_at,
            "model_name": r.model_name,
            "factory_name": r.factory_name
        }
        for r in rows
    ]


# ======================================================
# GENERATE REPORT (CSV)
# ======================================================
@router.get(
    "/{algorithm_id}/report",
)
def generate_algorithm_report(
    algorithm_id: int,
    db: Session = Depends(get_db),
):
    algo = db.query(Algorithm).filter(Algorithm.id == algorithm_id).first()

    if not algo:
        raise HTTPException(404, "Algorithm not found")

    models = (
        db.query(Model)
        .options(joinedload(Model.versions).joinedload(ModelVersion.delta), joinedload(Model.factory))
        .filter(Model.algorithm_id == algorithm_id)
        .order_by(Model.name.asc())
        .all()
    )

    stream = io.StringIO()
    csv_writer = csv.writer(stream)
    
    # Header Row
    csv_writer.writerow([
        "Factory Name",
        "Model Name",
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

    for model in models:
        # Sort versions in memory since they are eagerly loaded
        versions = sorted(model.versions, key=lambda v: v.version_number)
        
        for v in versions:
            dataset_count = v.delta.dataset_count if v.delta and v.delta.dataset_count is not None else 0
            hyperparameters = str(v.parameters) if v.parameters else "None"
            created_at_str = v.created_at.strftime("%d-%m-%Y %H:%M:%S") if v.created_at else "N/A"

            csv_writer.writerow([
                model.factory.name if model.factory else "N/A",
                model.name,
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
            
        if versions:
            csv_writer.writerow([])

    response = StreamingResponse(
        iter([stream.getvalue()]),
        media_type="text/csv"
    )
    safe_name = algo.name.replace(" ", "_").lower()
    response.headers["Content-Disposition"] = f"attachment; filename=algorithm_{safe_name}_report.csv"
    return response


# ======================================================
# REMOVE FACTORY FROM ALGORITHM
# ======================================================
@router.delete(
    "/{algorithm_id}/factories/{factory_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def remove_factory_from_algorithm(
    algorithm_id: int,
    factory_id: int,
    db: Session = Depends(get_db),
):
    # Verify algorithm exists
    algo = db.query(Algorithm).filter(Algorithm.id == algorithm_id).first()
    if not algo:
        raise HTTPException(404, "Algorithm not found")

    # Verify factory exists
    factory = db.query(Factory).filter(Factory.id == factory_id).first()
    if not factory:
        raise HTTPException(404, "Factory not found")

    # Get all model IDs for this algorithm at this factory
    model_ids = [m.id for m in db.query(Model.id).filter(
        Model.algorithm_id == algorithm_id,
        Model.factory_id == factory_id
    ).all()]

    if model_ids:
        # Delete model versions first
        db.query(ModelVersion).filter(ModelVersion.model_id.in_(model_ids)).delete(synchronize_session=False)
        # Delete models
        db.query(Model).filter(Model.id.in_(model_ids)).delete(synchronize_session=False)

    # If this factory was created_by_algorithm_id == algorithm_id, set it to None
    if factory.created_by_algorithm_id == algorithm_id:
        factory.created_by_algorithm_id = None

    db.commit()
    logger.info(f"Factory {factory.name} (ID: {factory.id}) removed from algorithm {algo.name} (ID: {algo.id})")

