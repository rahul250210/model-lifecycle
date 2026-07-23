import json
from typing import Any, Dict, List
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.services.llm_service import call_llm
from app.services.query_router import resolve_entities

def _enrich_version_row(res, db_session: Session) -> Dict[str, Any]:
    """Enriches a model version record with its associated artifacts."""
    row_dict = dict(res._mapping)
    # Query artifacts
    arts = db_session.execute(
        text("SELECT name, size, type FROM artifacts WHERE version_id = :v_id"),
        {"v_id": row_dict["id"]}
    ).fetchall()
    row_dict["artifacts"] = [{"name": art.name, "size": art.size, "type": art.type} for art in arts]
    
    # Ensure parameters is a clean dict
    params_val = row_dict.get("parameters")
    if isinstance(params_val, str):
        try:
            row_dict["parameters"] = json.loads(params_val)
        except:
            row_dict["parameters"] = {}
    elif not isinstance(params_val, dict):
        row_dict["parameters"] = {}
        
    # Format datetimes for JSON serialization
    if row_dict.get("created_at") and not isinstance(row_dict["created_at"], str):
        row_dict["created_at"] = row_dict["created_at"].isoformat()
    if row_dict.get("updated_at") and not isinstance(row_dict["updated_at"], str):
        row_dict["updated_at"] = row_dict["updated_at"].isoformat()
        
    return row_dict

def _fetch_report_target(entity_type: str, entity_id: int, db_session: Session) -> Dict[str, Any]:
    """Centralizes report entity queries to build download report actions."""
    if entity_type == "model":
        row = db_session.execute(
            text("SELECT id, name, algorithm_id, factory_id FROM models WHERE id = :mid"),
            {"mid": entity_id}
        ).fetchone()
        if row:
            return {
                "id": int(row.id),
                "name": row.name,
                "algorithm_id": int(row.algorithm_id) if row.algorithm_id else None,
                "factory_id": int(row.factory_id) if row.factory_id else None
            }
    elif entity_type == "algorithm":
        row = db_session.execute(
            text("SELECT id, name FROM algorithms WHERE id = :aid"),
            {"aid": entity_id}
        ).fetchone()
        if row:
            return {
                "id": int(row.id),
                "name": row.name
            }
    elif entity_type == "factory":
        row = db_session.execute(
            text("SELECT id, name FROM factories WHERE id = :fid"),
            {"fid": entity_id}
        ).fetchone()
        if row:
            return {
                "id": int(row.id),
                "name": row.name
            }
    return None

def _fetch_version_rows(
    model_id: int,
    db_session: Session,
    version_number: int = None,
    active_only: bool = False,
    latest_only: bool = False
) -> List[Dict[str, Any]]:
    """Deduplicates version retrieval queries for zip extraction and version comparisons."""
    sql = """
        SELECT mv.*, m.name as model_name, f.name as factory_name, a.name as algorithm_name, m.factory_id, m.algorithm_id
        FROM model_versions mv
        JOIN models m ON m.id = mv.model_id
        LEFT JOIN factories f ON f.id = m.factory_id
        LEFT JOIN algorithms a ON a.id = m.algorithm_id
        WHERE mv.model_id = :model_id
    """
    params = {"model_id": model_id}
    if active_only:
        sql += " AND mv.is_active = true"
    if version_number is not None:
        sql += " AND mv.version_number = :v_num"
        params["v_num"] = version_number
    
    if latest_only:
        sql += " ORDER BY mv.version_number DESC LIMIT 1"
    else:
        sql += " ORDER BY mv.version_number ASC"
        
    rows = db_session.execute(text(sql), params).fetchall()
    return [_enrich_version_row(row, db_session) for row in rows]

