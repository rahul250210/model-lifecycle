from pydantic import BaseModel
from datetime import datetime

class AlgorithmCreate(BaseModel):
    name: str
    description: str | None = None

class AlgorithmOut(BaseModel):
    id: int
    name: str
    description: str | None
    created_at: datetime
    models_count: int = 0
    accuracy: float | None = None

    class Config:
        from_attributes = True


class AlgorithmUpdate(BaseModel):
    name: str
    description: str | None = None
