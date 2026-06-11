import os
import re
import json
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import text
from langchain_core.messages import SystemMessage, HumanMessage
from app.services.semcat_llm import SemcatChatModel
from dotenv import load_dotenv

load_dotenv()

# ── Comparison intent keywords ────────────────────────────────────────────────
COMPARISON_KEYWORDS = [
    "compare", "comparison", "versus", " vs ", "difference between",
    "compare version", "compare v", "which is better", "how does",
]

# ── Download / report intent keywords ───────────────────────────────────────────
DOWNLOAD_KEYWORDS = [
    "download", "export", "generate report", "create report", "get report",
    "save report", "download report", "export report", "report for",
    "factory report", "algorithm report", "model report",
]

# ── Prompt: generate SQL ──────────────────────────────────────────────────────
SQL_GENERATION_PROMPT = """You are an expert SQL analyst for MARS, an MLOps platform database.
Your ONLY job right now is to translate the user's question into a single, correct PostgreSQL SELECT query.

DATABASE SCHEMA:
- factories:      id, name, description, created_at, created_by_algorithm_id
- algorithms:     id, name, description, created_at
- models:         id, name, description, algorithm_id, factory_id, created_at
- model_versions: id, model_id, version_number, note, is_active, accuracy, precision, recall, f1_score,
                  inference_time, cpu_utilization, gpu_utilization, cpu_memory_usage, gpu_memory_usage,
                  frame_tp, frame_tn, frame_fp, frame_fn, alert_tp, alert_tn, alert_fp, alert_fn,
                  parameters, resource_metrics
- artifacts:      id, version_id, name, type, path, size, created_at

JOINS:
- factories.id = models.factory_id
- algorithms.id = models.algorithm_id
- models.id = model_versions.model_id
- model_versions.id = artifacts.version_id

RULES:
- Return ONLY the raw SQL query, nothing else. No markdown, no explanation, no backticks.
- Use ILIKE for name searches (case-insensitive).
- Never use DELETE, DROP, UPDATE, INSERT, ALTER.
- Limit to 10 rows unless the user asks for more.
- ALWAYS select internal database IDs or ID columns (such as `id`, `factory_id`, `algorithm_id`, `model_id`) in the SELECT column list. They are required under-the-hood to build navigation links, but will be filtered out automatically in the display.
- If the question is purely conceptual (e.g. "What is F1 score?"), respond with exactly: NO_SQL

Examples:
Q: List all factories
A: SELECT id, name, description FROM factories LIMIT 10;

Q: Which models have accuracy above 0.9?
A: SELECT m.id, m.name, mv.id AS version_id, mv.accuracy FROM models m JOIN model_versions mv ON m.id = mv.model_id WHERE mv.accuracy > 0.9 LIMIT 10;
"""

# ── Prompt: format answer ─────────────────────────────────────────────────────
ANSWER_FORMAT_PROMPT = """You are MIRA, the MARS Intelligent Repository Assistant.
Given the user's question and the SQL query results, write a clear, friendly, conversational answer.
Be concise. Summarize the key findings naturally — do not repeat the raw data as a list unless it helps.
If results are empty, say so politely.

CRITICAL: Do NOT mention or output internal database IDs (like ID numbers, factory IDs, etc.) in the conversational text. Only refer to entities by their names (e.g., say 'Suwon factory' instead of 'Suwon factory (ID 1)' or 'Sejong (ID 2)').
"""

# ── Prompt: comparison summary ────────────────────────────────────────────────
COMPARISON_SUMMARY_PROMPT = """You are MIRA, the MARS Intelligent Repository Assistant.
The user wants to compare multiple model versions. You have been given the full data for all versions.
Write a concise 2-3 sentence comparative summary highlighting:
- Which versions perform best on key metrics (accuracy, F1, precision, recall)
- Any notable differences in resource usage (inference time, CPU/GPU)
- An overall recommendation on which version to prefer

Be direct and conversational. Do not list every field — focus on the most important differences.
"""


def _is_comparison_query(question: str) -> bool:
    """Return True if the question appears to be asking for a comparison."""
    q = question.lower()
    return any(kw in q for kw in COMPARISON_KEYWORDS)


def _is_download_request(question: str) -> bool:
    """Return True if the question appears to be asking to download/export a report."""
    q = question.lower()
    return any(kw in q for kw in DOWNLOAD_KEYWORDS)


# ── Report Intent Extraction Prompt ─────────────────────────────────────────────
REPORT_INTENT_PROMPT = """You extract report download intent from a user message.
Return a single JSON object with these fields:
  - type: one of "factory", "algorithm", "model" (the entity the report is about)
  - name: the specific name mentioned, or null if they want all records

Examples:
User: download the factory report -> {"type": "factory", "name": null}
User: export algorithm report for ImageProcessing -> {"type": "algorithm", "name": "ImageProcessing"}
User: generate a model report for ResNet -> {"type": "model", "name": "ResNet"}
User: download all factories -> {"type": "factory", "name": null}
User: get me the report for TextAnalysis algorithm -> {"type": "algorithm", "name": "TextAnalysis"}

Return ONLY the JSON object. No extra text.
"""

def _extract_sql(raw: str) -> Optional[str]:
    """Extract a SQL query from the LLM response, stripping markdown if present."""
    raw = raw.strip()
    match = re.search(r"```(?:sql)?\s*(.*?)```", raw, re.DOTALL | re.IGNORECASE)
    if match:
        return match.group(1).strip()
    if raw.upper().startswith("SELECT"):
        return raw
    return None


def _is_algorithm_model_comparison(question: str) -> bool:
    """Return True if user wants to compare MODELS within an algorithm (not model versions)."""
    q = question.lower()
    has_compare = any(kw in q for kw in ["compare", "comparison", "versus", " vs ", "difference", "which is better"])
    has_algorithm = "algorithm" in q or "algo" in q
    has_models = "model" in q or "models" in q
    # Specifically exclude version comparisons
    has_version = "version" in q or " v1" in q or " v2" in q or " v3" in q
    return has_compare and has_algorithm and has_models and not has_version


