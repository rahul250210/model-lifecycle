import re
import json
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import text
from difflib import SequenceMatcher

from app.services.llm_service import call_llm

# Centralized routing check keywords as O(1) sets
ACTION_KEYWORDS = {"download", "export", "report", "csv", "zip", "bundle", "weights", "compare", "versus", "vs", "better than", "difference between"}
DIRECT_METRIC_KEYWORDS = {"accuracy", "precision", "recall", "f1", "f1_score", "inference", "latency", "cpu", "gpu", "memory", "utilization"}
CONCEPT_KEYWORDS = {"explain", "how does", "why is", "define", "definition", "tutorial", "architecture", "concept", "theory", "mlops", "difference between"}
DB_KEYWORDS = {"accuracy", "precision", "recall", "f1", "f1_score", "inference", "latency", "cpu", "gpu", "memory", "utilization", "version", "versions", "count", "average", "mean", "min", "max", "list", "show", "rank", "top", "best"}

def route_query(user_question: str, db_session: Session, context: List[Dict[str, Any]] = []) -> Dict[str, Any]:
    """
    Classifies the user query into one of the four supported query types:
    DATABASE_QUERY, KNOWLEDGE_QUERY, HYBRID_QUERY, ACTION_QUERY.
    """
    history_str = ""
    if context:
        formatted = []
        for msg in context:
            role = "User" if msg.get("role") == "user" else "Assistant"
            content = msg.get("content", "")
            if content:
                formatted.append(f"{role}: {content}")
        if formatted:
            history_str = "\nCONVERSATION HISTORY:\n" + "\n".join(formatted) + "\n"

    prompt = f"""You are a query routing assistant for MARS, an MLOps platform repository.
{history_str}
Your task is to classify the user's question into one of the four query types:

1. DATABASE_QUERY:
- Requests specific database records, lists, statistics, rankings, or analytics of the system.
- Does not ask for definitions, AI/ML theory, or architectural explanations.
- Examples: "how many versions does R2+1D have?", "show top 5 models by accuracy", "list all active versions".

2. KNOWLEDGE_QUERY:
- Conceptual questions, definitions, AI/ML theory, architecture explanations, general tutorials, or software engineering concepts.
- Does not reference specific data or models stored in the local repository database.
- Examples: "What is LangChain?", "Explain YOLO architecture.", "What is a CNN?", "What is RAG?", "Explain Transformer architecture."

3. HYBRID_QUERY:
- Combines general conceptual explanations/theory with specific local repository data or entities.
- Examples: "What is YOLOv11?", "Explain YOLOv11 used in our repository.", "How does Random Forest work and what versions do we have?"

4. ACTION_QUERY:
- Requests actions such as download reports, download zip bundles, compare entities, compare versions, export, navigate, or open screens.
- Examples: "Download model report for YOLOv11", "Compare YOLOv11 version 1 and version 2", "Export weights for Resnet".

Analyze the user's question and respond with ONLY a single JSON object (do NOT wrap it in markdown code block formatting, do NOT write ```json, do NOT write any explanation before or after):
{{
  "query_type": "DATABASE_QUERY" | "KNOWLEDGE_QUERY" | "HYBRID_QUERY" | "ACTION_QUERY",
  "explanation": "Brief reasoning for classification"
}}

User Question: {user_question}"""

    raw_response = call_llm(prompt, temperature=0.0)
    
    # Try parsing JSON
    try:
        clean_resp = raw_response.strip()
        if clean_resp.startswith("```json"):
            clean_resp = clean_resp[7:]
        if clean_resp.startswith("```"):
            clean_resp = clean_resp[3:]
        if clean_resp.endswith("```"):
            clean_resp = clean_resp[:-3]
        clean_resp = clean_resp.strip()
        
        parsed = json.loads(clean_resp)
        if parsed.get("query_type") in ["DATABASE_QUERY", "KNOWLEDGE_QUERY", "HYBRID_QUERY", "ACTION_QUERY"]:
            return parsed
    except Exception as e:
        print(f"[QueryRouter] Failed to parse router response: {raw_response}. Error: {e}")
        
    # Rule-based fallback if LLM is offline or JSON parsing fails
    q = user_question.lower()
    
    # Action keywords
    if any(kw in q for kw in ACTION_KEYWORDS):
        return {"query_type": "ACTION_QUERY", "explanation": "Rule fallback: contains action keywords"}
        
    # Check if any database entities exist in the query using dynamic database checks
    try:
        has_model = db_session.execute(
            text("SELECT EXISTS (SELECT 1 FROM models WHERE :q LIKE '%' || lower(name) || '%')"),
            {"q": q}
        ).scalar()
        has_algo = db_session.execute(
            text("SELECT EXISTS (SELECT 1 FROM algorithms WHERE :q LIKE '%' || lower(name) || '%')"),
            {"q": q}
        ).scalar()
        has_factory = db_session.execute(
            text("SELECT EXISTS (SELECT 1 FROM factories WHERE :q LIKE '%' || lower(name) || '%')"),
            {"q": q}
        ).scalar()
        has_db_entity = bool(has_model or has_algo or has_factory)
    except Exception as e:
        print(f"[QueryRouter] Fallback dynamic DB check failed: {e}")
        has_db_entity = False
    
    # Direct database metric queries (e.g. "what is the accuracy of YOLOv11")
    is_direct_metric = any(kw in q for kw in DIRECT_METRIC_KEYWORDS)
    
    # If it asks for metrics directly and doesn't contain conceptual verbs, it is DATABASE_QUERY
    if is_direct_metric and not any(kw in q for kw in {"explain", "how does", "why"}):
        return {"query_type": "DATABASE_QUERY", "explanation": "Rule fallback: contains database metrics/keywords"}
        
    # Conceptual/Explanation keywords
    if any(kw in q for kw in CONCEPT_KEYWORDS) or (q.startswith("what is ") and not is_direct_metric):
        if has_db_entity:
            return {"query_type": "HYBRID_QUERY", "explanation": "Rule fallback: conceptual query with repository entity"}
        return {"query_type": "KNOWLEDGE_QUERY", "explanation": "Rule fallback: conceptual query"}
        
    # Check for direct database metrics or versions
    if any(kw in q for kw in DB_KEYWORDS):
        return {"query_type": "DATABASE_QUERY", "explanation": "Rule fallback: database metrics/keywords"}
        
    # Default to KNOWLEDGE if it starts with "what is" and doesn't match database keywords
    if q.startswith("what is ") or q.startswith("explain "):
        return {"query_type": "KNOWLEDGE_QUERY", "explanation": "Rule fallback: conceptual question"}
        
    return {"query_type": "DATABASE_QUERY", "explanation": "Default rule fallback"}

