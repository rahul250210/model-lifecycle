from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.database import Base
from sqlalchemy.orm import relationship

class Factory(Base):
    __tablename__ = "factories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    description = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by_algorithm_id = Column(Integer, ForeignKey("algorithms.id"), nullable=True)

    # NOT columns – runtime attributes
    algorithms_count: int = 0
    models_count: int = 0

    models = relationship(
        "Model",
        back_populates="factory",
        cascade="all, delete-orphan"
    )
