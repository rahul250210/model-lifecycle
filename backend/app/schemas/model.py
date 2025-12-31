from pydantic import BaseModel
from datetime import datetime

class ModelCreate(BaseModel):
    name: str
    description: str | None = None

class ModelOut(BaseModel):
    id: int
    name: str
    description: str | None
    algorithm_id: int
    created_at: datetime
    versions_count: int = 0

    class Config:
        from_attributes = True
