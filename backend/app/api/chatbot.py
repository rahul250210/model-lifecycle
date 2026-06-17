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
