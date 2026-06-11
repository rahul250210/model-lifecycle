from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, distinct
from datetime import datetime, timedelta

from app.api.deps import get_db
from app.models.factory import Factory
from app.models.algorithm import Algorithm
from app.models.model import Model
from app.models.version import ModelVersion
from app.models.artifact import Artifact

router = APIRouter()

@router.get("/stats")
def get_dashboard_stats(factory_name: Optional[str] = None, db: Session = Depends(get_db)):
    """
    Get experimental high-level system vital signs.
    """
    if factory_name:
        factory = db.query(Factory).filter(Factory.name == factory_name).first()
        if not factory:
            return {
                "factories": 0, "algorithms": 0, "models": 0, "active_versions": 0, "total_storage_bytes": 0, "latest_deployment": None
            }
        
        algorithm_count = (
            db.query(func.count(func.distinct(Model.algorithm_id)))
            .filter(Model.factory_id == factory.id)
            .scalar() or 0
        )
        
        model_count = (
            db.query(Model)
            .filter(Model.factory_id == factory.id)
            .count()
        )
        
        active_version_count = (
            db.query(ModelVersion)
            .join(Model, ModelVersion.model_id == Model.id)
            .filter(ModelVersion.is_active == True, Model.factory_id == factory.id)
            .count()
        )
        
        total_storage_bytes = (
            db.query(func.sum(Artifact.size))
            .join(ModelVersion, Artifact.version_id == ModelVersion.id)
            .join(Model, ModelVersion.model_id == Model.id)
            .filter(Model.factory_id == factory.id)
            .scalar() or 0
        )
        
        stats = {
            "factories": 1,
            "algorithms": algorithm_count,
            "models": model_count,
            "active_versions": active_version_count,
            "total_storage_bytes": total_storage_bytes
        }
    else:
        factory_count = db.query(Factory).count()
        algorithm_count = db.query(Algorithm).count()
        model_count = db.query(Model).count()
        active_version_count = db.query(ModelVersion).filter(ModelVersion.is_active == True).count()
        total_storage_bytes = db.query(func.sum(Artifact.size)).scalar() or 0
        
        stats = {
            "factories": factory_count,
            "algorithms": algorithm_count,
            "models": model_count,
            "active_versions": active_version_count,
            "total_storage_bytes": total_storage_bytes
        }

    # Query latest active deployment matching the factory filter
    latest_q = (
        db.query(
            ModelVersion.version_number,
            ModelVersion.updated_at,
            ModelVersion.created_at,
            ModelVersion.accuracy,
            ModelVersion.f1_score,
            ModelVersion.inference_time,
            ModelVersion.gpu_utilization,
            ModelVersion.cpu_utilization,
            Model.name.label("model_name"),
            Algorithm.name.label("algorithm_name"),
            Factory.name.label("factory_name")
        )
        .join(Model, Model.id == ModelVersion.model_id)
        .join(Algorithm, Algorithm.id == Model.algorithm_id)
        .join(Factory, Factory.id == Model.factory_id)
        .filter(ModelVersion.is_active == True)
    )
    if factory_name:
        latest_q = latest_q.filter(Factory.name == factory_name)
        
    latest_v = latest_q.order_by(desc(ModelVersion.updated_at)).first()
    
    stats["latest_deployment"] = None
    if latest_v:
        stats["latest_deployment"] = {
            "version_number": latest_v.version_number,
            "updated_at": latest_v.updated_at or latest_v.created_at,
            "accuracy": latest_v.accuracy,
            "f1_score": latest_v.f1_score,
            "inference_time": latest_v.inference_time,
            "gpu_utilization": latest_v.gpu_utilization,
            "cpu_utilization": latest_v.cpu_utilization,
            "model_name": latest_v.model_name,
            "algorithm_name": latest_v.algorithm_name,
            "factory_name": latest_v.factory_name
        }
        
    return stats

