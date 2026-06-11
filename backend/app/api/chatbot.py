from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
import json
import csv
import io
import os
import requests as req
from dotenv import load_dotenv
from app.api.deps import get_db
from app.services.sql_agent import run_sql_agent

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


@router.post("/ask")
async def ask_chatbot(payload: ChatRequest, db: Session = Depends(get_db)):
    # ── Check API key ──
    if not GEMINI_API_KEY or GEMINI_API_KEY == "your_gemini_api_key_here":
        return {
            "answer": "⚠️ Gemini API key is not configured.\n\nPlease set **GEMINI_API_KEY** in `backend/.env`.\n\nGet a free key at: https://aistudio.google.com/app/apikey",
            "type": "error"
        }

    try:
        # Delegate directly to our LangChain SQLAgent service
        return run_sql_agent(payload.message, db)
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
    db: Session = Depends(get_db),
):
    """
    Generate and stream a CSV report for factories, algorithms, or models.
    Optionally filter by name (ILIKE match).
    """
    query_template = REPORT_QUERIES.get(report_type)
    if not query_template:
        return {"error": "Invalid report type"}

    # Build WHERE clause
    params = {}
    if name:
        name_col_map = {
            "factory":   "f.name",
            "algorithm": "a.name",
            "model":     "m.name",
        }
        col = name_col_map[report_type]
        where_clause = f"WHERE {col} ILIKE :name"
        params["name"] = f"%{name}%"
    else:
        where_clause = ""

    sql = query_template.format(where=where_clause)

    try:
        result = db.execute(text(sql), params)
        columns = list(result.keys())
        rows = [dict(zip(columns, r)) for r in result]
    except Exception as e:
        return {"error": str(e)}

    # Build CSV in memory
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=columns)
    writer.writeheader()
    for row in rows:
        writer.writerow({k: ("" if v is None else v) for k, v in row.items()})
    output.seek(0)

    filename_name = name.replace(" ", "_") if name else "all"
    filename = f"MARS_{report_type}_report_{filename_name}.csv"

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
