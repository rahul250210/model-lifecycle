from pydantic import BaseModel
from datetime import datetime

class ExperimentCreate(BaseModel):
    name: str
    description: str | None = None

class ExperimentOut(BaseModel):
    id: int
    name: str
    description: str | None
    model_id: int
    created_at: datetime
    runs_count: int = 0

    class Config:
        from_attributes = True


class RunCreate(BaseModel):
    run_name: str
    params: dict = {}
    metrics: dict = {}

class RunOut(BaseModel):
    id: int
    experiment_id: int
    run_name: str
    status: str
    params: dict
    metrics: dict
    model_version_id: int | None
    started_at: datetime
    finished_at: datetime | None

    class Config:
        from_attributes = True
