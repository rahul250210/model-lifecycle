from pydantic import BaseModel
from datetime import datetime

class VersionOut(BaseModel):
    id: int
    model_id: int
    version_number: int
    note: str | None
    is_active: bool
    created_at: datetime
    accuracy: float | None 
    precision: float | None 
    recall: float | None 
    f1_score: float | None 

    class Config:
        from_attributes = True
