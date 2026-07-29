import json
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.services.llm_service import call_llm, parse_json_from_llm
from app.services.query_router import resolve_entities
from app.models.model import Model
from app.models.algorithm import Algorithm
from app.models.factory import Factory
from app.models.version import ModelVersion
from app.models.artifact import Artifact
from sqlalchemy.orm import joinedload

def _enrich_version_row(mv: ModelVersion) -> Dict[str, Any]:
    """Enriches a model version record with its associated artifacts."""
    row_dict = {}
    for col in mv.__table__.columns.keys():
        val = getattr(mv, col)
        row_dict[col] = val.isoformat() if hasattr(val, 'isoformat') else val
        
    # Map renames and defaults for UI compatibility
    row_dict["description"] = row_dict.pop("note", None)
    row_dict["metrics"] = row_dict.pop("resource_metrics", {}) or {}
    row_dict["parameters"] = row_dict.get("parameters") or {}
    
    # Attach relationship data
    row_dict["artifacts"] = [{"name": a.name, "size": a.size, "type": a.type} for a in mv.artifacts]
    row_dict["model_name"] = mv.model.name if mv.model else None
    row_dict["algorithm_id"] = mv.model.algorithm_id if mv.model else None
    row_dict["algorithm_name"] = mv.model.algorithm.name if mv.model and mv.model.algorithm else None
    row_dict["factory_id"] = mv.model.factory_id if mv.model else None
    row_dict["factory_name"] = mv.model.factory.name if mv.model and mv.model.factory else None
    
    return row_dict

def _fetch_report_target(entity_type: str, entity_id: int, db_session: Session) -> Dict[str, Any]:
    """Centralizes report entity queries to build download report actions."""
    if entity_type == "model":
        model = db_session.query(Model).get(entity_id)
        if model:
            return {
                "id": model.id,
                "name": model.name,
                "algorithm_id": model.algorithm_id,
                "factory_id": model.factory_id
            }
    elif entity_type == "algorithm":
        algo = db_session.query(Algorithm).get(entity_id)
        if algo:
            return {"id": algo.id, "name": algo.name}
    elif entity_type == "factory":
        factory = db_session.query(Factory).get(entity_id)
        if factory:
            return {"id": factory.id, "name": factory.name}
    return None

def _fetch_version_rows(
    model_id: int,
    db_session: Session,
    version_number: int = None,
    active_only: bool = False,
    latest_only: bool = False
) -> List[Dict[str, Any]]:
    """Deduplicates version retrieval queries for zip extraction and version comparisons."""
    query = db_session.query(ModelVersion).options(
        joinedload(ModelVersion.artifacts),
        joinedload(ModelVersion.model).joinedload(Model.algorithm),
        joinedload(ModelVersion.model).joinedload(Model.factory)
    ).filter(ModelVersion.model_id == model_id)
    
    if active_only:
        query = query.filter(ModelVersion.is_active == True)
    if version_number is not None:
        query = query.filter(ModelVersion.version_number == version_number)
        
    if latest_only:
        query = query.order_by(ModelVersion.version_number.desc()).limit(1)
    else:
        query = query.order_by(ModelVersion.version_number.asc())
        
    return [_enrich_version_row(v) for v in query.all()]

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
- "interactive_create": user wants to create, register, or link a new factory, algorithm, model, or version.
- "interactive_edit": user wants to edit/modify a factory, algorithm, model, or version.
- "interactive_delete": user wants to delete/remove a factory, algorithm, model, or version.
- "none": no specific action requested. Note: Aggregate, ranking, or analytical queries (e.g., "best", "most", "highest", "lowest", "top 5") should result in action: "none". Do not output "none" if the user is asking to download or compare specific entities, even if they specify the factory, algorithm, and model together.

Output ONLY a raw JSON object with the following schema:
{{
  "action": "download_report" | "download_zip" | "compare_versions" | "interactive_create" | "interactive_edit" | "interactive_delete" | "none",
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
- "give me the report for R2+1D" -> action: "download_report", entity_type: "model", compare_scope: null, targets: [{{"name": "R2+1D", "version": null}}]
- "create a new model" -> action: "interactive_create", entity_type: "model", compare_scope: null, targets: []
- "create a new version for YOLO" -> action: "interactive_create", entity_type: "version", compare_scope: null, targets: []
- "delete the FAS algorithm" -> action: "interactive_delete", entity_type: "algorithm", compare_scope: null, targets: [{{"name": "FAS", "version": null}}]
- "edit YOLOv11" -> action: "interactive_edit", entity_type: "model", compare_scope: null, targets: [{{"name": "YOLOv11", "version": null}}]
- "edit the description of algorithm X" -> action: "interactive_edit", entity_type: "algorithm", compare_scope: null, targets: [{{"name": "X", "version": null}}]
- "edit version 2 of YOLO" -> action: "interactive_edit", entity_type: "version", compare_scope: null, targets: [{{"name": "YOLO", "version": 2}}]
- "link the Facemask algorithm to the Sejong factory" -> action: "interactive_create", entity_type: "factory", compare_scope: null, targets: [{{"name": "Sejong", "version": null}}]
Do NOT write any explanations, do NOT wrap in markdown backticks, do NOT write ```json.

User Question: "{user_question}"
Query Results: {json.dumps(query_results, default=str)}

Output:"""

    raw_res = call_llm(prompt, temperature=0.0)
    
    plan = parse_json_from_llm(raw_res)
        
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

    if models:
        filtered_models = []
        for m in models:
            match_f = True
            match_a = True
            if factories and not any(f.id == m.factory_id for f in factories):
                match_f = False
            if algorithms and not any(a.id == m.algorithm_id for a in algorithms):
                match_a = False
            if match_f and match_a:
                filtered_models.append(m)
        if filtered_models:
            models = filtered_models

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

def _build_navigate_action(action: str, entity_type: str, models: list, algorithms: list, factories: list) -> List[Dict[str, Any]]:
    """Builds navigation actions for edit/delete operations."""
    actions = []
    
    if action == "interactive_create":
        actions.append({"type": "interactive_create", "entity_type": entity_type})
        
    elif action in ("navigate_edit", "navigate_delete"):
        intent = "edit" if action == "navigate_edit" else "delete"
        icon = "edit" if action == "navigate_edit" else "delete"
        prefix = "Edit" if action == "navigate_edit" else "Delete"
        
        if entity_type == "factory" and factories:
            for f in factories:
                # Assuming factory overview has edit/delete
                actions.append({"type": "navigate", "label": f"{prefix} {f.name}", "icon": icon, "path": f"/factories/{f.id}", "intent": intent})
        elif entity_type == "algorithm" and algorithms:
            for a in algorithms:
                actions.append({"type": "navigate", "label": f"{prefix} {a.name}", "icon": icon, "path": f"/algorithms/{a.id}/factories", "intent": intent})
        elif entity_type == "model" and models:
            for m in models:
                actions.append({"type": "navigate", "label": f"{prefix} {m.name}", "icon": icon, "path": f"/algorithms/{m.algorithm_id}/factories/{m.factory_id}/models/{m.id}", "intent": intent})
        # Note: version delete would link to the model overview where versions are listed
                
    return actions

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
    elif action in ("interactive_create", "navigate_edit", "navigate_delete"):
        actions = _build_navigate_action(action, entity_type, models, algorithms, factories)
        
    return {
        "action_type": action,
        "actions": actions,
        "comp_payload": comp_payload,
        "entity_type": entity_type
    }
