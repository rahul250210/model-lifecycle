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

def _resolve_targets(plan: Dict[str, Any], user_question: str, db_session: Session, context: List[Dict[str, Any]] = [], resolved_entities: Optional[Dict[str, List[Any]]] = None) -> Dict[str, Any]:
    """Performs entity search and maps extracted properties using the plan schema."""
    action = plan.get("action", "none")
    entity_type = plan.get("entity_type")
    
    targets = plan.get("targets", [])
    entity_names = []
    version_numbers = []
    if targets and isinstance(targets, list):
        entity_names = list(dict.fromkeys(t.get("name") for t in targets if t.get("name")))
        version_numbers = [t.get("version") for t in targets if t.get("version") is not None]
        
    resolved = resolved_entities or {"models": [], "factories": [], "algorithms": []}
    models = resolved.get("models", [])
    factories = resolved.get("factories", [])
    algorithms = resolved.get("algorithms", [])

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
    # If they explicitly ask for versions, fetch all versions for all matched models
    if entity_type_plural == "versions":
        for m in models:
            if len(version_numbers) >= 2:
                for v_num in version_numbers:
                    rows = _fetch_version_rows(m.id, db_session, version_number=v_num)
                    if rows:
                        ver_rows.extend(rows)
            else:
                rows = _fetch_version_rows(m.id, db_session)
                if rows:
                    ver_rows.extend(rows)
    else:
        # Comparing models (fetch active/latest version for each model)
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
                        ver_rows.extend(rows)
            else:
                rows = _fetch_version_rows(m.id, db_session)
                if rows:
                    ver_rows.extend(rows)
            
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

def build_action_payload(
    plan: Dict[str, Any],
    user_question: str,
    db_session: Session,
    context: List[Dict[str, Any]] = [],
    resolved_entities: Optional[Dict[str, List[Any]]] = None
) -> Dict[str, Any]:
    """
    Takes the action plan from the Master Analyst and builds the resolved UI payload structure.
    """
    if not plan or not isinstance(plan, dict):
        plan = {
            "action": "none",
            "entity_type": "model",
            "compare_scope": None,
            "targets": []
        }
        
    resolved_info = _resolve_targets(plan, user_question, db_session, context=context, resolved_entities=resolved_entities)
    action = resolved_info["action"]
    entity_type = resolved_info["entity_type"]
    version_numbers = resolved_info["version_numbers"]
    models = resolved_info["models"]
    factories = resolved_info["factories"]
    algorithms = resolved_info["algorithms"]
    entity_type_plural = resolved_info["entity_type_plural"]
    
    # Ambiguity detection for identical model names across multiple algorithms/factories
    if action in ("compare_versions", "download_report", "download_zip") and len(models) >= 2:
        model_names = set(m.name.lower() for m in models)
        if len(model_names) == 1 and len(factories) == 0 and len(algorithms) == 0:
            m_name = models[0].name
            return {
                "action_type": "ask_context",
                "response": f"I found multiple models named **{m_name}** across different factories. Which specific factory or algorithm would you like to compare?",
                "actions": [],
                "comp_payload": None
            }

    actions = []
    comp_payload = None
    
    if action == "download_report":
        actions = _build_report_action(entity_type, models, algorithms, factories, db_session)
    elif action == "download_zip":
        actions = _build_zip_action(models, version_numbers, db_session)
    elif action == "compare_versions":
        comp_payload = _build_compare_payload(models, version_numbers, entity_type_plural, user_question.lower(), db_session)
    elif action in ("interactive_create", "interactive_edit", "interactive_delete"):
        return {
            "action_type": action,
            "entity_type": entity_type,
            "actions": [],
            "comp_payload": None
        }
        
    return {
        "action_type": action,
        "actions": actions,
        "comp_payload": comp_payload,
        "entity_type": entity_type
    }
