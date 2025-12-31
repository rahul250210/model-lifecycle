from pydantic import BaseModel

class ArtifactOut(BaseModel):
    id: int
    version_id: int
    name: str
    type: str
    size: int
    checksum: str

    class Config:
        from_attributes = True