def _get_offline_algorithm_comparison_sql(question: str, db_session: Session) -> Optional[str]:
    """
    Build SQL to compare all models under a specific algorithm.
    Fetches each model with its best-performing version metrics.
    """
    from difflib import SequenceMatcher
    q = question.lower()

    # Fetch all algorithm names from DB
    algo_res = db_session.execute(text("SELECT id, name FROM algorithms"))
    algo_list = [dict(zip(["id", "name"], r)) for r in algo_res]

    # Build grouped map (lowercase → list of IDs)
    grouped_algos: Dict[str, list] = {}
    for a in algo_list:
        name = a["name"].strip().lower()
        if name not in grouped_algos:
            grouped_algos[name] = []
        grouped_algos[name].append(a["id"])

    sorted_algo_names = sorted(grouped_algos.keys(), key=len, reverse=True)

    matched_algo_id: Optional[int] = None

    # PASS 1 — exact word-boundary match
    def is_word_match(n: str, text: str) -> bool:
        escaped = re.escape(n)
        start_b = r"(?<!\w)" if n[0].isalnum() else ""
        end_b = r"(?!\w)" if n[-1].isalnum() else ""
        return bool(re.search(start_b + escaped + end_b, text))

    for name in sorted_algo_names:
        if is_word_match(name, q):
            matched_algo_id = grouped_algos[name][0]
            break

    # PASS 2 — fuzzy match
    if not matched_algo_id:
        stop_words = {"compare", "comparison", "model", "models", "algorithm", "algorithms",
                      "the", "of", "in", "for", "a", "all", "show", "list"}
        q_words = [w for w in re.split(r'\W+', q) if len(w) >= 3 and w not in stop_words]
        best_score = 0.0
        for name in sorted_algo_names:
            for qw in q_words:
                score = SequenceMatcher(None, name, qw).ratio()
                if score > 0.75 and score > best_score:
                    best_score = score
                    matched_algo_id = grouped_algos[name][0]
        if matched_algo_id:
            print(f"[MIRA] Fuzzy matched algorithm ID {matched_algo_id} (score {best_score:.2f})")

    if not matched_algo_id:
        # If no algorithm name found, fetch all algorithms' models for a general overview
        print("[MIRA] No algorithm name matched; returning all models with algorithm context.")
        return """
            SELECT m.id AS model_id, m.name AS model_name,
                   a.name AS algorithm_name,
                   f.name AS factory_name,
                   mv.version_number AS best_version,
                   mv.accuracy, mv.precision, mv.recall, mv.f1_score,
                   mv.inference_time, mv.cpu_utilization, mv.gpu_utilization,
                   m.algorithm_id, m.factory_id
            FROM models m
            LEFT JOIN algorithms a ON m.algorithm_id = a.id
            LEFT JOIN factories f  ON m.factory_id  = f.id
            LEFT JOIN LATERAL (
                SELECT version_number, accuracy, precision, recall, f1_score,
                       inference_time, cpu_utilization, gpu_utilization
                FROM model_versions WHERE model_id = m.id
                ORDER BY accuracy DESC NULLS LAST LIMIT 1
            ) mv ON TRUE
            ORDER BY a.name, m.name;
        """

    return f"""
        SELECT m.id AS model_id, m.name AS model_name,
               a.name AS algorithm_name,
               f.name AS factory_name,
               mv.version_number AS best_version,
               mv.accuracy, mv.precision, mv.recall, mv.f1_score,
               mv.inference_time, mv.cpu_utilization, mv.gpu_utilization,
               m.algorithm_id, m.factory_id
        FROM models m
        LEFT JOIN algorithms a ON m.algorithm_id = a.id
        LEFT JOIN factories f  ON m.factory_id  = f.id
        LEFT JOIN LATERAL (
            SELECT version_number, accuracy, precision, recall, f1_score,
                   inference_time, cpu_utilization, gpu_utilization
            FROM model_versions WHERE model_id = m.id
            ORDER BY accuracy DESC NULLS LAST LIMIT 1
        ) mv ON TRUE
        WHERE m.algorithm_id = {matched_algo_id}
        ORDER BY m.name;
    """


def _generate_algorithm_comparison_answer(question: str, rows: List[dict]) -> str:
    """Generate a professional summary for a model comparison under an algorithm."""
    if not rows:
        return "No models were found for the requested algorithm. Please check the algorithm name and try again."

    # Get algorithm name from data
    algo_name = rows[0].get("algorithm_name") or "the selected algorithm"
    count = len(rows)

    # Find best model by accuracy
    best_acc_name, best_acc_val = None, -1.0
    for r in rows:
        acc = r.get("accuracy")
        if acc is not None:
            try:
                if float(acc) > best_acc_val:
                    best_acc_val = float(acc)
                    best_acc_name = r.get("model_name")
            except Exception:
                pass

    # Find fastest model
    fastest_name, fastest_val = None, float('inf')
    for r in rows:
        inf = r.get("inference_time")
        if inf is not None:
            try:
                if float(inf) < fastest_val:
                    fastest_val = float(inf)
                    fastest_name = r.get("model_name")
            except Exception:
                pass

    model_names = [r.get("model_name") for r in rows if r.get("model_name")]
    name_list = ", ".join(f"**{n}**" for n in model_names)

    parts = [f"Here's a comparison of all **{count} model(s)** under the **{algo_name}** algorithm: {name_list}."]

    if best_acc_name and best_acc_val > 0:
        parts.append(f"**{best_acc_name}** leads with the highest accuracy of **{best_acc_val:.1f}%**.")
    if fastest_name and fastest_val < float('inf'):
        parts.append(f"**{fastest_name}** is the fastest with an inference time of **{fastest_val:.1f} ms**.")

    parts.append("Review the cards below for a full metric breakdown per model.")
    return " ".join(parts)