@router.get("/recent-activity")
def get_recent_activity(factory_name: Optional[str] = None, limit: int = 10, db: Session = Depends(get_db)):
    """
    Get a feed of recent system events (Versions & Factories).
    """
    v_query = (
        db.query(
            ModelVersion.id,
            ModelVersion.version_number,
            ModelVersion.created_at,
            ModelVersion.updated_at,
            Model.id.label("model_id"),
            Model.name.label("model_name"),
            Algorithm.id.label("algorithm_id"),
            Algorithm.name.label("algorithm_name"),
            Factory.id.label("factory_id"),
            Factory.name.label("factory_name")
        )
        .join(Model, Model.id == ModelVersion.model_id)
        .join(Algorithm, Algorithm.id == Model.algorithm_id)
        .join(Factory, Factory.id == Model.factory_id)
    )
    if factory_name:
        v_query = v_query.filter(Factory.name == factory_name)
    recent_versions = v_query.order_by(desc(ModelVersion.updated_at)).limit(limit).all()

    recent_factories = []
    if not factory_name:
        recent_factories = (
            db.query(Factory)
            .order_by(desc(Factory.created_at))
            .limit(limit)
            .all()
        )
    else:
        recent_factories = (
            db.query(Factory)
            .filter(Factory.name == factory_name)
            .all()
        )

    activity_log = []
    
    # Add version events
    for v in recent_versions:
        activity_log.append({
            "type": "version_event",
            "timestamp": v.updated_at or v.created_at or datetime.utcnow(),
            "created_at": v.created_at or datetime.utcnow(),
            "version_id": v.id,
            "version_number": v.version_number,
            "model_name": v.model_name,
            "algorithm_name": v.algorithm_name,
            "factory_name": v.factory_name,
            "model_id": v.model_id,
            "algorithm_id": v.algorithm_id,
            "factory_id": v.factory_id
        })
        
    # Add factory events
    for f in recent_factories:
        activity_log.append({
            "type": "factory_event",
            "timestamp": f.created_at or datetime.utcnow(),
            "created_at": f.created_at or datetime.utcnow(),
            "factory_name": f.name,
            "factory_id": f.id
        })
        
    # Sort chronologically (newest first)
    activity_log.sort(key=lambda x: x["timestamp"], reverse=True)
    
    return activity_log[:limit]

@router.get("/charts/storage-distribution")
def get_storage_distribution(factory_name: Optional[str] = None, db: Session = Depends(get_db)):
    """
    Get artifact storage usage grouped by Factory (or by Algorithm if a factory is selected).
    """
    if factory_name:
        # Group by Algorithm name for the selected factory
        results = (
            db.query(
                Algorithm.name,
                func.sum(Artifact.size).label("total_size")
            )
            .join(Model, Model.algorithm_id == Algorithm.id)
            .join(ModelVersion, ModelVersion.model_id == Model.id)
            .join(Artifact, Artifact.version_id == ModelVersion.id)
            .join(Factory, Factory.id == Model.factory_id)
            .filter(Factory.name == factory_name)
            .group_by(Algorithm.name)
            .order_by(desc("total_size"))
            .limit(10)
            .all()
        )
    else:
        # Group by Factory name (default)
        results = (
            db.query(
                Factory.name,
                func.sum(Artifact.size).label("total_size")
            )
            .join(Model, Model.factory_id == Factory.id)
            .join(ModelVersion, ModelVersion.model_id == Model.id)
            .join(Artifact, Artifact.version_id == ModelVersion.id)
            .group_by(Factory.name)
            .order_by(desc("total_size"))
            .limit(10)
            .all()
        )
    
    return [
        {"name": r.name, "value": r.total_size or 0}
        for r in results
    ]

@router.get("/charts/model-distribution")
def get_model_distribution(db: Session = Depends(get_db)):
    """
    Get distribution of Models by Algorithm type.
    """
    results = (
        db.query(
            Algorithm.name,
            func.count(Model.id).label("model_count")
        )
        .join(Model, Model.algorithm_id == Algorithm.id)
        .group_by(Algorithm.name)
        .order_by(desc("model_count"))
        .limit(10)
        .all()
    )
    
    return [
        {"name": r.name, "value": r.model_count}
        for r in results
    ]