def handle_knowledge_query(user_question: str) -> str:
    """Answers a pure knowledge/conceptual question using the LLM directly."""
    prompt = f"""You are a helpful AI assistant for MARS, an MLOps platform.
Answer the following general conceptual question conversationally in markdown.
Your answer should be accurate, detailed, and cover relevant AI/ML, MLOps, or software engineering concepts.

User Question: {user_question}"""
    
    answer = call_llm(prompt, temperature=0.5)
    if answer == "__LLM_OFFLINE__":
        return "⚠️ I'm sorry, I am currently offline and cannot answer conceptual questions. Please try again later or ask a database-related query."
    return answer

def get_database_context(user_question: str, db_session: Session) -> str:
    """Searches the database for entities matching terms in the query and returns formatted context."""
    q = user_question.lower()
    
    # Fetch all models, factories, and algorithms
    models = db_session.execute(text("SELECT id, name, description, algorithm_id, factory_id FROM models")).fetchall()
    factories = db_session.execute(text("SELECT id, name, description FROM factories")).fetchall()
    algorithms = db_session.execute(text("SELECT id, name, description FROM algorithms")).fetchall()
    
    context_lines = []
    
    # Match factories
    matched_factories = []
    for f in factories:
        if f.name.lower() in q:
            matched_factories.append(f)
            
    # Match algorithms
    matched_algorithms = []
    for a in algorithms:
        if a.name.lower() in q:
            matched_algorithms.append(a)
            
    # Match models (sorted by length DESC to match longest first)
    matched_models = []
    temp_q = q
    sorted_models = sorted(models, key=lambda m: len(m.name), reverse=True)
    for m in sorted_models:
        name_lower = m.name.lower()
        if name_lower in temp_q:
            matched_models.append(m)
            temp_q = temp_q.replace(name_lower, "")
            
    # Build context for matched factories
    for f in matched_factories:
        context_lines.append(f"--- Factory Entity Found ---")
        context_lines.append(f"Name: {f.name}")
        context_lines.append(f"Description: {f.description or 'No description available'}")
        assoc_models = db_session.execute(
            text("SELECT name FROM models WHERE factory_id = :fid"),
            {"fid": f.id}
        ).fetchall()
        if assoc_models:
            model_names = ", ".join([m.name for m in assoc_models])
            context_lines.append(f"Associated models in this factory: {model_names}")
        context_lines.append("")
        
    # Build context for matched algorithms
    for a in matched_algorithms:
        context_lines.append(f"--- Algorithm Entity Found ---")
        context_lines.append(f"Name: {a.name}")
        context_lines.append(f"Description: {a.description or 'No description available'}")
        assoc_models = db_session.execute(
            text("SELECT name FROM models WHERE algorithm_id = :aid"),
            {"aid": a.id}
        ).fetchall()
        if assoc_models:
            model_names = ", ".join([m.name for m in assoc_models])
            context_lines.append(f"Associated models using this algorithm: {model_names}")
        context_lines.append("")
        
    # Build context for matched models
    for m in matched_models:
        context_lines.append(f"--- Model Entity Found ---")
        context_lines.append(f"Name: {m.name}")
        context_lines.append(f"Description: {m.description or 'No description available'}")
        
        # Get factory and algorithm names
        f_name_res = db_session.execute(text("SELECT name FROM factories WHERE id = :fid"), {"fid": m.factory_id}).fetchone()
        a_name_res = db_session.execute(text("SELECT name FROM algorithms WHERE id = :aid"), {"aid": m.algorithm_id}).fetchone()
        if f_name_res:
            context_lines.append(f"Associated Factory: {f_name_res[0]}")
        if a_name_res:
            context_lines.append(f"Associated Algorithm: {a_name_res[0]}")
            
        # Get versions
        versions = db_session.execute(
            text("""
                SELECT mv.version_number, mv.is_active, mv.accuracy, mv.precision, mv.recall, mv.f1_score, mv.inference_time, mv.note
                FROM model_versions mv
                WHERE mv.model_id = :mid
                ORDER BY mv.version_number ASC
            """),
            {"mid": m.id}
        ).fetchall()
        
        if versions:
            context_lines.append("Versions in Repository:")
            for v in versions:
                status = "Active" if v.is_active else "Inactive"
                metrics = []
                if v.accuracy is not None: metrics.append(f"Accuracy: {v.accuracy}%")
                if v.precision is not None: metrics.append(f"Precision: {v.precision}%")
                if v.recall is not None: metrics.append(f"Recall: {v.recall}%")
                if v.f1_score is not None: metrics.append(f"F1 Score: {v.f1_score}%")
                if v.inference_time is not None: metrics.append(f"Inference Time: {v.inference_time}ms")
                metrics_str = ", ".join(metrics) if metrics else "No metrics recorded"
                context_lines.append(f"  - Version {v.version_number} ({status}): {metrics_str} | Note: {v.note or 'None'}")
        else:
            context_lines.append("No versions registered for this model.")
        context_lines.append("")
        
    return "\n".join(context_lines).strip()

def handle_hybrid_query(user_question: str, db_session: Session) -> str:
    """Answers a hybrid question combining database entity context and conceptual explanation."""
    context = get_database_context(user_question, db_session)
    if not context:
        # Fallback to pure knowledge if no entities are resolved in the repository database
        return handle_knowledge_query(user_question)
        
    prompt = f"""You are a helpful AI assistant for MARS, an MLOps platform.
We found the following context in our database repository related to the query:
{context}

User question: {user_question}

Please explain this concept and how it relates to the information in our repository.
Your answer should:
1. Explain the conceptual/theoretical aspects of the user's question.
2. Incorporate the specific repository models/versions/factories/metrics found in the database context.
3. Be conversational and formatted nicely in markdown."""

    answer = call_llm(prompt, temperature=0.3)
    if answer == "__LLM_OFFLINE__":
        return "⚠️ I'm sorry, I am currently offline and cannot answer queries. Please try again later."
    return answer