def _get_offline_comparison_sql(question: str, db_session: Session) -> Optional[str]:
    q = question.lower()
    
    # Try to match all model names mentioned in the question
    models_res = db_session.execute(text("SELECT id, name FROM models"))
    model_list = [dict(zip(["id", "name"], r)) for r in models_res]
    
    # Group models by lowercase name to match case-insensitive variations and duplicates
    grouped_models = {}
    for m in model_list:
        name = m["name"].strip().lower()
        if name not in grouped_models:
            grouped_models[name] = []
        grouped_models[name].append(m["id"])
        
    sorted_names = sorted(grouped_models.keys(), key=len, reverse=True)
    
    q_lower = q.lower()
    matched_model_ids = []
    
    # Custom lookaround boundaries to support any characters (like parenthesis or symbols)
    def is_sub_name_matched(n: str, query: str) -> bool:
        escaped_name = re.escape(n)
        start_boundary = r"(?<!\w)" if n[0].isalnum() else ""
        end_boundary = r"(?!\w)" if n[-1].isalnum() else ""
        pattern = start_boundary + escaped_name + end_boundary
        return bool(re.search(pattern, query))

    for name in sorted_names:
        if is_sub_name_matched(name, q_lower):
            matched_model_ids.extend(grouped_models[name])
            # Replace matched name to prevent shorter sub-names from matching inside it
            escaped_name = re.escape(name)
            start_boundary = r"(?<!\w)" if name[0].isalnum() else ""
            end_boundary = r"(?!\w)" if name[-1].isalnum() else ""
            pattern = start_boundary + escaped_name + end_boundary
            q_lower = re.sub(pattern, " " * len(name), q_lower)
            
    # Check if they specified versions. Let's find version numbers like "version 1", "v2", "v-3", "version: 4", or standalone digits
    version_matches = re.findall(r"\b(?:version|v|v-)?\s*(\d+)\b", q)
    if not version_matches:
        version_matches = re.findall(r"\b\d+\b", q)
        
    v_ints = []
    for v in version_matches:
        try:
            val = int(v)
            if val not in v_ints:
                v_ints.append(val)
        except ValueError:
            pass

    # If we matched multiple models, compare all versions of those models
    if len(matched_model_ids) >= 2:
        model_ids_str = ", ".join(map(str, matched_model_ids))
        return f"""
            SELECT mv.id, mv.version_number, mv.note, mv.is_active,
                   mv.accuracy, mv.precision, mv.recall, mv.f1_score,
                   mv.inference_time, mv.cpu_utilization, mv.gpu_utilization,
                   mv.cpu_memory_usage, mv.gpu_memory_usage,
                   mv.frame_tp, mv.frame_tn, mv.frame_fp, mv.frame_fn,
                   mv.alert_tp, mv.alert_tn, mv.alert_fp, mv.alert_fn,
                   mv.parameters, mv.resource_metrics,
                   m.name AS model_name, m.id AS model_id, m.algorithm_id AS algorithm_id, m.factory_id AS factory_id
            FROM model_versions mv
            JOIN models m ON m.id = mv.model_id
            WHERE m.id IN ({model_ids_str})
            ORDER BY m.name ASC, mv.version_number ASC;
        """
        
    # Single model fallback or matched
    matched_model_id = matched_model_ids[0] if matched_model_ids else None

    # ── PASS 2: Fuzzy matching (handles typos like "yolov111" → "yolov11") ──────
    if not matched_model_id:
        from difflib import SequenceMatcher
        best_score = 0.0
        best_ids: list = []
        stop_words = {"compare", "comparison", "version", "versions", "all", "the", "of", "a", "model", "models", "and", "vs", "versus"}
        q_words = [w for w in re.split(r'\W+', q.lower()) if len(w) >= 3 and w not in stop_words]
        for name in sorted_names:
            for qw in q_words:
                score = SequenceMatcher(None, name, qw).ratio()
                if score > 0.75 and score > best_score:
                    best_score = score
                    best_ids = grouped_models[name]
        if best_ids:
            matched_model_id = best_ids[0]
            print(f"[MIRA] Fuzzy match found model ID {matched_model_id} with score {best_score:.2f}")

    if not matched_model_id:
        try:
            res = db_session.execute(text("SELECT model_id FROM model_versions ORDER BY created_at DESC LIMIT 1")).fetchone()
            if res:
                matched_model_id = res[0]
        except Exception:
            pass
            
    if not matched_model_id:
        return None
        
    # If user wants ALL versions of this single model
    wants_all = any(phrase in q for phrase in ["all versions", "all the versions", "every version", "all version"]) or len(v_ints) < 2
    if wants_all:
        return f"""
            SELECT mv.id, mv.version_number, mv.note, mv.is_active,
                   mv.accuracy, mv.precision, mv.recall, mv.f1_score,
                   mv.inference_time, mv.cpu_utilization, mv.gpu_utilization,
                   mv.cpu_memory_usage, mv.gpu_memory_usage,
                   mv.frame_tp, mv.frame_tn, mv.frame_fp, mv.frame_fn,
                   mv.alert_tp, mv.alert_tn, mv.alert_fp, mv.alert_fn,
                   mv.parameters, mv.resource_metrics,
                   m.name AS model_name, m.id AS model_id, m.algorithm_id AS algorithm_id, m.factory_id AS factory_id
            FROM model_versions mv
            JOIN models m ON m.id = mv.model_id
            WHERE m.id = {matched_model_id}
            ORDER BY mv.version_number ASC;
        """
        
    # If specific versions of this single model are requested
    v_nums_str = ", ".join(map(str, v_ints))
    return f"""
        SELECT mv.id, mv.version_number, mv.note, mv.is_active,
               mv.accuracy, mv.precision, mv.recall, mv.f1_score,
               mv.inference_time, mv.cpu_utilization, mv.gpu_utilization,
               mv.cpu_memory_usage, mv.gpu_memory_usage,
               mv.frame_tp, mv.frame_tn, mv.frame_fp, mv.frame_fn,
               mv.alert_tp, mv.alert_tn, mv.alert_fp, mv.alert_fn,
               mv.parameters, mv.resource_metrics,
               m.name AS model_name, m.id AS model_id, m.algorithm_id AS algorithm_id, m.factory_id AS factory_id
        FROM model_versions mv 
        JOIN models m ON m.id = mv.model_id
        WHERE m.id = {matched_model_id} AND mv.version_number IN ({v_nums_str})
        ORDER BY mv.version_number ASC;
    """


