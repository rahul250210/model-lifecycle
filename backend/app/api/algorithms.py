from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.api.deps import get_db
from app.models.algorithm import Algorithm
from app.models.factory import Factory
from app.models.model import Model
from app.schemas.algorithm import (
    AlgorithmCreate,
    AlgorithmUpdate,
    AlgorithmOut,
)

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
