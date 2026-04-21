from sqlalchemy import Column, Integer, Boolean, DateTime, ForeignKey, String, Float
from sqlalchemy.sql import func
from app.database import Base
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSONB
class ModelVersion(Base):
    __tablename__ = "model_versions"

    id = Column(Integer, primary_key=True, index=True)
    model_id = Column(Integer, ForeignKey("models.id", ondelete="CASCADE"))
    version_number = Column(Integer)
    note = Column(String, nullable=True)
    is_active = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)
    accuracy = Column(Float, nullable=True)
    precision = Column(Float, nullable=True)
    recall = Column(Float, nullable=True)
    f1_score = Column(Float, nullable=True)

    # Performance Metrics
    cpu_utilization = Column(Float, nullable=True) # Percentage (0-100)
    gpu_utilization = Column(Float, nullable=True) # Percentage (0-100)
    inference_time = Column(Float, nullable=True)  # ms per inference
    cpu_memory_usage = Column(Float, nullable=True) # MB
    gpu_memory_usage = Column(Float, nullable=True) # MB
    cameras_supported = Column(Integer, nullable=True) # Count
    
    # Confusion Matrix
    tp = Column(Integer, nullable=True)
    tn = Column(Integer, nullable=True)
    fp = Column(Integer, nullable=True)
    fn = Column(Integer, nullable=True)

    parameters = Column(JSONB, default=dict)
    resource_metrics = Column(JSONB, default=dict)
    
    artifacts = relationship(
        "Artifact",
        back_populates="version",
        cascade="all, delete-orphan",
        passive_deletes=True
    )
    delta = relationship("VersionDelta", back_populates="version",
    cascade="all, delete-orphan",
    passive_deletes=True, uselist=False)

    model = relationship(
        "Model",
        back_populates="versions"
    )

class VersionDelta(Base):
    __tablename__ = "version_deltas"

    id = Column(Integer, primary_key=True)
    version_id = Column(Integer, ForeignKey("model_versions.id",  ondelete="CASCADE"),unique=True)
    total_count = Column(Integer)
    new_count = Column(Integer)
    reused_count = Column(Integer)
    removed_count = Column(Integer)
    unchanged_count = Column(Integer)
    dataset_count = Column(Integer)   
    label_count = Column(Integer)  
    dataset_new = Column(Integer, default=0)
    dataset_reused = Column(Integer, default=0)
    dataset_removed = Column(Integer, default=0)

    label_new = Column(Integer, default=0)
    label_reused = Column(Integer, default=0)
    label_removed = Column(Integer, default=0)
    version = relationship("ModelVersion", back_populates="delta",passive_deletes=True)