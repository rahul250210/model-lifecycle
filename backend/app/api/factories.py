from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, desc, distinct
import io
import csv
from fastapi.responses import StreamingResponse

from app.api.deps import get_db
from app.models.factory import Factory
from app.models.algorithm import Algorithm
from app.models.model import Model
from app.models.version import ModelVersion, VersionDelta
from app.models.artifact import Artifact
from app.schemas.factory import FactoryCreate, FactoryOut, FactoryUpdate
from app.schemas.algorithm import AlgorithmOut
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
    existing = (
        db.query(Factory)
        .filter(func.lower(Factory.name) == factory.name.lower())
        .first()
    )
    if existing:
        updated = False
        if factory.description:
            existing.description = factory.description
            updated = True
        if factory.created_by_algorithm_id is not None:
            existing.created_by_algorithm_id = factory.created_by_algorithm_id
            updated = True
        
        if updated:
            db.commit()
            db.refresh(existing)
            logger.info(f"Factory updated instead of created: {existing.name} (ID: {existing.id})")
        return existing

    db_factory = Factory(
        name=factory.name,
        description=factory.description,
        created_by_algorithm_id=factory.created_by_algorithm_id,
    )
    db.add(db_factory)
    db.commit()
    db.refresh(db_factory)

    logger.info(f"Factory created: {db_factory.name} (ID: {db_factory.id})")

    return db_factory


# ======================================================
@router.get("/")
def list_factories(
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db)
):
    factories = db.query(Factory).offset(skip).limit(limit).all()

    result = []
    for f in factories:
        # Get all distinct algorithm names and IDs associated with this factory
        algos = (
            db.query(Algorithm.name, Algorithm.id)
            .join(Model, Model.algorithm_id == Algorithm.id)
            .filter(Model.factory_id == f.id)
            .distinct()
            .all()
        )
        algo_names = [a.name for a in algos]
        algo_ids = {a.id for a in algos}
        
        if f.created_by_algorithm_id is not None:
            creator_algo = db.query(Algorithm).filter(Algorithm.id == f.created_by_algorithm_id).first()
            if creator_algo:
                if creator_algo.name not in algo_names:
                    algo_names.append(creator_algo.name)
                algo_ids.add(creator_algo.id)
                
        result.append({
            "id": f.id,
            "name": f.name,
            "description": f.description,
            "algorithms_count": len(algo_ids),
            "models_count": len(f.models),
            "created_at": f.created_at,
            "algorithm_names": algo_names,
        })
    return result