def _generate_offline_comparison_summary(versions_list: List[dict]) -> str:
    """Generate a professional, insight-driven summary for a model version comparison."""
    if not versions_list:
        return "No version data is available for the requested comparison."

    # Determine if this is a multi-model or single-model comparison
    unique_models = list({v.get("model_name", "Model") for v in versions_list})
    is_multi_model = len(unique_models) > 1

    if is_multi_model:
        # Build per-model label: "ModelA (v1, v2)"
        from collections import defaultdict
        model_versions_map = defaultdict(list)
        for v in versions_list:
            model_versions_map[v.get("model_name", "Model")].append(f"v{v.get('version_number')}")
        model_labels = ", ".join(
            f"**{m}** ({', '.join(sorted(vs))})"
            for m, vs in model_versions_map.items()
        )
        header = f"Here's a detailed comparison across {model_labels}:"
    else:
        m_name = unique_models[0]
        lbls = sorted([f"v{v.get('version_number')}"
                       for v in versions_list if v.get("model_name") == m_name])
        header = f"Here's a version-by-version breakdown for **{m_name}** ({', '.join(lbls)}):"

    insights = []

    # Accuracy leader
    best_acc_v, best_acc_val = None, -1.0
    for v in versions_list:
        acc = v.get("accuracy")
        if acc is not None:
            try:
                if float(acc) > best_acc_val:
                    best_acc_val = float(acc)
                    label = f"**{v.get('model_name')} v{v.get('version_number')}**" if is_multi_model else f"**v{v.get('version_number')}**"
                    best_acc_v = label
            except Exception:
                pass
    if best_acc_v:
        insights.append(f"{best_acc_v} leads in accuracy at **{best_acc_val:.1f}%**.")

    # F1 leader
    best_f1_v, best_f1_val = None, -1.0
    for v in versions_list:
        f1 = v.get("f1_score")
        if f1 is not None:
            try:
                if float(f1) > best_f1_val:
                    best_f1_val = float(f1)
                    label = f"**{v.get('model_name')} v{v.get('version_number')}**" if is_multi_model else f"**v{v.get('version_number')}**"
                    best_f1_v = label
            except Exception:
                pass
    if best_f1_v:
        insights.append(f"{best_f1_v} achieves the best F1 score of **{best_f1_val:.3f}**.")

    # Speed leader
    fastest_v, fastest_val = None, float('inf')
    for v in versions_list:
        inf = v.get("inference_time")
        if inf is not None:
            try:
                if float(inf) < fastest_val:
                    fastest_val = float(inf)
                    label = f"**{v.get('model_name')} v{v.get('version_number')}**" if is_multi_model else f"**v{v.get('version_number')}**"
                    fastest_v = label
            except Exception:
                pass
    if fastest_v:
        insights.append(f"{fastest_v} is the fastest, with an inference time of **{fastest_val:.1f} ms**.")

    summary_parts = [header]
    if insights:
        summary_parts.append(" ".join(insights))
    summary_parts.append("Click **View Detailed Comparison** below for a full side-by-side metric breakdown.")
    return "\n\n".join(summary_parts)


