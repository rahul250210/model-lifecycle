from pydantic import BaseModel, field_validator
from datetime import datetime
from typing import Optional,Dict,Any


class VersionDeltaOut(BaseModel):
    total_count: int | None
    new_count: int | None
    reused_count: int | None
    removed_count: int | None
    unchanged_count: int | None
    dataset_count: int | None   
    label_count: int | None  
    dataset_new: int | None
    dataset_reused: int | None
    dataset_removed: int | None

    label_new: int | None
    label_reused: int | None
    label_removed: int | None
    
    class Config:
        from_attributes = True

class VersionOut(BaseModel):
    id: int
    model_id: int
    version_number: int
    note: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime | None
    accuracy: float | None 
    precision: float | None 
    recall: float | None 
    f1_score: float | None 
    
    cpu_utilization: float | None
    gpu_utilization: float | None
    inference_time: float | None
    cpu_memory_usage: float | None
    gpu_memory_usage: float | None
    cameras_supported: int | None

    
    tp: int | None
    tn: int | None
    fp: int | None
    fn: int | None

    parameters: Dict[str, Any] | None = None 
    resource_metrics: Dict[str, Any] | None = None 
    delta: VersionDeltaOut | None = None 

    @field_validator("accuracy", "precision", "recall", "f1_score", mode="before")
    @classmethod
    def validate_metrics(cls, v):
        if v is not None and not (0.0 <= float(v) <= 100.0):
            raise ValueError("Metric must be between 0 and 100")
        return v

    class Config:
        from_attributes = True
