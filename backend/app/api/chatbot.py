import csv
import io
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel
from app.api.deps import get_db
from app.models import Factory, Algorithm, Model, ModelVersion
from app.services.query_dispatcher import run_sql_agent

router = APIRouter(prefix="/chatbot", tags=["Chatbot"])

class ChatRequest(BaseModel):
    message: str
    context: list = []   # [{"role": "user"|"bot", "content": "..."}, ...]

@router.post("/ask")
def ask_chatbot(payload: ChatRequest, db: Session = Depends(get_db)):
    try:
        # Delegate to the MARS AI Agent
        return run_sql_agent(payload.message, db, context=payload.context)
    except Exception as e:
        print(f"Chatbot error: {e}")
        return {"answer": f"Unexpected error: {e}", "type": "error"}

@router.get("/download-report")
def download_report(
    report_type: str = Query(default="factory", regex="^(factory|algorithm|model)$"),
    name: str = Query(default=None),
    algorithm_id: int = Query(default=None),
    algorithm_name: str = Query(default=None),
    factory_id: int = Query(default=None),
    factory_name: str = Query(default=None),
    model_id: int = Query(default=None),
    db: Session = Depends(get_db),
):
    """
    Generate and stream a CSV report for factories, algorithms, or models.
    Optionally filter by name (ILIKE match) and context identifiers (algorithm, factory, model).
    """
    stream = io.StringIO()
    writer = csv.writer(stream)

    from fastapi.params import Query as FastAPIQuery
    if isinstance(report_type, FastAPIQuery): report_type = "factory"
    if isinstance(name, FastAPIQuery): name = None
    if isinstance(algorithm_id, FastAPIQuery): algorithm_id = None
    if isinstance(algorithm_name, FastAPIQuery): algorithm_name = None
    if isinstance(factory_id, FastAPIQuery): factory_id = None
    if isinstance(factory_name, FastAPIQuery): factory_name = None
    if isinstance(model_id, FastAPIQuery): model_id = None

    if report_type == "factory":
        if factory_id:
            factories = db.query(Factory).filter(Factory.id == factory_id).all()
        elif name:
            factories = db.query(Factory).filter(Factory.name.ilike(f"%{name}%")).order_by(Factory.name.asc()).all()
            if not factories:
                raise HTTPException(status_code=404, detail="Factory not found")
        elif factory_name:
            factories = db.query(Factory).filter(Factory.name.ilike(f"%{factory_name}%")).order_by(Factory.name.asc()).all()
        else:
            factories = db.query(Factory).order_by(Factory.name.asc()).all()

        # Header (exactly matching factories.py:generate_factory_report)
        writer.writerow([
            "Model Name",
            "Algorithm Name",
            "Version",
            "Status",
            "Created At",
            "Description",
            "Dataset Count",
            "Accuracy",
            "Precision",
            "Recall",
            "F1 Score",
            "CPU Utilization (%)",
            "GPU Utilization (%)",
            "Inference Time (ms)",
            "Hyperparameters",
        ])

        for factory in factories:
            query = (
                db.query(Model)
                .options(
                    joinedload(Model.algorithm),
                    joinedload(Model.versions).joinedload(ModelVersion.delta)
                )
                .filter(Model.factory_id == factory.id)
            )

            # A factory report should contain all models in the factory (matching the factoryoverview page report format).
            # Do not filter by model_id, algorithm_id, or algorithm_name.
            pass

            models = query.order_by(Model.name.asc()).all()

            for model in models:
                versions = sorted(model.versions, key=lambda v: v.version_number)

                if not versions:
                    writer.writerow([model.name, model.algorithm.name if model.algorithm else "N/A", "N/A", "N/A", "N/A", "N/A", "N/A", "N/A", "N/A", "N/A", "N/A", "N/A", "N/A", "N/A", "N/A"])
                    continue

                for v in versions:
                    dataset_count = v.delta.dataset_count if v.delta and v.delta.dataset_count is not None else 0
                    hyperparams = str(v.parameters) if v.parameters else "None"
                    created_str = v.created_at.strftime("%d-%m-%Y %H:%M:%S") if v.created_at else "N/A"
                    status_label = "Active" if v.is_active else "Inactive"

                    writer.writerow([
                        model.name,
                        model.algorithm.name if model.algorithm else "N/A",
                        f"v{v.version_number}",
                        status_label,
                        created_str,
                        v.note or "",
                        dataset_count,
                        v.accuracy if v.accuracy is not None else "N/A",
                        v.precision if v.precision is not None else "N/A",
                        v.recall if v.recall is not None else "N/A",
                        v.f1_score if v.f1_score is not None else "N/A",
                        v.cpu_utilization if v.cpu_utilization is not None else "N/A",
                        v.gpu_utilization if v.gpu_utilization is not None else "N/A",
                        v.inference_time if v.inference_time is not None else "N/A",
                        hyperparams,
                    ])

                writer.writerow([])

    elif report_type == "model":
        query = db.query(Model)
        if model_id:
            query = query.filter(Model.id == model_id)
        elif name:
            query = query.filter(Model.name.ilike(f"%{name}%"))

        if algorithm_id:
            query = query.filter(Model.algorithm_id == algorithm_id)
        elif algorithm_name:
            query = query.join(Model.algorithm).filter(Algorithm.name.ilike(f"%{algorithm_name}%"))

        if factory_id:
            query = query.filter(Model.factory_id == factory_id)
        elif factory_name:
            query = query.join(Model.factory).filter(Factory.name.ilike(f"%{factory_name}%"))

        models = query.order_by(Model.name.asc()).all()
        if not models:
            raise HTTPException(status_code=404, detail="Model not found")

        # Header Row (exactly matching models.py:generate_model_report)
        writer.writerow([
            "Version Number",
            "Created At",
            "Description",
            "Dataset Total Count",
            "Accuracy",
            "Precision",
            "Recall",
            "F1 Score",
            "CPU Utilization (%)",
            "GPU Utilization (%)",
            "Inference Time (ms)",
            "Hyperparameters"
        ])

        for model in models:
            versions = (
                db.query(ModelVersion)
                .filter(ModelVersion.model_id == model.id)
                .order_by(ModelVersion.version_number.asc())
                .all()
            )

            for v in versions:
                dataset_count = v.delta.dataset_count if v.delta and v.delta.dataset_count is not None else 0
                hyperparameters = str(v.parameters) if v.parameters else "None"
                created_at_str = v.created_at.strftime("%d-%m-%Y %H:%M:%S") if v.created_at else "N/A"

                writer.writerow([
                    v.version_number,
                    created_at_str,
                    v.note or "",
                    dataset_count,
                    v.accuracy if v.accuracy is not None else "N/A",
                    v.precision if v.precision is not None else "N/A",
                    v.recall if v.recall is not None else "N/A",
                    v.f1_score if v.f1_score is not None else "N/A",
                    v.cpu_utilization if v.cpu_utilization is not None else "N/A",
                    v.gpu_utilization if v.gpu_utilization is not None else "N/A",
                    v.inference_time if v.inference_time is not None else "N/A",
                    hyperparameters
                ])

    elif report_type == "algorithm":
        if algorithm_id:
            algorithms = db.query(Algorithm).filter(Algorithm.id == algorithm_id).all()
        elif name:
            algorithms = db.query(Algorithm).filter(Algorithm.name.ilike(f"%{name}%")).order_by(Algorithm.name.asc()).all()
            if not algorithms:
                raise HTTPException(status_code=404, detail="Algorithm not found")
        elif algorithm_name:
            algorithms = db.query(Algorithm).filter(Algorithm.name.ilike(f"%{algorithm_name}%")).order_by(Algorithm.name.asc()).all()
        else:
            algorithms = db.query(Algorithm).order_by(Algorithm.name.asc()).all()

        # Header Row (exactly matching algorithms.py:generate_algorithm_report)
        writer.writerow([
            "Factory Name",
            "Model Name",
            "Version Number",
            "Created At",
            "Description",
            "Dataset Total Count",
            "Accuracy",
            "Precision",
            "Recall",
            "F1 Score",
            "CPU Utilization (%)",
            "GPU Utilization (%)",
            "Inference Time (ms)",
            "Hyperparameters"
        ])

        for algo in algorithms:
            query = (
                db.query(Model)
                .options(
                    joinedload(Model.versions).joinedload(ModelVersion.delta),
                    joinedload(Model.factory)
                )
                .filter(Model.algorithm_id == algo.id)
            )

            # An algorithm report should contain all models of the algorithm.
            # Do not filter by model_id, factory_id, or factory_name.
            pass

            models = query.order_by(Model.name.asc()).all()

            for model in models:
                versions = sorted(model.versions, key=lambda v: v.version_number)
                
                for v in versions:
                    dataset_count = v.delta.dataset_count if v.delta and v.delta.dataset_count is not None else 0
                    hyperparameters = str(v.parameters) if v.parameters else "None"
                    created_at_str = v.created_at.strftime("%d-%m-%Y %H:%M:%S") if v.created_at else "N/A"

                    writer.writerow([
                        model.factory.name if model.factory else "N/A",
                        model.name,
                        v.version_number,
                        created_at_str,
                        v.note or "",
                        dataset_count,
                        v.accuracy if v.accuracy is not None else "N/A",
                        v.precision if v.precision is not None else "N/A",
                        v.recall if v.recall is not None else "N/A",
                        v.f1_score if v.f1_score is not None else "N/A",
                        v.cpu_utilization if v.cpu_utilization is not None else "N/A",
                        v.gpu_utilization if v.gpu_utilization is not None else "N/A",
                        v.inference_time if v.inference_time is not None else "N/A",
                        hyperparameters
                    ])
                    
                if versions:
                    writer.writerow([])

    csv_output = "\ufeff" + stream.getvalue()
    filename_name = name.replace(" ", "_") if name else "all"
    filename = f"MARS_{report_type}_report_{filename_name}.csv"

    return StreamingResponse(
        iter([csv_output]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