def _run_comparison(user_question: str, db_session: Session, llm: SemcatChatModel) -> Dict[str, Any]:
    """
    Dedicated comparison path:
    1. Use LLM to extract version numbers / model name from the question.
    2. Fetch full data for all versions from the DB directly.
    3. Return type='comparison' with structured data for the frontend to chart.
    """
    comp_sql_prompt = f"""You are an expert SQL analyst for MARS MLOps.
The user wants to COMPARE multiple model versions.
Return a SQL query that fetches ALL columns of these versions from model_versions joined with models.
Include: mv.id, mv.version_number, mv.note, mv.is_active,
         mv.accuracy, mv.precision, mv.recall, mv.f1_score,
         mv.inference_time, mv.cpu_utilization, mv.gpu_utilization,
         mv.cpu_memory_usage, mv.gpu_memory_usage,
         mv.frame_tp, mv.frame_tn, mv.frame_fp, mv.frame_fn,
         mv.alert_tp, mv.alert_tn, mv.alert_fp, mv.alert_fn,
         mv.parameters, mv.resource_metrics,
         m.name AS model_name, m.id AS model_id, m.algorithm_id AS algorithm_id, m.factory_id AS factory_id
FROM model_versions mv JOIN models m ON m.id = mv.model_id

Return ONLY the raw SQL. No markdown, no explanation. Use ILIKE for name searches.

User question: {user_question}
"""
    sql_response = llm._generate(
        [SystemMessage(content=comp_sql_prompt), HumanMessage(content=user_question)],
        stop=["\n\n"]
    )
    raw_sql = sql_response.generations[0].message.content.strip()
    sql_query = _extract_sql(raw_sql)

    if not sql_query:
        # Fallback to regular pipeline
        return _run_regular(user_question, db_session, llm)

    # Execute comparison query
    try:
        query_lower = sql_query.lower()
        if "select" not in query_lower or any(
            x in query_lower for x in ["delete", "drop", "update", "insert", "alter"]
        ):
            return _run_regular(user_question, db_session, llm)

        sql_res = db_session.execute(text(sql_query))
        columns = list(sql_res.keys())
        rows = [dict(zip(columns, r)) for r in sql_res]
    except Exception as e:
        print(f"Comparison DB error: {e}")
        return _run_regular(user_question, db_session, llm)

    # Deduplicate rows by (model_id, version_number) to prevent double-rendering
    seen_v: set = set()
    deduped: list = []
    for row in rows:
        key = (row.get("model_id"), row.get("version_number"))
        if key not in seen_v:
            seen_v.add(key)
            deduped.append(row)
    rows = sorted(deduped, key=lambda r: (r.get("model_name", ""), r.get("version_number", 0)))

    if len(rows) < 2:
        return _run_regular(user_question, db_session, llm)
        
    # Enrich comparison rows with relationship names and IDs
    rows = _enrich_ids_for_navigation(rows, "versions", db_session)

    # Fetch artifacts for each version to get file sizes
    for v in rows:
        try:
            art_res = db_session.execute(
                text("SELECT name, type, size FROM artifacts WHERE version_id = :vid"),
                {"vid": v["id"]}
            )
            art_cols = list(art_res.keys())
            v["artifacts"] = [dict(zip(art_cols, r)) for r in art_res]
        except Exception:
            v["artifacts"] = []

    # Generate a conversational summary
    try:
        context_parts = []
        for v in rows:
            context_parts.append(f"Version {v.get('version_number')} data: {json.dumps(v, default=str)}")
        context = "\n\n".join(context_parts)
        
        summary_response = llm._generate([
            SystemMessage(content=COMPARISON_SUMMARY_PROMPT),
            HumanMessage(content=f"Question: {user_question}\n\n{context}"),
        ])
        summary = summary_response.generations[0].message.content.strip()
        
        # Check if the LLM output is an error string or offline sentinel
        error_keywords = ["something went wrong", "llm server", "please try again", "error in llm", "internal server error", "__llm_offline__"]
        if "__LLM_OFFLINE__" in summary or any(kw in summary.lower() for kw in error_keywords) or not summary.strip():
            print("Warning: LLM returned error string for summary. Falling back to offline generator.")
            summary = _generate_offline_comparison_summary(rows)
    except Exception as e:
        print(f"Warning: Failed to generate LLM summary: {e}. Falling back to offline generator.")
        summary = _generate_offline_comparison_summary(rows)

    return {
        "answer": summary,
        "type": "comparison",
        "data": rows,
        "query": sql_query,
    }


def _detect_entity_type(query: str) -> Optional[str]:
    """Detect if the query targets factories, algorithms, models, or versions."""
    if not query:
        return None
    q = query.lower()
    
    # 1. Check if model_versions or mv. or version is present and likely versions
    if "model_versions" in q or "model_version" in q or "version_number" in q or "version_id" in q:
        return "versions"
        
    # 2. Parse the SELECT clause to find the target entity from column aliases/prefixes
    select_match = re.search(r"\bselect\s+(.*?)\s+\bfrom\b", q, re.DOTALL)
    if select_match:
        select_cols = select_match.group(1).strip()
        # Look for table aliases or names in select columns
        if "mv." in select_cols or "model_versions" in select_cols:
            return "versions"
        
        # Check first column prefix/alias to identify main entity
        first_col = select_cols.split(",")[0].strip()
        if first_col.startswith("m.") or "models" in first_col or "model" in first_col:
            return "models"
        if first_col.startswith("a.") or "algorithms" in first_col or "algorithm" in first_col:
            return "algorithms"
        if first_col.startswith("f.") or "factories" in first_col or "factory" in first_col:
            return "factories"
            
        # If first column is not aliased, check any column for alias/prefix
        if "m." in select_cols:
            return "models"
        if "a." in select_cols:
            return "algorithms"
        if "f." in select_cols:
            return "factories"
            
    # 3. Parse the main table from the FROM clause
    match = re.search(r"\bfrom\s+(\w+)", q)
    if match:
        main_table = match.group(1)
        if main_table == "model_versions":
            return "versions"
        if main_table == "factories":
            return "factories"
        if main_table == "algorithms":
            return "algorithms"
        if main_table == "models":
            return "models"
            
    # 4. Fallback to keyword matching if regex fails or table name is not recognized
    if "models" in q or "model" in q:
        if "version" in q:
            return "versions"
        return "models"
    if "factories" in q or "factory" in q:
        return "factories"
    if "algorithms" in q or "algorithm" in q:
        return "algorithms"
        
    return None


def _get_offline_sql_fallback(question: str) -> Optional[str]:
    q = question.lower()
    if "factory" in q or "factories" in q:
        return "SELECT id, name, description, created_at FROM factories ORDER BY created_at DESC;"
    if "algorithm" in q or "algorithms" in q:
        return "SELECT id, name, description, created_at FROM algorithms ORDER BY created_at DESC;"
    if "model" in q or "models" in q:
        if "version" in q or "versions" in q:
            return """
                SELECT mv.id, mv.version_number, mv.note, mv.accuracy, mv.f1_score,
                       m.id AS model_id, m.algorithm_id, m.factory_id
                FROM model_versions mv
                JOIN models m ON mv.model_id = m.id
                ORDER BY mv.created_at DESC LIMIT 10;
            """
        return "SELECT id, name, description, algorithm_id, factory_id, created_at FROM models ORDER BY created_at DESC;"
    if "version" in q or "versions" in q:
        return """
            SELECT mv.id, mv.version_number, mv.note, mv.accuracy, mv.f1_score,
                   m.id AS model_id, m.algorithm_id, m.factory_id
            FROM model_versions mv
            JOIN models m ON mv.model_id = m.id
            ORDER BY mv.created_at DESC LIMIT 10;
        """
    return None


