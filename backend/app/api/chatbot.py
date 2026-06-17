from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import text
from pydantic import BaseModel
import json
import csv
import io
import os
import requests as req
from dotenv import load_dotenv
from app.api.deps import get_db
from app.services.query_dispatcher import run_sql_agent

from app.models.factory import Factory
from app.models.algorithm import Algorithm
from app.models.model import Model
from app.models.version import ModelVersion

load_dotenv()

router = APIRouter(prefix="/chatbot", tags=["Chatbot"])

# ─── Gemini REST API (no google-generativeai package needed) ────────────────
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL   = "gemini-2.5-flash"
GEMINI_URL     = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"

# ─── System Prompt ────────────────────────────────────────────────────────────
SYSTEM_PROMPT = """You are a database-connected AI assistant for MARS, an MLOps platform.

CRITICAL RULES - NEVER BREAK THESE:
1. ANY question asking for specific values, numbers, accuracy, metrics, lists, status, or data from the system → ALWAYS output SQL type
2. NEVER say "Retrieves..." or describe what a query would do. Actually write the SQL and return it.
3. ONLY use "text" type for pure conceptual questions like "what is F1 score?" or "explain overfitting"
4. Output ONLY a single JSON object. No markdown, no code fences, no extra words.
5. NEVER include internal database IDs or ID columns (such as `id`, `factory_id`, `algorithm_id`, `model_id`) in the SELECT column list of the generated SQL queries or in conversational text answers, unless explicitly asked by the user. Only show/select user-friendly fields like name, description, etc.

OUTPUT FORMATS:
For data questions: {"type": "sql", "sql": "SELECT ...", "explanation": "One sentence answer"}
For concept questions: {"type": "text", "answer": "Your explanation"}

DATABASE SCHEMA:
- factories           (id, name, description, created_at, created_by_algorithm_id)
- algorithms          (id, name, description, created_at)
- models              (id, name, description, algorithm_id, factory_id, created_at)
- model_versions mv   (id, model_id, version_number, note, is_active, created_at, updated_at,
                       accuracy, precision, recall, f1_score, inference_time,
                       cpu_utilization, gpu_utilization, cpu_memory_usage, gpu_memory_usage)
- artifacts           (id, version_id, name, type, path, size, created_at)

JOINS:
  factories.id = models.factory_id
  algorithms.id = models.algorithm_id
  models.id = model_versions.model_id
  model_versions.id = artifacts.version_id

MODEL NAME MATCHING: Use ILIKE for model name searches (case-insensitive). Example: WHERE m.name ILIKE '%r2+1d%'

FEW-SHOT EXAMPLES (follow these exactly):

Q: what is the accuracy of r2+1d version 8
A: {"type": "sql", "sql": "SELECT m.name, mv.version_number, mv.accuracy, mv.f1_score, mv.precision, mv.recall FROM model_versions mv JOIN models m ON mv.model_id = m.id WHERE m.name ILIKE '%r2+1d%' AND mv.version_number = 8 LIMIT 1", "explanation": "Accuracy of r2+1d model at version 8"}

Q: show top 5 models by accuracy
A: {"type": "sql", "sql": "SELECT m.name, mv.version_number, mv.accuracy, mv.f1_score FROM model_versions mv JOIN models m ON mv.model_id = m.id ORDER BY mv.accuracy DESC NULLS LAST LIMIT 5", "explanation": "Top 5 models ranked by accuracy"}

Q: list all factories
A: {"type": "sql", "sql": "SELECT name, description, created_at FROM factories ORDER BY created_at DESC", "explanation": "All factories in the system"}

Q: what is average accuracy across all active versions
A: {"type": "sql", "sql": "SELECT ROUND(AVG(accuracy)::numeric, 4) AS avg_accuracy, COUNT(*) AS total_active FROM model_versions WHERE is_active = true AND accuracy IS NOT NULL", "explanation": "Average accuracy of all active model versions"}

Q: what is F1 score
A: {"type": "text", "answer": "F1 Score is the harmonic mean of precision and recall, calculated as 2*(precision*recall)/(precision+recall). It balances both metrics and is especially useful for imbalanced datasets."}

Q: how many versions does r2+1d have
A: {"type": "sql", "sql": "SELECT m.name, COUNT(mv.id) AS total_versions, MAX(mv.version_number) AS latest_version FROM model_versions mv JOIN models m ON mv.model_id = m.id WHERE m.name ILIKE '%r2+1d%' GROUP BY m.name", "explanation": "Version count for r2+1d model"}

Now answer the following question using ONLY the JSON format above. No additional text."""