@router.get("/charts/activity-trends")
def get_activity_trends(days: int = 30, factory_name: Optional[str] = None, db: Session = Depends(get_db)):
    """
    Get version creation/update counts aggregated by day for the last N days.
    """
    cutoff_date = datetime.utcnow() - timedelta(days=days)
    
    created_query = (
        db.query(
            func.date(ModelVersion.created_at).label("day"),
            func.count(ModelVersion.id).label("count")
        )
        .filter(ModelVersion.created_at >= cutoff_date)
    )
    
    updated_query = (
        db.query(
            func.date(ModelVersion.updated_at).label("day"),
            func.count(ModelVersion.id).label("count")
        )
        .filter(ModelVersion.updated_at >= cutoff_date)
    )
    
    if factory_name:
        created_query = (
            created_query
            .join(Model, Model.id == ModelVersion.model_id)
            .join(Factory, Factory.id == Model.factory_id)
            .filter(Factory.name == factory_name)
        )
        updated_query = (
            updated_query
            .join(Model, Model.id == ModelVersion.model_id)
            .join(Factory, Factory.id == Model.factory_id)
            .filter(Factory.name == factory_name)
        )
        
    created_counts = created_query.group_by("day").all()
    updated_counts = updated_query.group_by("day").all()
    
    activity_map = {}
    
    for r in created_counts:
        d = str(r.day)
        activity_map[d] = activity_map.get(d, 0) + r.count
        
    for r in updated_counts:
        if r.day:
            d = str(r.day)
            activity_map[d] = activity_map.get(d, 0) + r.count
            
    sorted_days = sorted(activity_map.keys())
    
    return [
        {"date": day, "count": activity_map[day]}
        for day in sorted_days
    ]

@router.get("/charts/performance-trends")
def get_performance_trends(factory_name: Optional[str] = None, db: Session = Depends(get_db)):
    """
    Get performance (accuracy) trends across model versions.
    """
    query = (
        db.query(
            Model.name.label("model_name"),
            ModelVersion.version_number,
            ModelVersion.accuracy,
            ModelVersion.created_at,
            Algorithm.name.label("algorithm_name"),
            Factory.name.label("factory_name")
        )
        .join(Model, Model.id == ModelVersion.model_id)
        .join(Algorithm, Algorithm.id == Model.algorithm_id)
        .join(Factory, Factory.id == Model.factory_id)
    )
    if factory_name:
        query = query.filter(Factory.name == factory_name)
        
    results = query.order_by(Model.name, ModelVersion.version_number.asc()).all()
    
    models_map = {}
    for r in results:
        if r.accuracy is not None:
            fq_name = f"{r.model_name} ({r.algorithm_name.strip()}) @ {r.factory_name.strip()}"
            if fq_name not in models_map:
                models_map[fq_name] = []
            models_map[fq_name].append(r.accuracy)
            
    max_versions = max([len(accs) for accs in models_map.values()]) if models_map else 0
    
    chart_data = []
    for idx in range(max_versions):
        point = {"version": f"v{idx + 1}"}
        for fq_name, accs in models_map.items():
            if idx < len(accs):
                point[fq_name] = accs[idx]
        chart_data.append(point)
        
    return {
        "chartData": chart_data,
        "modelNames": list(models_map.keys())
    }

