from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
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
# CREATE ALGORITHM
# ======================================================
@router.post(
    "/{factory_id}/algorithms",
    response_model=AlgorithmOut,
    status_code=status.HTTP_201_CREATED,
)
def create_algorithm(
    factory_id: int,
    algorithm: AlgorithmCreate,
    db: Session = Depends(get_db),
):
    factory = db.query(Factory).filter(Factory.id == factory_id).first()
    if not factory:
        raise HTTPException(404, "Factory not found")

    existing = (
        db.query(Algorithm)
        .filter(
            Algorithm.factory_id == factory_id,
            func.lower(Algorithm.name) == algorithm.name.lower(),
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Algorithm with this name already exists in this factory",
        )

    db_algorithm = Algorithm(
        name=algorithm.name,
        description=algorithm.description,
        factory_id=factory_id,
    )

    db.add(db_algorithm)
    db.commit()
    db.refresh(db_algorithm)

    logger.info(f"Algorithm created: {db_algorithm.name} (ID: {db_algorithm.id})")

    db_algorithm.models_count = 0
    return db_algorithm


# ======================================================
# LIST ALGORITHMS
# ======================================================
@router.get(
    "/{factory_id}/algorithms",
    response_model=list[AlgorithmOut],
)
def list_algorithms(factory_id: int, db: Session = Depends(get_db)):
    factory = db.query(Factory).filter(Factory.id == factory_id).first()
    if not factory:
        raise HTTPException(404, "Factory not found")

    rows = (
        db.query(
            Algorithm,
            func.count(Model.id).label("models_count"),
        )
        .outerjoin(Model, Model.algorithm_id == Algorithm.id)
        .filter(Algorithm.factory_id == factory_id)
        .group_by(Algorithm.id)
        .order_by(Algorithm.created_at.desc())
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
    "/{factory_id}/algorithms/{algorithm_id}",
    response_model=AlgorithmOut,
)
def get_algorithm(
    factory_id: int,
    algorithm_id: int,
    db: Session = Depends(get_db),
):
    row = (
        db.query(
            Algorithm,
            func.count(Model.id).label("models_count"),
        )
        .outerjoin(Model, Model.algorithm_id == Algorithm.id)
        .filter(
            Algorithm.id == algorithm_id,
            Algorithm.factory_id == factory_id,
        )
        .group_by(Algorithm.id)
        .first()
    )

    if not row:
        raise HTTPException(404, "Algorithm not found")

    algo, count = row
    algo.models_count = count
    return algo


# ======================================================
# UPDATE ALGORITHM (FIXED)
# ======================================================
@router.put(
    "/{factory_id}/algorithms/{algorithm_id}",
    response_model=AlgorithmOut,
)
def update_algorithm(
    factory_id: int,
    algorithm_id: int,
    payload: AlgorithmUpdate,
    db: Session = Depends(get_db),
):
    algo = (
        db.query(Algorithm)
        .filter(
            Algorithm.id == algorithm_id,
            Algorithm.factory_id == factory_id,
        )
        .first()
    )

    if not algo:
        raise HTTPException(404, "Algorithm not found")

    # Duplicate name check (only if name is changing)
    if payload.name and payload.name.lower() != algo.name.lower():
        exists = (
            db.query(Algorithm)
            .filter(
                Algorithm.factory_id == factory_id,
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

    # attach models_count
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
    "/{factory_id}/algorithms/{algorithm_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_algorithm(
    factory_id: int,
    algorithm_id: int,
    db: Session = Depends(get_db),
):
    algo = (
        db.query(Algorithm)
        .filter(
            Algorithm.id == algorithm_id,
            Algorithm.factory_id == factory_id,
        )
        .first()
    )

    if not algo:
        raise HTTPException(404, "Algorithm not found")

    db.delete(algo)
    db.commit()
    logger.info(f"Algorithm deleted: {algo.name} (ID: {algo.id})")

# ======================================================
# GENERATE REPORT (CSV)
# ======================================================
@router.get(
    "/{factory_id}/algorithms/{algorithm_id}/report",
)
def generate_algorithm_report(
    factory_id: int,
    algorithm_id: int,
    db: Session = Depends(get_db),
):
    algo = (
        db.query(Algorithm)
        .filter(
            Algorithm.id == algorithm_id,
            Algorithm.factory_id == factory_id,
        )
        .first()
    )

    if not algo:
        raise HTTPException(404, "Algorithm not found")

    models = (
        db.query(Model)
        .filter(Model.algorithm_id == algorithm_id)
        .order_by(Model.name.asc())
        .all()
    )

    stream = io.StringIO()
    csv_writer = csv.writer(stream)
    
    # Header Row
    csv_writer.writerow([
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
        # Fetch versions for this specific model, ordered by version number
        versions = (
            db.query(ModelVersion)
            .filter(ModelVersion.model_id == model.id)
            .order_by(ModelVersion.version_number.asc())
            .all()
        )
        
        for v in versions:
            # Get total dataset count from delta if available
            dataset_count = v.delta.dataset_count if v.delta and v.delta.dataset_count is not None else 0
            
            # Format hyperparameters
            hyperparameters = str(v.parameters) if v.parameters else "None"
            
            # Format created_at to clean string (day-month-year time)
            created_at_str = v.created_at.strftime("%d-%m-%Y %H:%M:%S") if v.created_at else "N/A"

            csv_writer.writerow([
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
            
        # Add a blank row after each model's versions block to separate models clearly
        if versions:
            csv_writer.writerow([])

    response = StreamingResponse(
        iter([stream.getvalue()]),
        media_type="text/csv"
    )
    safe_name = algo.name.replace(" ", "_").lower()
    response.headers["Content-Disposition"] = f"attachment; filename=algorithm_{safe_name}_report.csv"
    return response
