from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.api.deps import get_db
from app.models.model import Model
from app.models.algorithm import Algorithm
from app.models.version import ModelVersion
from app.schemas.model import ModelCreate, ModelOut

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
