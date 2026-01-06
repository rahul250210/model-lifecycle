from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.database import Base
from sqlalchemy.orm import relationship

class Model(Base):
    __tablename__ = "models"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    description = Column(String, nullable=True)
    algorithm_id = Column(Integer, ForeignKey("algorithms.id", ondelete="CASCADE"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # runtime only
    versions_count: int = 0

    algorithm = relationship(
        "Algorithm",
        back_populates="models"
    )

    versions = relationship(
        "ModelVersion",
        back_populates="model",
        cascade="all, delete-orphan"
    )