# ======================================================
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
    factory = db.query(Factory).filter(Factory.id == factory_id).first()
    if not factory:
        raise HTTPException(status_code=404, detail="Factory not found")

    algos = (
        db.query(Algorithm.name, Algorithm.id)
        .join(Model, Model.algorithm_id == Algorithm.id)
        .filter(Model.factory_id == factory_id)
        .distinct()
        .all()
    )
    algo_names = [a.name for a in algos]
    algo_ids = {a.id for a in algos}

    if factory.created_by_algorithm_id is not None:
        creator_algo = db.query(Algorithm).filter(Algorithm.id == factory.created_by_algorithm_id).first()
        if creator_algo:
            if creator_algo.name not in algo_names:
                algo_names.append(creator_algo.name)
            algo_ids.add(creator_algo.id)

    factory.algorithms_count = len(algo_ids)
    factory.models_count = len(factory.models)
    factory.algorithm_names = algo_names

    return factory


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
# DELETE FACTORY
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
    stats = (
        db.query(
            func.count(func.distinct(Model.algorithm_id)).label("algo_count"),
            func.count(func.distinct(Model.id)).label("model_count"),
            func.count(func.distinct(ModelVersion.id)).label("version_count")
        )
        .select_from(Factory)
        .outerjoin(Model, Model.factory_id == Factory.id)
        .outerjoin(ModelVersion, ModelVersion.model_id == Model.id)
        .filter(Factory.id == factory_id)
        .first()
    )
    
    algo_count, model_count, version_count = stats if stats else (0, 0, 0)

    # Calculate total storage size for all artifacts in this factory
    total_storage = (
        db.query(func.sum(Artifact.size))
        .join(ModelVersion, Artifact.version_id == ModelVersion.id)
        .join(Model, ModelVersion.model_id == Model.id)
        .filter(Model.factory_id == factory_id)
        .scalar() or 0
    )

    # 3. Asset Distribution (Models per Algorithm)
    dist_rows = (
        db.query(Algorithm.name, func.count(Model.id).label("val"))
        .join(Model, Model.algorithm_id == Algorithm.id)
        .filter(Model.factory_id == factory_id)
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
        .filter(Model.factory_id == factory_id)
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
    resource_rows = (
        db.query(Algorithm.name, ModelVersion.resource_metrics)
        .join(Model, ModelVersion.model_id == Model.id)
        .join(Algorithm, Model.algorithm_id == Algorithm.id)
        .filter(Model.factory_id == factory_id)
        .filter(ModelVersion.resource_metrics.isnot(None))
        .all()
    )

    algo_resources = {}

    for r in resource_rows:
        algo = r.name
        metrics = r.resource_metrics
        if not metrics: 
            continue
        
        def parse_val(val_str):
            if not val_str: return 0.0
            clean = val_str.lower().replace('%','').replace('gb','').replace('mb','').replace('ms','').strip()
            try:
                return float(clean)
            except:
                return 0.0
        
        cpu_val = 0.0
        gpu_val = 0.0
        
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
    resource_trends.sort(key=lambda x: x["avg_cpu"], reverse=True)

    # Calculate performance vs size quadrant data
    quadrant_rows = (
        db.query(
            ModelVersion.id.label("version_id"),
            ModelVersion.version_number,
            ModelVersion.accuracy,
            ModelVersion.is_active,
            ModelVersion.cpu_utilization,
            ModelVersion.gpu_utilization,
            Model.name.label("model_name"),
            Algorithm.name.label("algorithm_name"),
            func.sum(Artifact.size).label("total_size")
        )
        .join(Model, Model.id == ModelVersion.model_id)
        .join(Algorithm, Algorithm.id == Model.algorithm_id)
        .outerjoin(Artifact, Artifact.version_id == ModelVersion.id)
        .filter(Model.factory_id == factory_id)
        .filter(ModelVersion.accuracy.isnot(None))
        .group_by(ModelVersion.id, Model.id, Algorithm.id)
        .all()
    )

    quadrant_data = [
        {
            "version_id": r.version_id,
            "version_number": r.version_number,
            "accuracy": r.accuracy,
            "is_active": r.is_active,
            "model_name": r.model_name,
            "algorithm_name": r.algorithm_name,
            "size_bytes": r.total_size or 0,
            "cpu_utilization": r.cpu_utilization,
            "gpu_utilization": r.gpu_utilization
        }
        for r in quadrant_rows
    ]

    return {
        "stats": {
            "algorithms": algo_count,
            "models": model_count,
            "versions": version_count,
            "total_storage_bytes": total_storage
        },
        "distribution": distribution,
        "recent_activity": recent_activity,
        "resource_trends": resource_trends[:5],
        "quadrant_data": quadrant_data
    }


# ======================================================
# GENERATE FACTORY REPORT (CSV)
# ======================================================
@router.get("/{factory_id}/report")
def generate_factory_report(
    factory_id: int,
    db: Session = Depends(get_db),
):
    factory = db.query(Factory).filter(Factory.id == factory_id).first()
    if not factory:
        raise HTTPException(404, "Factory not found")

    models = (
        db.query(Model)
        .options(
            joinedload(Model.algorithm),
            joinedload(Model.versions).joinedload(ModelVersion.delta)
        )
        .filter(Model.factory_id == factory_id)
        .order_by(Model.name.asc())
        .all()
    )

    stream = io.StringIO()
    writer = csv.writer(stream)

    # Header
    writer.writerow([
        "Model Name",
        "Algorithm Name",
        "Version",
        "Status",
        "Created At",
        "Description",
        "Dataset Count",
        "Accuracy",
        "Precision",
        "Recall",
        "F1 Score",
        "CPU Utilization (%)",
        "GPU Utilization (%)",
        "Inference Time (ms)",
        "Hyperparameters",
    ])

    for model in models:
        versions = sorted(model.versions, key=lambda v: v.version_number)

        if not versions:
            writer.writerow([model.name, model.algorithm.name if model.algorithm else "N/A", "N/A", "N/A", "N/A", "N/A", "N/A", "N/A", "N/A", "N/A", "N/A", "N/A", "N/A", "N/A", "N/A"])
            continue

        for v in versions:
            dataset_count = v.delta.dataset_count if v.delta and v.delta.dataset_count is not None else 0
            hyperparams = str(v.parameters) if v.parameters else "None"
            created_str = v.created_at.strftime("%d-%m-%Y %H:%M:%S") if v.created_at else "N/A"
            status_label = "Active" if v.is_active else "Inactive"

            writer.writerow([
                model.name,
                model.algorithm.name if model.algorithm else "N/A",
                f"v{v.version_number}",
                status_label,
                created_str,
                v.note or "",
                dataset_count,
                v.accuracy if v.accuracy is not None else "N/A",
                v.precision if v.precision is not None else "N/A",
                v.recall if v.recall is not None else "N/A",
                v.f1_score if v.f1_score is not None else "N/A",
                v.cpu_utilization if v.cpu_utilization is not None else "N/A",
                v.gpu_utilization if v.gpu_utilization is not None else "N/A",
                v.inference_time if v.inference_time is not None else "N/A",
                hyperparams,
            ])

        writer.writerow([])

    csv_output = "\ufeff" + stream.getvalue()
    response = StreamingResponse(iter([csv_output]), media_type="text/csv; charset=utf-8")
    safe_name = factory.name.replace(" ", "_").lower()
    response.headers["Content-Disposition"] = f"attachment; filename=factory_{safe_name}_report.csv"
    return response


# ======================================================
# LIST ALGORITHMS IN FACTORY
# ======================================================
@router.get(
    "/{factory_id}/algorithms",
    response_model=list[AlgorithmOut],
)
def list_algorithms_for_factory(
    factory_id: int,
    db: Session = Depends(get_db)
):
    factory = db.query(Factory).filter(Factory.id == factory_id).first()
    if not factory:
        raise HTTPException(404, "Factory not found")

    rows = (
        db.query(
            Algorithm,
            func.count(Model.id).label("models_count")
        )
        .join(Model, Model.algorithm_id == Algorithm.id)
        .filter(Model.factory_id == factory_id)
        .group_by(Algorithm.id)
        .order_by(Algorithm.created_at.desc())
        .all()
    )

    results = []
    seen_ids = set()
    for algo, count in rows:
        seen_ids.add(algo.id)
        # Get max accuracy of active versions
        best_active = (
            db.query(func.max(ModelVersion.accuracy))
            .join(Model, ModelVersion.model_id == Model.id)
            .filter(
                Model.algorithm_id == algo.id,
                Model.factory_id == factory_id,
                ModelVersion.is_active == True
            )
            .scalar()
        )
        
        # If None, get max accuracy of any version
        if best_active is None:
            best_active = (
                db.query(func.max(ModelVersion.accuracy))
                .join(Model, ModelVersion.model_id == Model.id)
                .filter(
                    Model.algorithm_id == algo.id,
                    Model.factory_id == factory_id
                )
                .scalar()
            )
            
        algo.models_count = count
        algo.accuracy = best_active
        results.append(algo)

    # Also include the creator algorithm if not already listed
    if factory.created_by_algorithm_id is not None and factory.created_by_algorithm_id not in seen_ids:
        creator_algo = db.query(Algorithm).filter(Algorithm.id == factory.created_by_algorithm_id).first()
        if creator_algo:
            creator_algo.models_count = 0
            creator_algo.accuracy = None
            results.append(creator_algo)

    return results