def _get_plan_from_llm(user_question: str, query_results: Dict[str, Any], context: List[Dict[str, Any]] = []) -> Dict[str, Any]:
    """Invokes the LLM to structure the requested UI Action."""
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

    prompt = f"""You are an Action Planner assistant for an MLOps platform repository.
{history_str}
Analyze the user's question, the conversation history, and any query results (provided in JSON format) to decide if the user wants to perform one of the following UI actions:
- "download_report": download a factory, algorithm, or model performance report (also triggered by "give me the report", "show report", etc.).
- "download_zip": download the zip code/dataset/weights bundle of a specific model version.
- "compare_versions": compare performance/metrics across models or versions of a model.
- "none": no specific action requested. Note: Aggregate, ranking, or analytical queries (e.g., "best", "most", "highest", "lowest", "top 5", or comparisons between completely different entity types like a factory and an algorithm) should result in action: "none".

Output ONLY a raw JSON object with the following schema:
{{
  "action": "download_report" | "download_zip" | "compare_versions" | "none",
  "entity_type": "model" | "algorithm" | "factory" | "version",
  "compare_scope": "models" | "versions" | null,
  "targets": [
    {{"name": "extracted entity name, e.g. R2+1D", "version": version_number_or_null}}
  ]
}}
Each target pairs an entity name with its version number (or null if unspecified).
Instructions for compare_scope:
- If action is "compare_versions" and the comparison is between different versions of the SAME model name (e.g. "compare v1 and v2 of R2+1D"), set compare_scope to "versions".
- If action is "compare_versions" and the comparison is between DIFFERENT models (e.g. "compare yolov11 and R2+1D", or yolov11 models in Beijing and Bhushan, or RF models in Sejong and Suwon), set compare_scope to "models".
- Otherwise, set compare_scope to null.
Examples:
- "compare v1 and v2 of R2+1D" -> action: "compare_versions", entity_type: "version", compare_scope: "versions", targets: [{{"name": "R2+1D", "version": 1}}, {{"name": "R2+1D", "version": 2}}]
- "download zip for yolov11 version 3" -> action: "download_zip", entity_type: "version", compare_scope: null, targets: [{{"name": "yolov11", "version": 3}}]
- "compare yolov11 and R2+1D" -> action: "compare_versions", entity_type: "model", compare_scope: "models", targets: [{{"name": "yolov11", "version": null}}, {{"name": "R2+1D", "version": null}}]
- "give me the report for R2+1D" -> action: "download_report", entity_type: "model", compare_scope: null, targets: [{{"name": "R2+1D", "version": null}}]
Do NOT write any explanations, do NOT wrap in markdown backticks, do NOT write ```json.

User Question: "{user_question}"
Query Results: {json.dumps(query_results, default=str)}

Output:"""

    raw_res = call_llm(prompt, temperature=0.0).strip()
    if raw_res.startswith("```json"):
        raw_res = raw_res[7:]
    if raw_res.startswith("```"):
        raw_res = raw_res[3:]
    if raw_res.endswith("```"):
        raw_res = raw_res[:-3]
    raw_res = raw_res.strip()
    
    plan = None
    try:
        if raw_res and raw_res != "__LLM_OFFLINE__":
            plan = json.loads(raw_res)
    except Exception as e:
        print(f"[ActionPlanner] Failed to parse action planner JSON: {e}")
        
    if not plan or not isinstance(plan, dict):
        plan = {
            "action": "none",
            "entity_type": "model",
            "compare_scope": None,
            "targets": []
        }
    return plan

def _resolve_targets(plan: Dict[str, Any], user_question: str, db_session: Session, context: List[Dict[str, Any]] = []) -> Dict[str, Any]:
    """Performs entity search and maps extracted properties using the plan schema."""
    action = plan.get("action", "none")
    entity_type = plan.get("entity_type")
    
    targets = plan.get("targets", [])
    entity_names = []
    version_numbers = []
    if targets and isinstance(targets, list):
        entity_names = list(dict.fromkeys(t.get("name") for t in targets if t.get("name")))
        version_numbers = [t.get("version") for t in targets if t.get("version") is not None]
        
    resolved = resolve_entities(user_question, db_session, context=context)
    models = resolved["models"]
    factories = resolved["factories"]
    algorithms = resolved["algorithms"]

    if models and action == "compare_versions":
        if len(set(m.name.lower() for m in models)) == 1 and (len(factories) < 2 or len(version_numbers) >= 2):
            matched_m = None
            if version_numbers:
                max_matches = -1
                for m in models:
                    cnt = db_session.execute(
                        text("SELECT COUNT(*) FROM model_versions WHERE model_id = :mid AND version_number IN :vnums"),
                        {"mid": m.id, "vnums": tuple(version_numbers)}
                    ).scalar()
                    if cnt > max_matches:
                        max_matches = cnt
                        matched_m = m
            if not matched_m and factories:
                fid = factories[0].id
                for m in models:
                    if m.factory_id == fid:
                        matched_m = m
                        break
            if matched_m:
                models = [matched_m]
            else:
                models = [models[0]]

    if (not models or len(factories) >= 2) and algorithms and action == "compare_versions":
        models = []
        for a in algorithms:
            assoc_models = db_session.execute(
                text("SELECT id, name, algorithm_id, factory_id FROM models WHERE algorithm_id = :aid"),
                {"aid": a.id}
            ).fetchall()
            models.extend(assoc_models)

    entity_type_plural = plan.get("compare_scope", "versions") or "versions"

    return {
        "action": action,
        "entity_type": entity_type,
        "entity_names": entity_names,
        "version_numbers": version_numbers,
        "models": models,
        "factories": factories,
        "algorithms": algorithms,
        "entity_type_plural": entity_type_plural
    }

