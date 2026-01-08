from pydantic import BaseModel
from datetime import datetime
from typing import Optional,Dict,Any
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
    parameters: Dict[str, Any] | None = None 

    class Config:
        from_attributes = True