def _enrich_ids_for_navigation(rows: List[dict], entity_type: str, db_session: Session) -> List[dict]:
    if not rows or not entity_type:
        return rows
        
    enriched = []
    for row in rows:
        r = dict(row)
        
        if entity_type == "factories":
            f_id = r.get("id") or r.get("factory_id")
            if not f_id and "name" in r:
                try:
                    res = db_session.execute(
                        text("SELECT id FROM factories WHERE name = :fname LIMIT 1"),
                        {"fname": r["name"]}
                    ).fetchone()
                    if res:
                        r["id"] = res[0]
                except Exception:
                    pass
                    
        elif entity_type == "algorithms":
            a_id = r.get("id") or r.get("algorithm_id")
            if not a_id and "name" in r:
                try:
                    res = db_session.execute(
                        text("SELECT id FROM algorithms WHERE name = :aname LIMIT 1"),
                        {"aname": r["name"]}
                    ).fetchone()
                    if res:
                        r["id"] = res[0]
                except Exception:
                    pass
                    
        elif entity_type == "models":
            m_id = r.get("id") or r.get("model_id")
            if not m_id and "name" in r:
                try:
                    res = db_session.execute(
                        text("SELECT id FROM models WHERE name = :mname LIMIT 1"),
                        {"mname": r["name"]}
                    ).fetchone()
                    if res:
                        r["id"] = res[0]
                        m_id = res[0]
                except Exception:
                    pass
            if m_id:
                try:
                    res = db_session.execute(
                        text("""
                            SELECT m.name AS model_name, m.algorithm_id, m.factory_id,
                                   a.name AS algorithm_name, f.name AS factory_name
                            FROM models m
                            LEFT JOIN algorithms a ON m.algorithm_id = a.id
                            LEFT JOIN factories f ON m.factory_id = f.id
                            WHERE m.id = :mid
                        """),
                        {"mid": m_id}
                    ).fetchone()
                    if res:
                        r["name"] = res[0]
                        r["id"] = m_id
                        r["algorithm_id"] = res[1]
                        r["factory_id"] = res[2]
                        r["algorithm_name"] = res[3]
                        r["factory_name"] = res[4]
                except Exception:
                    pass
                        
        elif entity_type == "versions":
            v_id = r.get("id") or r.get("version_id")
            m_id = r.get("model_id")
            
            # Try to resolve model_id if not present
            if not m_id and "model_name" in r:
                try:
                    m_res = db_session.execute(
                        text("SELECT id FROM models WHERE name = :mname LIMIT 1"),
                        {"mname": r["model_name"]}
                    ).fetchone()
                    if m_res:
                        m_id = m_res[0]
                        r["model_id"] = m_id
                except Exception:
                    pass
                    
            # Try to resolve version id if not present
            if not v_id:
                v_num = r.get("version_number")
                if v_num is not None and m_id:
                    try:
                        res = db_session.execute(
                            text("SELECT id FROM model_versions WHERE model_id = :mid AND version_number = :vnum LIMIT 1"),
                            {"mid": m_id, "vnum": v_num}
                        ).fetchone()
                        if res:
                            r["id"] = res[0]
                            v_id = res[0]
                    except Exception:
                        pass
                        
            # If we have version id but not model_id, look up model_id first
            if v_id and not m_id:
                try:
                    res = db_session.execute(
                        text("SELECT model_id FROM model_versions WHERE id = :vid"),
                        {"vid": v_id}
                    ).fetchone()
                    if res:
                        m_id = res[0]
                        r["model_id"] = m_id
                except Exception:
                    pass

            if m_id:
                try:
                    res = db_session.execute(
                        text("""
                            SELECT m.name AS model_name, m.algorithm_id, m.factory_id,
                                   a.name AS algorithm_name, f.name AS factory_name
                            FROM models m
                            LEFT JOIN algorithms a ON m.algorithm_id = a.id
                            LEFT JOIN factories f ON m.factory_id = f.id
                            WHERE m.id = :mid
                        """),
                        {"mid": m_id}
                    ).fetchone()
                    if res:
                        r["model_name"] = res[0]
                        r["model_id"] = m_id
                        r["algorithm_id"] = res[1]
                        r["factory_id"] = res[2]
                        r["algorithm_name"] = res[3]
                        r["factory_name"] = res[4]
                except Exception:
                    pass

        enriched.append(r)
    return enriched


