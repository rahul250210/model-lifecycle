from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


# =====================================================
# ALGORITHM KNOWLEDGE REPOSITORY
# =====================================================

class AlgorithmBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    description: Optional[str]=Field(None,max_length=1000)

class AlgorithmCreate(AlgorithmBase):
    """
    Payload when creating a new algorithm knowledge repository
    """
    pass

class AlgorithmUpdate(BaseModel):
      name: Optional[str]
      description: Optional[str]

class AlgorithmOut(AlgorithmBase):
    """
    Returned to frontend for algorithm listing
    """
    id: int
    file_count: int = 0
    created_at: datetime

    class Config:
        from_attributes = True


# =====================================================
# KNOWLEDGE FILES (PDF / PPT / DOC / IMAGE / TEXT)
# =====================================================

class KnowledgeFileBase(BaseModel):
    name: str
    type: str               # pdf, pptx, image, txt, etc
    size: int


class KnowledgeFileOut(KnowledgeFileBase):
    """
    Returned to frontend for file listing
    """
    id: int
    algorithm_id: int
    url: str
    created_at: datetime

    class Config:
        from_attributes = True


# =====================================================
# LIST RESPONSES (OPTIONAL – FUTURE PAGINATION)
# =====================================================

class AlgorithmListOut(BaseModel):
    items: List[AlgorithmOut]


class KnowledgeFileListOut(BaseModel):
    items: List[KnowledgeFileOut]



