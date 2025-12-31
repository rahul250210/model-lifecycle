from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    ForeignKey,
    JSON,
)
from sqlalchemy.sql import func
from app.database import Base

class Experiment(Base):
    __tablename__ = "experiments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    description = Column(String, nullable=True)
    model_id = Column(Integer, ForeignKey("models.id", ondelete="CASCADE"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # runtime
    runs_count: int = 0


class ExperimentRun(Base):
    __tablename__ = "experiment_runs"

    id = Column(Integer, primary_key=True, index=True)
    experiment_id = Column(Integer, ForeignKey("experiments.id", ondelete="CASCADE"))
    run_name = Column(String)
    status = Column(String)  # RUNNING / FINISHED / FAILED
    params = Column(JSON, default={})
    metrics = Column(JSON, default={})
    model_version_id = Column(Integer, ForeignKey("model_versions.id"), nullable=True)
    started_at = Column(DateTime)
    finished_at = Column(DateTime, nullable=True)