def call_gemini(user_message: str) -> str:
    """Call Gemini REST API and return raw text response."""
    url = f"{GEMINI_URL}?key={GEMINI_API_KEY}"
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": f"{SYSTEM_PROMPT}\n\nUser question: {user_message}"}
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": 1024,
        }
    }
    response = req.post(url, json=payload, timeout=30)
    response.raise_for_status()
    data = response.json()
    return data["candidates"][0]["content"]["parts"][0]["text"].strip()


class ChatRequest(BaseModel):
    message: str
    context: list = []   # [{"role": "user"|"bot", "content": "..."}, ...]


@router.post("/ask")
async def ask_chatbot(payload: ChatRequest, db: Session = Depends(get_db)):
    # ── Check API key ──
    if not GEMINI_API_KEY or GEMINI_API_KEY == "your_gemini_api_key_here":
        return {
            "answer": "⚠️ Gemini API key is not configured.\n\nPlease set **GEMINI_API_KEY** in `backend/.env`.\n\nGet a free key at: https://aistudio.google.com/app/apikey",
            "type": "error"
        }

    try:
        # Delegate to the MARS AI Agent
        return run_sql_agent(payload.message, db, context=payload.context)
    except Exception as e:
        print(f"Chatbot error: {e}")
        return {"answer": f"Unexpected error: {e}", "type": "error"}


# ───────────────────────────────────────────────────────────────────
# Report Download Endpoint
# ───────────────────────────────────────────────────────────────────

REPORT_QUERIES = {
    "factory": """
        SELECT
            f.id                          AS factory_id,
            f.name                        AS factory_name,
            f.description                 AS factory_description,
            f.created_at                  AS factory_created_at,
            COUNT(DISTINCT m.algorithm_id) AS total_algorithms,
            COUNT(DISTINCT m.id)           AS total_models,
            COUNT(DISTINCT mv.id)          AS total_versions,
            ROUND(AVG(mv.accuracy)::numeric,   4) AS avg_accuracy,
            ROUND(AVG(mv.f1_score)::numeric,   4) AS avg_f1_score,
            ROUND(AVG(mv.precision)::numeric,  4) AS avg_precision,
            ROUND(AVG(mv.recall)::numeric,     4) AS avg_recall
        FROM factories f
        LEFT JOIN models m            ON m.factory_id  = f.id
        LEFT JOIN model_versions mv   ON mv.model_id   = m.id
        {where}
        GROUP BY f.id, f.name, f.description, f.created_at
        ORDER BY f.created_at DESC
    """,
    "algorithm": """
        SELECT
            a.id                                    AS algorithm_id,
            a.name                                  AS algorithm_name,
            a.description                           AS algorithm_description,
            STRING_AGG(DISTINCT f.name, ', ')       AS factory_names,
            a.created_at                            AS algorithm_created_at,
            COUNT(DISTINCT m.id)                    AS total_models,
            COUNT(DISTINCT mv.id)                   AS total_versions,
            ROUND(AVG(mv.accuracy)::numeric,  4)    AS avg_accuracy,
            ROUND(AVG(mv.f1_score)::numeric,  4)    AS avg_f1_score,
            ROUND(AVG(mv.precision)::numeric, 4)    AS avg_precision,
            ROUND(AVG(mv.recall)::numeric,    4)    AS avg_recall,
            ROUND(AVG(mv.inference_time)::numeric, 2) AS avg_inference_time_ms
        FROM algorithms a
        LEFT JOIN models m          ON m.algorithm_id = a.id
        LEFT JOIN factories f       ON f.id = m.factory_id
        LEFT JOIN model_versions mv ON mv.model_id = m.id
        {where}
        GROUP BY a.id, a.name, a.description, a.created_at
        ORDER BY a.created_at DESC
    """,
    "model": """
        SELECT
            m.id            AS model_id,
            m.name          AS model_name,
            m.description   AS model_description,
            a.name          AS algorithm_name,
            f.name          AS factory_name,
            mv.version_number,
            mv.is_active,
            mv.note,
            mv.accuracy,
            mv.precision,
            mv.recall,
            mv.f1_score,
            mv.inference_time,
            mv.cpu_utilization,
            mv.gpu_utilization,
            mv.cpu_memory_usage,
            mv.gpu_memory_usage,
            mv.frame_tp, mv.frame_tn, mv.frame_fp, mv.frame_fn,
            mv.alert_tp, mv.alert_tn, mv.alert_fp, mv.alert_fn,
            mv.created_at   AS version_created_at
        FROM model_versions mv
        JOIN models m      ON m.id  = mv.model_id
        JOIN algorithms a  ON a.id  = m.algorithm_id
        JOIN factories f   ON f.id  = m.factory_id
        {where}
        ORDER BY m.name, mv.version_number
    """,
}



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