@router.get("/factory-status")
def get_factory_status(db: Session = Depends(get_db)):
    """
    Get hierarchy of Factory -> Algorithm -> Active Models.
    """
    active_versions = (
        db.query(
            ModelVersion.version_number,
            ModelVersion.updated_at,
            Model.id.label("model_id"),
            Model.name.label("model_name"),
            Algorithm.id.label("algorithm_id"),
            Algorithm.name.label("algorithm_name"),
            Factory.id.label("factory_id"),
            Factory.name.label("factory_name")
        )
        .join(Model, Model.id == ModelVersion.model_id)
        .join(Algorithm, Algorithm.id == Model.algorithm_id)
        .join(Factory, Factory.id == Model.factory_id)
        .filter(ModelVersion.is_active == True)
        .all()
    )
    
    active_map = {}
    for v in active_versions:
        # Group active models by factory and algorithm
        key = (v.factory_id, v.algorithm_id)
        if key not in active_map:
            active_map[key] = []
        active_map[key].append({
            "model_id": v.model_id,
            "model_name": v.model_name,
            "version_number": v.version_number,
            "updated_at": v.updated_at
        })

    # Query all models to build factory-algorithm associations
    all_models = (
        db.query(
            Model.id.label("model_id"),
            Model.name.label("model_name"),
            Algorithm.id.label("algorithm_id"),
            Algorithm.name.label("algorithm_name"),
            Factory.id.label("factory_id"),
            Factory.name.label("factory_name")
        )
        .join(Algorithm, Algorithm.id == Model.algorithm_id)
        .join(Factory, Factory.id == Model.factory_id)
        .order_by(Factory.name, Algorithm.name, Model.name)
        .all()
    )
    
    status_tree = {}
    
    for row in all_models:
        fid = row.factory_id
        if fid not in status_tree:
            status_tree[fid] = {
                "factory_id": fid,
                "factory_name": row.factory_name,
                "algorithms": []
            }
            
        # Check if algorithm is already added to this factory
        algo_node = next((a for a in status_tree[fid]["algorithms"] if a["algorithm_id"] == row.algorithm_id), None)
        if not algo_node:
            active_models = active_map.get((fid, row.algorithm_id), [])
            algo_node = {
                "algorithm_id": row.algorithm_id,
                "algorithm_name": row.algorithm_name,
                "active_models": active_models
            }
            status_tree[fid]["algorithms"].append(algo_node)
            
    # Also fetch factories with no models to display empty states
    empty_factories = db.query(Factory).filter(~Factory.models.any()).all()
    for f in empty_factories:
        if f.id not in status_tree:
            status_tree[f.id] = {
                "factory_id": f.id,
                "factory_name": f.name,
                "algorithms": []
            }
        
    return list(status_tree.values())

@router.get("/charts/performance-metrics")
def get_performance_metrics(factory_name: Optional[str] = None, db: Session = Depends(get_db)):
    """
    Get performance metrics (Accuracy, F1) for all ACTIVE models.
    """
    query = (
        db.query(
            Model.name.label("model_name"),
            ModelVersion.version_number,
            ModelVersion.accuracy,
            ModelVersion.f1_score,
            Algorithm.name.label("algorithm_name")
        )
        .join(Model, Model.id == ModelVersion.model_id)
        .join(Algorithm, Algorithm.id == Model.algorithm_id)
        .join(Factory, Factory.id == Model.factory_id)
        .filter(ModelVersion.is_active == True)
    )
    if factory_name:
        query = query.filter(Factory.name == factory_name)
        
    results = query.order_by(desc(ModelVersion.accuracy)).limit(10).all()
    
    return [
        {
            "name": f"{r.model_name} (v{r.version_number})",
            "accuracy": r.accuracy if r.accuracy is not None else 0,
            "f1_score": r.f1_score if r.f1_score is not None else 0,
            "algorithm": r.algorithm_name
        }
        for r in results
    ]

@router.get("/comparison-hierarchy")
def get_comparison_hierarchy(db: Session = Depends(get_db)):
    """
    Get hierarchy of Algorithm -> Factory -> Model -> Versions for the Compare launcher.
    """
    algorithms = db.query(Algorithm).order_by(Algorithm.name).all()
    
    hierarchy = []
    for algo in algorithms:
        algo_data = {
            "algorithm_id": algo.id,
            "algorithm_name": algo.name,
            "factories": []
        }
        # Find factories running models for this algorithm
        factories_in_algo = (
            db.query(Factory)
            .join(Model, Model.factory_id == Factory.id)
            .filter(Model.algorithm_id == algo.id)
            .distinct()
            .order_by(Factory.name)
            .all()
        )
        for f in factories_in_algo:
            f_data = {
                "factory_id": f.id,
                "factory_name": f.name,
                "models": []
            }
            models = (
                db.query(Model)
                .filter(Model.algorithm_id == algo.id, Model.factory_id == f.id)
                .order_by(Model.name)
                .all()
            )
            for model in models:
                model_data = {
                    "model_id": model.id,
                    "model_name": model.name,
                    "versions": [
                        {"version_id": v.id, "version_number": v.version_number}
                        for v in sorted(model.versions, key=lambda x: x.version_number)
                    ]
                }
                if model_data["versions"]:
                    f_data["models"].append(model_data)
            if f_data["models"]:
                algo_data["factories"].append(f_data)
        if algo_data["factories"]:
            hierarchy.append(algo_data)
            
    return hierarchy
