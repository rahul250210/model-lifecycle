from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.api.deps import get_db
from app.models.factory import Factory
from app.models.algorithm import Algorithm
from app.models.model import Model
from app.schemas.factory import FactoryCreate, FactoryOut,FactoryUpdate
from app.utils.logger import logger

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

    logger.info(f"Factory created: {db_factory.name} (ID: {db_factory.id})")

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
    logger.info(f"Factory updated: {factory.name} (ID: {factory.id})")
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
    logger.info(f"Factory deleted: {factory.name} (ID: {factory.id})")
    return {"message": "Factory deleted"}


# ======================================================
# DASHBOARD ENDPOINT
# ======================================================
from app.models.version import ModelVersion
from sqlalchemy import desc

@router.get("/{factory_id}/dashboard")
def get_factory_dashboard(
    factory_id: int,
    db: Session = Depends(get_db),
):
    # 1. Verify Factory Exists
    factory = db.query(Factory).filter(Factory.id == factory_id).first()
    if not factory:
        raise HTTPException(status_code=404, detail="Factory not found")

    # 2. Key Counts (Algorithms, Models, Versions)
    #    We can do this with efficient scalar subqueries or joins
    stats = (
        db.query(
            func.count(func.distinct(Algorithm.id)).label("algo_count"),
            func.count(func.distinct(Model.id)).label("model_count"),
            func.count(func.distinct(ModelVersion.version_number)).label("version_count")
        )
        .select_from(Factory)
        .outerjoin(Algorithm, Algorithm.factory_id == Factory.id)
        .outerjoin(Model, Model.algorithm_id == Algorithm.id)
        .outerjoin(ModelVersion, ModelVersion.model_id == Model.id)
        .filter(Factory.id == factory_id)
        .first()
    )
    
    algo_count, model_count, version_count = stats if stats else (0, 0, 0)

    # 3. Asset Distribution (Models per Algorithm)
    dist_rows = (
        db.query(Algorithm.name, func.count(Model.id).label("val"))
        .join(Model, Model.algorithm_id == Algorithm.id)
        .filter(Algorithm.factory_id == factory_id)
        .group_by(Algorithm.id)
        .all()
    )
    distribution = [{"name": r.name, "value": r.val} for r in dist_rows]

    # 4. Recent Activity (Last 5 Versions)
    recent_rows = (
        db.query(
            ModelVersion.version_number,
            ModelVersion.created_at,
            Model.name.label("model_name"),
            Algorithm.name.label("algo_name"),
            ModelVersion.id.label("version_id"),
            Model.id.label("model_id"),
            Algorithm.id.label("algo_id")
        )
        .join(Model, ModelVersion.model_id == Model.id)
        .join(Algorithm, Model.algorithm_id == Algorithm.id)
        .filter(Algorithm.factory_id == factory_id)
        .order_by(desc(ModelVersion.created_at))
        .limit(5)
        .all()
    )

    recent_activity = [
        {
            "id": r.version_id,
            "version": r.version_number,
            "model_name": r.model_name,
            "algo_name": r.algo_name,
            "created_at": r.created_at,
            "link_ids": {
                "factory_id": factory_id,
                "algo_id": r.algo_id, 
                "model_id": r.model_id,
                "version_id": r.version_id
            }
        }
        for r in recent_rows
    ]

    # 5. Resource Trends (Avg CPU/GPU per Algorithm)
    #    Fetch all versions with resource_metrics in this factory
    #    (Optimization: Limit to last 100 to avoid heavy load, or fetch all if dataset small)
    
    # We fetch a flat list of (AlgoName, ResourceMetrics) and aggregate in Python
    resource_rows = (
        db.query(Algorithm.name, ModelVersion.resource_metrics)
        .join(Model, ModelVersion.model_id == Model.id)
        .join(Algorithm, Model.algorithm_id == Algorithm.id)
        .filter(Algorithm.factory_id == factory_id)
        .filter(ModelVersion.resource_metrics.isnot(None))
        .all()
    )

    # Aggregation Logic
    # Structure: { "AlgoName": { "cpu_sum": 0, "gpu_sum": 0, "count": 0 } }
    algo_resources = {}

    for r in resource_rows:
        algo = r.name
        metrics = r.resource_metrics
        if not metrics: 
            continue
        
        # Extract CPU/GPU (Handling naive strings like "12%" or "4GB" partially)
        # For this demo, let's assume numeric values or simple "%" stripping
        # Current ResourceMetricsInput stores values as STRINGS.
        
        def parse_val(val_str):
            if not val_str: return 0.0
            # Remove common units to try and get a float
            clean = val_str.lower().replace('%','').replace('gb','').replace('mb','').replace('ms','').strip()
            try:
                return float(clean)
            except:
                return 0.0

        # We look for specific keys (as defined in SUGGESTED_KEYS)
        # "cpu_utilization", "gpu_utilization"
        # We find them in the list of metrics objects: [{key: 'cpu_utilization', value: '10', unit: '%'}]
        
        cpu_val = 0.0
        gpu_val = 0.0
        
        # metrics is a LIST of dicts: [{key:..., value:..., unit:...}]
        if isinstance(metrics, list):
            for m in metrics:
                if m.get("key") == "cpu_utilization":
                    cpu_val = parse_val(m.get("value"))
                elif m.get("key") == "gpu_utilization":
                    gpu_val = parse_val(m.get("value"))
        
        if algo not in algo_resources:
            algo_resources[algo] = {"cpu": 0.0, "gpu": 0.0, "count": 0}
        
        algo_resources[algo]["cpu"] += cpu_val
        algo_resources[algo]["gpu"] += gpu_val
        algo_resources[algo]["count"] += 1

    resource_trends = []
    for algo, data in algo_resources.items():
        if data["count"] > 0:
            resource_trends.append({
                "algorithm": algo,
                "avg_cpu": round(data["cpu"] / data["count"], 1),
                "avg_gpu": round(data["gpu"] / data["count"], 1)
            })
    
    # Sort by CPU usage DESC
    resource_trends.sort(key=lambda x: x["avg_cpu"], reverse=True)


    return {
        "stats": {
            "algorithms": algo_count,
            "models": model_count,
            "versions": version_count,
            "avg_inference_time": "N/A" # Placeholder for now
        },
        "distribution": distribution,
        "recent_activity": recent_activity,
        "resource_trends": resource_trends[:5] # Top 5 algorithms
    }
