from pydantic import BaseModel
from datetime import datetime
from typing import Optional
class FactoryCreate(BaseModel):
    name: str
    description: str | None = None
    created_by_algorithm_id: Optional[int] = None


class FactoryOut(BaseModel):
    id: int
    name: str
    description: str | None
    created_at: datetime
    algorithms_count: int = 0
    models_count: int = 0
    algorithm_names: list[str] = []

    class Config:
        from_attributes = True

class FactoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None