def _build_report_action(
    entity_type: str,
    models: list,
    algorithms: list,
    factories: list,
    db_session: Session
) -> List[Dict[str, Any]]:
    """Builds download actions for reports."""
    actions = []
    if entity_type == "model" and models:
        m_full = _fetch_report_target("model", models[0].id, db_session)
        if m_full:
            actions.append({
                "type": "download",
                "label": f"Download Model Report: {m_full['name']}",
                "download_type": "report",
                "entity_type": "model",
                "entity_id": m_full["id"],
                "download_url": f"/algorithms/{m_full['algorithm_id']}/factories/{m_full['factory_id']}/models/{m_full['id']}/report"
            })
    elif entity_type == "algorithm" and algorithms:
        a_full = _fetch_report_target("algorithm", algorithms[0].id, db_session)
        if a_full:
            actions.append({
                "type": "download",
                "label": f"Download Algorithm Report: {a_full['name']}",
                "download_type": "report",
                "entity_type": "algorithm",
                "entity_id": a_full["id"],
                "download_url": f"/algorithms/{a_full['id']}/report"
            })
    elif entity_type == "factory" and factories:
        f_full = _fetch_report_target("factory", factories[0].id, db_session)
        if f_full:
            actions.append({
                "type": "download",
                "label": f"Download Factory Report: {f_full['name']}",
                "download_type": "report",
                "entity_type": "factory",
                "entity_id": f_full["id"],
                "download_url": f"/factories/{f_full['id']}/report"
            })
    elif models:
        m_full = _fetch_report_target("model", models[0].id, db_session)
        if m_full:
            actions.append({
                "type": "download",
                "label": f"Download Model Report: {m_full['name']}",
                "download_type": "report",
                "entity_type": "model",
                "entity_id": m_full["id"],
                "download_url": f"/algorithms/{m_full['algorithm_id']}/factories/{m_full['factory_id']}/models/{m_full['id']}/report"
            })
    return actions

def _build_zip_action(
    models: list,
    version_numbers: list,
    db_session: Session
) -> List[Dict[str, Any]]:
    """Builds zip package download links."""
    actions = []
    if not models:
        return actions
    m = models[0]
    v_row = None
    if version_numbers:
        rows = _fetch_version_rows(m.id, db_session, version_number=version_numbers[0])
        if rows:
            v_row = rows[0]
    if not v_row:
        rows = _fetch_version_rows(m.id, db_session, active_only=True)
        if rows:
            v_row = rows[0]
    if not v_row:
        rows = _fetch_version_rows(m.id, db_session, latest_only=True)
        if rows:
            v_row = rows[0]
            
    if v_row:
        arts = db_session.execute(
            text("SELECT type, COUNT(*) FROM artifacts WHERE version_id = :v_id GROUP BY type"),
            {"v_id": v_row["id"]}
        ).fetchall()
        available_types = {r[0]: r[1] for r in arts}
        
        if available_types:
            download_url = f"/algorithms/{m.algorithm_id}/factories/{m.factory_id}/models/{m.id}/versions/{v_row['id']}/download?dataset=true&labels=true&model=true&code=true"
            actions.append({
                "type": "download",
                "label": f"Download ZIP: {m.name} v{v_row['version_number']}",
                "download_type": "zip",
                "entity_type": "version",
                "entity_id": int(v_row["id"]),
                "download_url": download_url
            })
    return actions

def _build_compare_payload(
    models: list,
    version_numbers: list,
    entity_type_plural: str,
    q_lower: str,
    db_session: Session
) -> Dict[str, Any]:
    """Resolves and queries comparison payload for versions/models."""
    if not models:
        return None
    ver_rows = []
    if len(models) >= 2:
        for m in models:
            rows = _fetch_version_rows(m.id, db_session, active_only=True)
            if not rows:
                rows = _fetch_version_rows(m.id, db_session, latest_only=True)
            if rows:
                ver_rows.append(rows[0])
    else:
        m = models[0]
        if len(version_numbers) >= 2:
            for v_num in version_numbers:
                rows = _fetch_version_rows(m.id, db_session, version_number=v_num)
                if rows:
                    ver_rows.append(rows[0])
        else:
            ver_rows = _fetch_version_rows(m.id, db_session)
            
    if len(ver_rows) >= 2 or (len(ver_rows) >= 1 and any(kw in q_lower for kw in ["evolution", "compare", "comparison", "version comparison"])):
        model_name_val = models[0].name if len(models) == 1 else "Models"
        return {
            "versions": ver_rows,
            "data": ver_rows,
            "model_name": model_name_val,
            "has_multiple_models": len(models) >= 2,
            "entity_type": entity_type_plural,
            "resolved_model_names": [m.name for m in models]
        }
    return None

def plan_action(
    user_question: str,
    query_results: Dict[str, Any],
    db_session: Session,
    context: List[Dict[str, Any]] = []
) -> Dict[str, Any]:
    """
    Invokes the LLM to decide if a download/zip/compare action applies.
    Then builds the resolved action structure and returns it.
    """
    plan = _get_plan_from_llm(user_question, query_results, context=context)
    
    resolved_info = _resolve_targets(plan, user_question, db_session, context=context)
    action = resolved_info["action"]
    entity_type = resolved_info["entity_type"]
    version_numbers = resolved_info["version_numbers"]
    models = resolved_info["models"]
    factories = resolved_info["factories"]
    algorithms = resolved_info["algorithms"]
    entity_type_plural = resolved_info["entity_type_plural"]
    
    actions = []
    comp_payload = None
    
    if action == "download_report":
        actions = _build_report_action(entity_type, models, algorithms, factories, db_session)
    elif action == "download_zip":
        actions = _build_zip_action(models, version_numbers, db_session)
    elif action == "compare_versions":
        comp_payload = _build_compare_payload(models, version_numbers, entity_type_plural, user_question.lower(), db_session)
        
    return {
        "actions": actions,
        "comp_payload": comp_payload
    }