def _generate_offline_answer(user_question: str, rows: List[dict]) -> str:
    """
    Generate a professional, context-aware conversational answer without the LLM.
    Analyses the question and result rows to produce a natural-language summary.
    Never exposes raw IDs.
    """
    q = user_question.lower().strip()
    count = len(rows)

    # ── Empty results ──────────────────────────────────────────────────────────
    if count == 0:
        if "factory" in q or "factories" in q:
            return "No factories were found matching your request."
        if "algorithm" in q or "algorithms" in q:
            return "No algorithms were found matching your request."
        if "model" in q or "models" in q:
            return "No models were found matching your request."
        return "No results were found for your query."

    # ── Factory listings ───────────────────────────────────────────────────────
    if "factor" in q:
        names = [r.get("name") or r.get("factory_name") for r in rows if r.get("name") or r.get("factory_name")]
        names = [n for n in names if n]
        if names:
            if len(names) == 1:
                return f"There is **1 factory** registered on the platform: **{names[0]}**."
            name_list = ", ".join(f"**{n}**" for n in names[:-1]) + f", and **{names[-1]}**"
            return f"There are **{len(names)} factories** registered on the platform: {name_list}."
        return f"Found **{count} factory record(s)** in the platform."

    # ── Algorithm listings ─────────────────────────────────────────────────────
    if "algorithm" in q:
        names = [r.get("name") or r.get("algorithm_name") for r in rows if r.get("name") or r.get("algorithm_name")]
        names = [n for n in names if n]
        if names:
            if len(names) == 1:
                return f"There is **1 algorithm** registered on the platform: **{names[0]}**."
            name_list = ", ".join(f"**{n}**" for n in names[:-1]) + f", and **{names[-1]}**"
            return f"There are **{len(names)} algorithms** registered on the platform: {name_list}."
        return f"Found **{count} algorithm record(s)** in the platform."

    # ── Model version listings ─────────────────────────────────────────────────
    if "version" in q or "versions" in q:
        model_name = rows[0].get("model_name") if rows else None
        if model_name:
            return (
                f"Here are all **{count} version(s)** of **{model_name}**. "
                f"Use the cards below to review performance metrics for each version."
            )
        return f"Found **{count} model version(s)**. Review the details below."

    # ── Model listings ─────────────────────────────────────────────────────────
    if "model" in q:
        # Top N by accuracy
        if any(kw in q for kw in ["top", "best", "highest", "accuracy", "performance"]):
            leaders = []
            for r in rows[:3]:
                name = r.get("name") or r.get("model_name")
                acc = r.get("accuracy")
                if name and acc is not None:
                    try:
                        leaders.append(f"**{name}** ({float(acc):.1f}%)")
                    except Exception:
                        leaders.append(f"**{name}**")
            if leaders:
                return (
                    f"The top-performing models by accuracy are: {', '.join(leaders)}. "
                    f"Full details are shown below."
                )
        names = [r.get("name") or r.get("model_name") for r in rows if r.get("name") or r.get("model_name")]
        names = [n for n in names if n]
        if names:
            if len(names) == 1:
                return f"There is **1 model** registered on the platform: **{names[0]}**."
            name_list = ", ".join(f"**{n}**" for n in names[:-1]) + f", and **{names[-1]}**"
            return f"There are **{len(names)} models** registered on the platform: {name_list}."
        return f"Found **{count} model record(s)** in the platform."

    # ── Generic fallback (accurate but professional) ───────────────────────────
    return f"Here are the **{count} result(s)** for your query. Review the details below."


def _run_regular(user_question: str, db_session: Session, llm: SemcatChatModel) -> Dict[str, Any]:
    """Standard 2-step pipeline for non-comparison questions."""
    raw_sql = ""
    error_keywords = ["something went wrong", "llm server", "please try again", "error in llm", "internal server error", "__llm_offline__"]
    
    try:
        sql_messages = [
            SystemMessage(content=SQL_GENERATION_PROMPT),
            HumanMessage(content=user_question),
        ]
        sql_response = llm._generate(sql_messages, stop=["\n\n"])
        raw_sql = sql_response.generations[0].message.content.strip()
    except Exception as e:
        print(f"Warning: SQL generation LLM call failed: {e}")

    raw_sql_lower = raw_sql.lower()
    is_error = any(kw in raw_sql_lower for kw in error_keywords) or not raw_sql
    
    if is_error:
        print("SQL generation failed or returned error. Trying offline fallback SQL.")
        sql_query = _get_offline_sql_fallback(user_question)
        if not sql_query:
            return {
                "answer": "MIRA is currently offline and could not resolve this query. Please use the platform navigation or check the logs.",
                "type": "text"
            }
    else:
        if "NO_SQL" in raw_sql.upper():
            try:
                answer_messages = [
                    SystemMessage(content=ANSWER_FORMAT_PROMPT),
                    HumanMessage(content=f"Question: {user_question}\n\nNo database query was needed. Answer directly and helpfully."),
                ]
                answer_response = llm._generate(answer_messages)
                final_answer = answer_response.generations[0].message.content.strip()
                if any(kw in final_answer.lower() for kw in error_keywords):
                    final_answer = "MIRA is currently running in offline mode. Please use the platform navigation."
            except Exception:
                final_answer = "MIRA is currently running in offline mode. Please use the platform navigation."
            # Also catch the offline sentinel
            if "__LLM_OFFLINE__" in final_answer or any(kw in final_answer.lower() for kw in error_keywords):
                final_answer = "MIRA is currently running in offline mode. Please use the platform navigation."
            return {
                "answer": final_answer,
                "type": "text",
            }
        sql_query = _extract_sql(raw_sql)
        if not sql_query:
            sql_query = _get_offline_sql_fallback(user_question)
            if not sql_query:
                return {"answer": raw_sql, "type": "text"}

    rows = []
    db_error = None
    try:
        query_lower = sql_query.lower()
        if "select" in query_lower and not any(
            x in query_lower for x in ["delete", "drop", "update", "insert", "alter"]
        ):
            sql_res = db_session.execute(text(sql_query))
            columns = list(sql_res.keys())
            rows = [dict(zip(columns, r)) for r in sql_res]
    except Exception as e:
        db_error = str(e)
        print(f"DB execution error: {e}")

    if db_error:
        context = f"The SQL query failed with error: {db_error}"
    elif not rows:
        context = "The query returned no results."
    else:
        context = f"SQL Results ({len(rows)} row(s)):\n{json.dumps(rows[:20], default=str, indent=2)}"

    final_answer = ""
    try:
        answer_messages = [
            SystemMessage(content=ANSWER_FORMAT_PROMPT),
            HumanMessage(content=f"Question: {user_question}\n\nSQL Query used:\n{sql_query}\n\n{context}"),
        ]
        answer_response = llm._generate(answer_messages)
        final_answer = answer_response.generations[0].message.content.strip()

        # Check if output contains LLM server error warnings or offline sentinel
        if "__LLM_OFFLINE__" in final_answer or any(kw in final_answer.lower() for kw in error_keywords):
            final_answer = _generate_offline_answer(user_question, rows)
    except Exception as e:
        print(f"Warning: Conversational answer formatting failed: {e}")
        final_answer = _generate_offline_answer(user_question, rows)

    entity_type = _detect_entity_type(sql_query)
    enriched_rows = _enrich_ids_for_navigation(rows, entity_type, db_session)
    return {
        "answer": final_answer,
        "data": enriched_rows,
        "type": "sql" if enriched_rows else "text",
        "entity_type": entity_type,
        "query": sql_query,
    }


