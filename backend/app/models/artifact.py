from sqlalchemy import Column, Integer, String, ForeignKey
from app.database import Base
from sqlalchemy.orm import relationship

class Artifact(Base):
    __tablename__ = "artifacts"

    id = Column(Integer, primary_key=True, index=True)
    version_id = Column(Integer, ForeignKey("model_versions.id", ondelete="CASCADE"))
    name = Column(String)
    type = Column(String)
    path = Column(String)
    size = Column(Integer)
    checksum = Column(String)
    group_path = Column(String, nullable=True)
    version = relationship(
        "ModelVersion",
        back_populates="artifacts",
    )