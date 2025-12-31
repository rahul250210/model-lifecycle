from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime

from app.api.deps import get_db
from app.models.experiment import Experiment, ExperimentRun
from app.models.model import Model
from app.models.version import ModelVersion
from app.schemas.experiment import (
    ExperimentCreate,
    ExperimentOut,
    RunCreate,
    RunOut,
)

router = APIRouter()

# ======================================================
# CREATE EXPERIMENT
# ======================================================
@router.post(
    "/{factory_id}/algorithms/{algorithm_id}/models/{model_id}/experiments",
    response_model=ExperimentOut,
    status_code=status.HTTP_201_CREATED,
)
def create_experiment(
    factory_id: int,
    algorithm_id: int,
    model_id: int,
    experiment: ExperimentCreate,
    db: Session = Depends(get_db),
):
    # Ensure model exists
    model = (
        db.query(Model)
        .filter(
            Model.id == model_id,
            Model.algorithm_id == algorithm_id,
        )
        .first()
    )
    if not model:
        raise HTTPException(404, "Model not found")

    db_experiment = Experiment(
        name=experiment.name,
        description=experiment.description,
        model_id=model_id,
    )
    db.add(db_experiment)
    db.commit()
    db.refresh(db_experiment)

    return db_experiment


# ======================================================
# LIST EXPERIMENTS (WITH RUN COUNT + BEST METRIC)
# ======================================================
@router.get(
    "/{factory_id}/algorithms/{algorithm_id}/models/{model_id}/experiments",
    response_model=list[ExperimentOut],
)
def list_experiments(
    model_id: int,
    db: Session = Depends(get_db),
):
    experiments = (
        db.query(
            Experiment,
            func.count(ExperimentRun.id).label("runs_count"),
        )
        .outerjoin(ExperimentRun, ExperimentRun.experiment_id == Experiment.id)
        .filter(Experiment.model_id == model_id)
        .group_by(Experiment.id)
        .order_by(Experiment.created_at.desc())
        .all()
    )

    results = []
    for exp, run_count in experiments:
        exp.runs_count = run_count
        results.append(exp)

    return results


# ======================================================
# CREATE RUN (MLFLOW CORE)
# ======================================================
@router.post(
    "/{factory_id}/algorithms/{algorithm_id}/models/{model_id}/experiments/{experiment_id}/runs",
    response_model=RunOut,
    status_code=status.HTTP_201_CREATED,
)
def create_run(
    factory_id: int,
    algorithm_id: int,
    model_id: int,
    experiment_id: int,
    run: RunCreate,
    db: Session = Depends(get_db),
):
    # Ensure experiment exists
    experiment = (
        db.query(Experiment)
        .filter(
            Experiment.id == experiment_id,
            Experiment.model_id == model_id,
        )
        .first()
    )
    if not experiment:
        raise HTTPException(404, "Experiment not found")

    # Optional: link to active model version
    active_version = (
        db.query(ModelVersion)
        .filter(
            ModelVersion.model_id == model_id,
            ModelVersion.is_active == True,
        )
        .first()
    )

    db_run = ExperimentRun(
        experiment_id=experiment_id,
        run_name=run.run_name,
        params=run.params,
        metrics=run.metrics,
        status="RUNNING",
        started_at=datetime.utcnow(),
        model_version_id=active_version.id if active_version else None,
    )

    db.add(db_run)
    db.commit()
    db.refresh(db_run)

    return db_run


# ======================================================
# FINISH / UPDATE RUN
# ======================================================
@router.put(
    "/{factory_id}/algorithms/{algorithm_id}/models/{model_id}/experiments/{experiment_id}/runs/{run_id}",
    response_model=RunOut,
)
def update_run(
    run_id: int,
    run: RunCreate,
    db: Session = Depends(get_db),
):
    db_run = db.query(ExperimentRun).filter(ExperimentRun.id == run_id).first()
    if not db_run:
        raise HTTPException(404, "Run not found")

    db_run.metrics = run.metrics
    db_run.status = "FINISHED"
    db_run.finished_at = datetime.utcnow()

    db.commit()
    db.refresh(db_run)

    return db_run


# ======================================================
# GET RUN DETAILS
# ======================================================
@router.get(
    "/{factory_id}/algorithms/{algorithm_id}/models/{model_id}/experiments/{experiment_id}/runs/{run_id}",
    response_model=RunOut,
)
def get_run(
    run_id: int,
    db: Session = Depends(get_db),
):
    run = db.query(ExperimentRun).filter(ExperimentRun.id == run_id).first()
    if not run:
        raise HTTPException(404, "Run not found")
    return run