def _run_download_report(user_question: str, llm: SemcatChatModel) -> Dict[str, Any]:
    """
    Detect what kind of report the user wants and return type='download'
    so the frontend can trigger a download from the dedicated endpoint.
    """
    try:
        resp = llm._generate([
            SystemMessage(content=REPORT_INTENT_PROMPT),
            HumanMessage(content=user_question),
        ])
        raw = resp.generations[0].message.content.strip()
        # Strip markdown if present
        raw = re.sub(r"```(?:json)?\s*(.*?)```", r"\1", raw, flags=re.DOTALL).strip()
        intent = json.loads(raw)
        report_type = intent.get("type", "factory")
        report_name = intent.get("name")  # may be None
    except Exception:
        # Fallback: default to factory report
        report_type = "factory"
        report_name = None

    label_map = {"factory": "Factory", "algorithm": "Algorithm", "model": "Model"}
    label = label_map.get(report_type, "Factory")
    name_str = f' — {report_name}' if report_name else ''

    return {
        "answer": f"I've prepared your **{label} Report{name_str}** 📄\n\nClick the button below to download it as a CSV file.",
        "type": "download",
        "report_type": report_type,
        "report_name": report_name,
    }


def run_sql_agent(user_question: str, db_session: Session) -> Dict[str, Any]:
    """
    Main entry point. Routes to download, comparison, or regular pipeline.
    """
    try:
        llm = SemcatChatModel(temperature=0.1)

        if _is_download_request(user_question):
            return _run_download_report(user_question, llm)
            
        # 1a. Check if user wants to compare MODELS within/of an algorithm
        if _is_algorithm_model_comparison(user_question):
            algo_sql = _get_offline_algorithm_comparison_sql(user_question, db_session)
            if algo_sql:
                print("Routing algorithm-model comparison offline.")
                try:
                    sql_res = db_session.execute(text(algo_sql))
                    columns = list(sql_res.keys())
                    algo_rows = [dict(zip(columns, r)) for r in sql_res]
                    if algo_rows:
                        enriched = _enrich_ids_for_navigation(algo_rows, "models", db_session)
                        answer = _generate_algorithm_comparison_answer(user_question, algo_rows)
                        return {
                            "answer": answer,
                            "data": enriched,
                            "type": "sql",
                            "entity_type": "models",
                            "query": algo_sql,
                        }
                except Exception as db_err:
                    print(f"Algorithm comparison DB execution failed: {db_err}")

        # 1b. Standard version comparison (compare versions of a model)
        if _is_comparison_query(user_question):
            offline_sql = _get_offline_comparison_sql(user_question, db_session)
            if offline_sql:
                print("Routing comparison query offline for instant response.")
                try:
                    sql_res = db_session.execute(text(offline_sql))
                    columns = list(sql_res.keys())
                    raw_rows = [dict(zip(columns, r)) for r in sql_res]
                    # Deduplicate by (model_id, version_number) and sort
                    seen_v: set = set()
                    rows = []
                    for row in raw_rows:
                        key = (row.get("model_id"), row.get("version_number"))
                        if key not in seen_v:
                            seen_v.add(key)
                            rows.append(row)
                    rows = sorted(rows, key=lambda r: (r.get("model_name", ""), r.get("version_number", 0)))
                    if len(rows) >= 2:
                        # Enrich comparison rows with relationship names and IDs
                        rows = _enrich_ids_for_navigation(rows, "versions", db_session)
                        for v in rows:
                            try:
                                art_res = db_session.execute(
                                    text("SELECT name, type, size FROM artifacts WHERE version_id = :vid"),
                                    {"vid": v["id"]}
                                )
                                art_cols = list(art_res.keys())
                                v["artifacts"] = [dict(zip(art_cols, r)) for r in art_res]
                            except Exception:
                                v["artifacts"] = []
                        
                        summary = _generate_offline_comparison_summary(rows)
                        return {
                            "answer": summary,
                            "type": "comparison",
                            "data": rows,
                            "query": offline_sql,
                        }
                except Exception as db_err:
                    print(f"Offline comparison DB execution failed: {db_err}")
            
            return _run_comparison(user_question, db_session, llm)
            
        # 2. Try to route regular list/get queries offline first for instant response
        offline_sql = _get_offline_sql_fallback(user_question)
        if offline_sql:
            print("Routing list/get query offline for instant response.")
            try:
                sql_res = db_session.execute(text(offline_sql))
                columns = list(sql_res.keys())
                rows = [dict(zip(columns, r)) for r in sql_res]
                
                answer = _generate_offline_answer(user_question, rows)
                    
                entity_type = _detect_entity_type(offline_sql)
                enriched_rows = _enrich_ids_for_navigation(rows, entity_type, db_session)
                return {
                    "answer": answer,
                    "data": enriched_rows,
                    "type": "sql" if enriched_rows else "text",
                    "entity_type": entity_type,
                    "query": offline_sql,
                }
            except Exception as db_err:
                print(f"Offline fallback DB execution failed: {db_err}")

        return _run_regular(user_question, db_session, llm)

    except Exception as e:
        print(f"MIRA pipeline error: {e}")
        return {
            "answer": f"⚠️ MIRA encountered an error: {e}",
            "type": "error",
        }
