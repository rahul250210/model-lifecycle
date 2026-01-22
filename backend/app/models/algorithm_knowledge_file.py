from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, BigInteger
from sqlalchemy.orm import relationship
from app.database import Base
from sqlalchemy.sql import func


class AlgorithmKnowledgeFile(Base):
    __tablename__ = "algorithm_knowledge_files"

    id = Column(Integer, primary_key=True, index=True)

    algorithm_id = Column(
        Integer,
        ForeignKey("algorithm_knowledge.id", ondelete="CASCADE"),
        nullable=False,
    )

    name = Column(String(255), nullable=False)
    type = Column(String(50), nullable=False)  # pdf, ppt, doc, image, text
    path = Column(String(500), nullable=False)
    size = Column(BigInteger, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    algorithm = relationship("AlgorithmKnowledge", back_populates="files")
