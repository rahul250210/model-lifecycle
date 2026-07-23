from sqlalchemy.orm import Session
from sqlalchemy import func
from fastapi import HTTPException
from app.models.algorithm import Algorithm
from app.models.factory import Factory
from app.models.model import Model
from app.models.version import ModelVersion

def resolve_algorithm_id(db: Session, algorithm_id: str | int) -> int:
    if algorithm_id is None:
        raise HTTPException(status_code=400, detail="Algorithm ID is required")
    if isinstance(algorithm_id, int) or (isinstance(algorithm_id, str) and algorithm_id.isdigit()):
        algo = db.query(Algorithm).filter(Algorithm.id == int(algorithm_id)).first()
        if algo:
            return algo.id
    # Lookup by name case-insensitive
    algo = db.query(Algorithm).filter(func.lower(Algorithm.name) == str(algorithm_id).lower()).first()
    if algo:
        return algo.id
    if isinstance(algorithm_id, int) or (isinstance(algorithm_id, str) and algorithm_id.isdigit()):
        return int(algorithm_id)
    raise HTTPException(status_code=404, detail=f"Algorithm '{algorithm_id}' not found")

def resolve_factory_id(db: Session, factory_id: str | int) -> int:
    if factory_id is None:
        raise HTTPException(status_code=400, detail="Factory ID is required")
    if isinstance(factory_id, int) or (isinstance(factory_id, str) and factory_id.isdigit()):
        fac = db.query(Factory).filter(Factory.id == int(factory_id)).first()
        if fac:
            return fac.id
    fac = db.query(Factory).filter(func.lower(Factory.name) == str(factory_id).lower()).first()
    if fac:
        return fac.id
    if isinstance(factory_id, int) or (isinstance(factory_id, str) and factory_id.isdigit()):
        return int(factory_id)
    raise HTTPException(status_code=404, detail=f"Factory '{factory_id}' not found")

def resolve_model_id(db: Session, model_id: str | int, algorithm_id: str | int = None, factory_id: str | int = None) -> int:
    if model_id is None:
        raise HTTPException(status_code=400, detail="Model ID is required")
    if isinstance(model_id, int) or (isinstance(model_id, str) and model_id.isdigit()):
        mod = db.query(Model).filter(Model.id == int(model_id)).first()
        if mod:
            return mod.id

    resolved_algo_id = None
    if algorithm_id is not None:
        try:
            resolved_algo_id = resolve_algorithm_id(db, algorithm_id)
        except Exception:
            pass

    resolved_fac_id = None
    if factory_id is not None:
        try:
            resolved_fac_id = resolve_factory_id(db, factory_id)
        except Exception:
            pass

    query = db.query(Model).filter(func.lower(Model.name) == str(model_id).lower())
    if resolved_algo_id is not None:
        query = query.filter(Model.algorithm_id == resolved_algo_id)
    if resolved_fac_id is not None:
        query = query.filter(Model.factory_id == resolved_fac_id)
    
    mod = query.first()
    if not mod:
        mod = db.query(Model).filter(func.lower(Model.name) == str(model_id).lower()).first()
    if mod:
        return mod.id
    if isinstance(model_id, int) or (isinstance(model_id, str) and model_id.isdigit()):
        return int(model_id)
    raise HTTPException(status_code=404, detail=f"Model '{model_id}' not found")

def resolve_version_id(db: Session, version_id: str | int, model_id: str | int = None) -> int:
    if version_id is None:
        raise HTTPException(status_code=400, detail="Version ID is required")
    if isinstance(version_id, int) or (isinstance(version_id, str) and version_id.isdigit()):
        v = db.query(ModelVersion).filter(ModelVersion.id == int(version_id)).first()
        if v:
            return v.id
        if model_id is not None:
            try:
                resolved_mod_id = resolve_model_id(db, model_id)
                v = db.query(ModelVersion).filter(
                    ModelVersion.model_id == resolved_mod_id,
                    ModelVersion.version_number == int(version_id)
                ).first() 
                if v:
                    return v.id
            except Exception:
                pass
    if isinstance(version_id, int) or (isinstance(version_id, str) and version_id.isdigit()):
        return int(version_id)
    raise HTTPException(status_code=404, detail=f"Version '{version_id}' not found")
