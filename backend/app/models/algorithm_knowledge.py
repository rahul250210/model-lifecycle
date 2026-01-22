# app/models/algorithm_knowledge.py

from sqlalchemy import Column,Text, Integer, String, DateTime, func, UniqueConstraint
from sqlalchemy.orm import relationship
from app.database import Base


class AlgorithmKnowledge(Base):
    __tablename__ = "algorithm_knowledge"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    slug = Column(String(255), nullable=False, unique=True)
    description=Column(Text,nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    files = relationship(
        "AlgorithmKnowledgeFile",
        back_populates="algorithm",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        UniqueConstraint("slug", name="uq_algorithm_knowledge_slug"),
    )
