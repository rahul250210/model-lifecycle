from pydantic import BaseModel
from datetime import datetime

class AlgorithmCreate(BaseModel):
    name: str
    description: str | None = None

class AlgorithmOut(BaseModel):
    id: int
    name: str
    description: str | None
    factory_id: int
    created_at: datetime
    models_count: int = 0

    class Config:
        from_attributes = True


class AlgorithmUpdate(BaseModel):
    name: str
    description: str | None = None
