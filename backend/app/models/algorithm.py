from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.database import Base
from sqlalchemy.orm import relationship

class Algorithm(Base):
    __tablename__ = "algorithms"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    description = Column(String, nullable=True)
    factory_id = Column(Integer, ForeignKey("factories.id", ondelete="CASCADE"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # runtime only
    models_count: int = 0

    factory = relationship(
        "Factory",
        back_populates="algorithms"
    )

    models = relationship(
        "Model",
        back_populates="algorithm",
        cascade="all, delete-orphan"
    )
