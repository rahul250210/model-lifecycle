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
def get_dashboard_stats(db: Session = Depends(get_db)):
    """
    Get experimental high-level system vital signs.
    """
    factory_count = db.query(Factory).count()
    algorithm_count = db.query(Algorithm).count()
    model_count = db.query(Model).count()
    active_version_count = db.query(ModelVersion).filter(ModelVersion.is_active == True).count()
    
    # Calculate total storage size from all artifacts
    total_storage_bytes = db.query(func.sum(Artifact.size)).scalar() or 0
    
    return {
        "factories": factory_count,
        "algorithms": algorithm_count,
        "models": model_count,
        "active_versions": active_version_count,
        "total_storage_bytes": total_storage_bytes
    }

@router.get("/recent-activity")
def get_recent_activity(limit: int = 10, db: Session = Depends(get_db)):
    """
    Get a feed of recent system events (Version Created/Updated).
    """
    # Fetch recent versions, joined with Model -> Algorithm -> Factory for context
    # Order by updated_at (which acts as effective modified time)
    recent_versions = (
        db.query(
            ModelVersion.id,
            ModelVersion.version_number,
            ModelVersion.created_at,
            ModelVersion.updated_at,
            Model.name.label("model_name"),
            Algorithm.name.label("algorithm_name"),
            Factory.name.label("factory_name")
        )
        .join(Model, Model.id == ModelVersion.model_id)
        .join(Algorithm, Algorithm.id == Model.algorithm_id)
        .join(Factory, Factory.id == Algorithm.factory_id)
        .order_by(desc(ModelVersion.updated_at))
        .limit(limit)
        .all()
    )

    activity_log = []
    
    for v in recent_versions:
        # Determine if this was a creation or an update
        # If updated_at is significantly different from created_at, it's an update
        # For simplicity, we can format the message based on timestamps or just say "Modified"
        # Ideally, we pass the raw data and let the frontend format it
        
        # We will return the structured object for the frontend to render
        activity_log.append({
            "type": "version_update",
            "timestamp": v.updated_at,
            "version_id": v.id,
            "version_number": v.version_number,
            "model_name": v.model_name,
            "algorithm_name": v.algorithm_name,
            "factory_name": v.factory_name
        })
        
    return activity_log

@router.get("/charts/storage-distribution")
def get_storage_distribution(db: Session = Depends(get_db)):
    """
    Get artifact storage usage grouped by Factory.
    """
    # Query: Factory Name, Sum(Artifact Size)
    # Join Path: Factory -> Algorithm -> Model -> ModelVersion -> Artifact
    
    results = (
        db.query(
            Factory.name,
            func.sum(Artifact.size).label("total_size")
        )
        .join(Algorithm, Algorithm.factory_id == Factory.id)
        .join(Model, Model.algorithm_id == Algorithm.id)
        .join(ModelVersion, ModelVersion.model_id == Model.id)
        .join(Artifact, Artifact.version_id == ModelVersion.id)
        .group_by(Factory.name)
        .order_by(desc("total_size"))
        .limit(10) # Top 10 factories by size
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
        .limit(10) # Top 10 algorithms
        .all()
    )
    
    return [
        {"name": r.name, "value": r.model_count}
        for r in results
    ]

@router.get("/charts/activity-trends")
def get_activity_trends(days: int = 30, db: Session = Depends(get_db)):
    """
    Get version creation/update counts aggregated by day for the last N days.
    """
    cutoff_date = datetime.utcnow() - timedelta(days=days)
    
    # Query 1: Created versions by day
    created_counts = (
        db.query(
            func.date(ModelVersion.created_at).label("day"),
            func.count(ModelVersion.id).label("count")
        )
        .filter(ModelVersion.created_at >= cutoff_date)
        .group_by("day")
        .all()
    )
    
    # Query 2: Updated versions by day (where updated_at is distinct/not null)
    # Note: If it was updated multiple times, we only see the last update time.
    # This is a limitation of not having an audit log, but better than nothing.
    updated_counts = (
        db.query(
            func.date(ModelVersion.updated_at).label("day"),
            func.count(ModelVersion.id).label("count")
        )
        .filter(ModelVersion.updated_at >= cutoff_date)
        .group_by("day")
        .all()
    )
    
    # Merge counts in Python
    activity_map = {}
    
    for r in created_counts:
        d = str(r.day)
        activity_map[d] = activity_map.get(d, 0) + r.count
        
    for r in updated_counts:
        if r.day: # Ensure day is not None
            d = str(r.day)
            activity_map[d] = activity_map.get(d, 0) + r.count
            
    # Convert map to sorted list
    sorted_days = sorted(activity_map.keys())
    
    return [
        {"date": day, "count": activity_map[day]}
        for day in sorted_days
    ]

@router.get("/factory-status")
def get_factory_status(db: Session = Depends(get_db)):
    """
    Get hierarchy of Factory -> Algorithm -> Active Models.
    """
    # 1. Fetch all Factories with their Algorithms
    # We want to ensure we get all factories and algorithms even if no active models.
    # We can do this by querying Algorithms (which have factory_id) and joining Factory.
    # Then distinct Factory/Algorithm. 
    
    # Actually, let's fetch active versions with full context first.
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
        .join(Factory, Factory.id == Algorithm.factory_id)
        .filter(ModelVersion.is_active == True)
        .all()
    )
    
    # Store active models in a dict keyed by algorithm_id
    active_map = {}
    for v in active_versions:
        if v.algorithm_id not in active_map:
            active_map[v.algorithm_id] = []
        active_map[v.algorithm_id].append({
            "model_id": v.model_id,
            "model_name": v.model_name,
            "version_number": v.version_number,
            "updated_at": v.updated_at
        })

    # 2. Fetch all Factories and Algorithms to build the skeleton
    # We want to show even those without active models
    all_algos = (
        db.query(
            Algorithm.id,
            Algorithm.name,
            Factory.id.label("factory_id"),
            Factory.name.label("factory_name")
        )
        .join(Factory, Factory.id == Algorithm.factory_id)
        .order_by(Factory.name, Algorithm.name)
        .all()
    )
    
    # Assemble hierarchy
    status_tree = {}
    
    for row in all_algos:
        fid = row.factory_id
        if fid not in status_tree:
            status_tree[fid] = {
                "factory_id": fid,
                "factory_name": row.factory_name,
                "algorithms": []
            }
            
        # Check for active models
        active_models = active_map.get(row.id, [])
        
        status_tree[fid]["algorithms"].append({
            "algorithm_id": row.id,
            "algorithm_name": row.name,
            "active_models": active_models
        })
        
    return list(status_tree.values())

@router.get("/charts/performance-metrics")
def get_performance_metrics(db: Session = Depends(get_db)):
    """
    Get performance metrics (Accuracy, F1) for all ACTIVE models.
    """
    results = (
        db.query(
            Model.name.label("model_name"),
            ModelVersion.version_number,
            ModelVersion.accuracy,
            ModelVersion.f1_score,
            Algorithm.name.label("algorithm_name")
        )
        .join(Model, Model.id == ModelVersion.model_id)
        .join(Algorithm, Algorithm.id == Model.algorithm_id)
        .filter(ModelVersion.is_active == True)
        .order_by(desc(ModelVersion.accuracy))
        .limit(10) # limit to top 10 to avoid clutter
        .all()
    )
    
    return [
        {
            "name": f"{r.model_name} (v{r.version_number})",
            "accuracy": r.accuracy if r.accuracy is not None else 0,
            "f1_score": r.f1_score if r.f1_score is not None else 0,
            "algorithm": r.algorithm_name
        }
        for r in results
    ]
