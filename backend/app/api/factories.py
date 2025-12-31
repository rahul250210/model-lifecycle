from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.api.deps import get_db
from app.models.factory import Factory
from app.models.algorithm import Algorithm
from app.models.model import Model
from app.schemas.factory import FactoryCreate, FactoryOut,FactoryUpdate

router = APIRouter()

# ======================================================
# CREATE FACTORY
# ======================================================
@router.post(
    "/",
    response_model=FactoryOut,
    status_code=status.HTTP_201_CREATED,
)
def create_factory(
    factory: FactoryCreate,
    db: Session = Depends(get_db),
):
    # Check duplicate factory name
    existing = (
        db.query(Factory)
        .filter(func.lower(Factory.name) == factory.name.lower())
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Factory with this name already exists",
        )

    db_factory = Factory(
        name=factory.name,
        description=factory.description,
    )
    db.add(db_factory)
    db.commit()
    db.refresh(db_factory)

    return db_factory


# ======================================================
# LIST ALL FACTORIES (WITH COUNTS)
# ======================================================


@router.get("/")
def list_factories(db: Session = Depends(get_db)):
    rows = (
        db.query(
            Factory.id,
            Factory.name,
            Factory.description,
            Factory.created_at,
            func.count(func.distinct(Algorithm.id)).label("algorithms_count"),
            func.count(func.distinct(Model.id)).label("models_count"),
        )
        .outerjoin(Algorithm, Algorithm.factory_id == Factory.id)
        .outerjoin(Model, Model.algorithm_id == Algorithm.id)  # ✅ CORRECT
        .group_by(Factory.id)
        .all()
    )

    return [
        {
            "id": r.id,
            "name": r.name,
            "description": r.description,
            "algorithms_count": r.algorithms_count,
            "models_count": r.models_count,
            "created_at": r.created_at,
        }
        for r in rows
    
    ]
# GET FACTORY BY ID (WITH COUNTS)
# ======================================================
@router.get(
    "/{factory_id}",
    response_model=FactoryOut,
)
def get_factory(
    factory_id: int,
    db: Session = Depends(get_db),
):
    factory = (
        db.query(
            Factory,
            func.count(Algorithm.id).label("algorithms_count"),
            func.count(Model.id).label("models_count"),
        )
        .outerjoin(Algorithm, Algorithm.factory_id == Factory.id)
        .outerjoin(Model, Model.algorithm_id == Algorithm.id)
        .filter(Factory.id == factory_id)
        .group_by(Factory.id)
        .first()
    )

    if not factory:
        raise HTTPException(
            status_code=404,
            detail="Factory not found",
        )

    factory_obj, algo_count, model_count = factory
    factory_obj.algorithms_count = algo_count
    factory_obj.models_count = model_count

    return factory_obj


# ======================================================
# UPDATE FACTORY
# ======================================================
@router.put("/{factory_id}")
def update_factory(
    factory_id: int,
    payload: FactoryUpdate,
    db: Session = Depends(get_db),
):
    factory = db.query(Factory).get(factory_id)
    if not factory:
        raise HTTPException(status_code=404, detail="Factory not found")

    if payload.name is not None:
        factory.name = payload.name
    if payload.description is not None:
        factory.description = payload.description

    db.commit()
    db.refresh(factory)
    return factory

# ======================================================
# DELETE FACTORY (CASCADE SAFE)
# ======================================================
@router.delete("/{factory_id}")
def delete_factory(
    factory_id: int,
    db: Session = Depends(get_db)
):
    factory = db.query(Factory).get(factory_id)
    if not factory:
        raise HTTPException(status_code=404, detail="Factory not found")

    db.delete(factory)
    db.commit()
    return {"message": "Factory deleted"}
