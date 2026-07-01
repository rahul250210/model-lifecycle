import time
import re
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.services.schema_provider import SchemaProvider
from app.services.text_to_sql import generate_sql, regenerate_sql
from app.services.sql_validator import validate_sql
from app.services.query_executor import execute_query
from app.services.response_generator import generate_response

# Relying 100% on LLM queries

# Dynamic metric extraction

def generate_dynamic_actions(
    user_question: str,
    query_results: Dict[str, Any],
    db_session: Session
) -> List[Dict[str, Any]]:
    """
    Dynamically generates download actions based on user query intent and SQL query results.
    """
    actions = []
    q = user_question.lower()
    
    rows = query_results.get("rows", [])
    if not rows:
        return actions

    first_row = rows[0]

    # 1. ARTIFACT DETECTION
    is_artifact = "checksum" in first_row or "file_path" in first_row or "artifact_id" in first_row or ("id" in first_row and ("path" in first_row or "size" in first_row or "artifact" in q))
    if is_artifact:
        for row in rows[:5]:
            art_id = row.get("artifact_id") or row.get("id")
            art_name = row.get("artifact_name") or row.get("name") or "Artifact"
            if art_id:
                actions.append({
                    "type": "download",
                    "label": f"Download Artifact: {art_name}",
                    "download_type": "artifact",
                    "entity_type": "artifact",
                    "entity_id": int(art_id),
                    "download_url": f"/artifacts/{art_id}/download"
                })
        return actions

    # 2. VERSION / ZIP DETECTION
    is_zip_request = any(kw in q for kw in ["zip", "bundle", "weights", "export", "files"])
    has_version = "version_id" in first_row or "version_number" in first_row or ("id" in first_row and ("version_number" in first_row or "is_active" in first_row or "accuracy" in first_row))
    
    if (is_zip_request or "version" in q) and has_version:
        for row in rows[:3]:
            version_id = row.get("version_id") or (row.get("id") if "version_number" in row or "is_active" in row else None)
            if version_id:
                res = db_session.execute(
                    text("""
                        SELECT mv.id, mv.version_number, m.id as model_id, m.name as model_name,
                               f.id as factory_id, a.id as algorithm_id
                        FROM model_versions mv
                        JOIN models m ON m.id = mv.model_id
                        LEFT JOIN factories f ON f.id = m.factory_id
                        LEFT JOIN algorithms a ON a.id = m.algorithm_id
                        WHERE mv.id = :version_id
                    """),
                    {"version_id": version_id}
                ).fetchone()
                
                if res:
                    download_url = f"/algorithms/{res.algorithm_id}/factories/{res.factory_id}/models/{res.model_id}/versions/{res.id}/download?dataset=true&labels=true&model=true&code=true"
                    actions.append({
                        "type": "download",
                        "label": f"Download ZIP: {res.model_name} v{res.version_number}",
                        "download_type": "zip",
                        "entity_type": "version",
                        "entity_id": int(res.id),
                        "download_url": download_url
                    })
        if actions:
            return actions

    # 3. REPORT DOWNLOAD DETECTION
    # Model check
    is_model_row = "model_id" in first_row or ("id" in first_row and ("framework" in first_row or "algorithm_id" in first_row or "model_name" in q))
    if is_model_row:
        model_id = first_row.get("model_id") or first_row.get("id")
        model_name = first_row.get("model_name") or first_row.get("name")
        if model_id:
            if not model_name:
                res = db_session.execute(text("SELECT name FROM models WHERE id = :id"), {"id": model_id}).fetchone()
                model_name = res[0] if res else f"Model {model_id}"
            
            # Model Report Action
            m_res = db_session.execute(
                text("SELECT algorithm_id, factory_id FROM models WHERE id = :id"),
                {"id": model_id}
            ).fetchone()
            if m_res:
                download_url = f"/algorithms/{m_res.algorithm_id}/factories/{m_res.factory_id}/models/{model_id}/report"
                actions.append({
                    "type": "download",
                    "label": f"Download Model Report: {model_name}",
                    "download_type": "report",
                    "entity_type": "model",
                    "entity_id": int(model_id),
                    "download_url": download_url
                })
            
            # Offer active version ZIP for the model as well
            if m_res:
                ver_res = db_session.execute(
                    text("""
                        SELECT mv.id, mv.version_number
                        FROM model_versions mv
                        WHERE mv.model_id = :model_id AND mv.is_active = true
                        LIMIT 1
                    """),
                    {"model_id": model_id}
                ).fetchone()
                if ver_res:
                    zip_url = f"/algorithms/{m_res.algorithm_id}/factories/{m_res.factory_id}/models/{model_id}/versions/{ver_res.id}/download?dataset=true&labels=true&model=true&code=true"
                    actions.append({
                        "type": "download",
                        "label": f"Download ZIP: {model_name} v{ver_res.version_number}",
                        "download_type": "zip",
                        "entity_type": "version",
                        "entity_id": int(ver_res.id),
                        "download_url": zip_url
                    })
            return actions

    # Algorithm check
    is_algo_row = "algorithm_id" in first_row or ("id" in first_row and ("description" in first_row and ("algorithm" in q or "algo" in q)))
    if is_algo_row:
        algo_id = first_row.get("algorithm_id") or first_row.get("id")
        algo_name = first_row.get("algo_name") or first_row.get("name")
        if algo_id:
            if not algo_name:
                res = db_session.execute(text("SELECT name FROM algorithms WHERE id = :id"), {"id": algo_id}).fetchone()
                algo_name = res[0] if res else f"Algorithm {algo_id}"
                
            actions.append({
                "type": "download",
                "label": f"Download Algorithm Report: {algo_name}",
                "download_type": "report",
                "entity_type": "algorithm",
                "entity_id": int(algo_id),
                "download_url": f"/algorithms/{algo_id}/report"
            })
            return actions

    # Factory check
    is_factory_row = "factory_id" in first_row or ("id" in first_row and ("location" in first_row or "factory" in q))
    if is_factory_row:
        factory_id = first_row.get("factory_id") or first_row.get("id")
        factory_name = first_row.get("factory_name") or first_row.get("name")
        if factory_id:
            if not factory_name:
                res = db_session.execute(text("SELECT name FROM factories WHERE id = :id"), {"id": factory_id}).fetchone()
                factory_name = res[0] if res else f"Factory {factory_id}"
                
            actions.append({
                "type": "download",
                "label": f"Download Factory Report: {factory_name}",
                "download_type": "report",
                "entity_type": "factory",
                "entity_id": int(factory_id),
                "download_url": f"/factories/{factory_id}/report"
            })
            return actions

    return actions

def _enrich_version_row(res, db_session: Session) -> Dict[str, Any]:
    row_dict = dict(res._mapping)
    # Query artifacts
    arts = db_session.execute(
        text("SELECT name, size, type FROM artifacts WHERE version_id = :v_id"),
        {"v_id": row_dict["id"]}
    ).fetchall()
    row_dict["artifacts"] = [{"name": art.name, "size": art.size, "type": art.type} for art in arts]
    
    # Ensure parameters is a clean dict
    import json
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

def generate_comparison_payload(
    user_question: str,
    query_results: Dict[str, Any],
    db_session: Session
) -> Optional[Dict[str, Any]]:
    """
    Dynamically generates comparison payload for charts and modals when comparison intent is present.
    """
    q = user_question.lower()
    rows = query_results.get("rows", [])
    full_rows = []
    
    # 1. Try to extract version IDs from the SQL query results
    version_ids = []
    for r in rows:
        v_id = r.get("version_id") or r.get("id")
        if v_id and ("version_number" in r or "accuracy" in r or "is_active" in r):
            try:
                version_ids.append(int(v_id))
            except (ValueError, TypeError):
                pass
                
    if len(version_ids) >= 2:
        for v_id in version_ids[:2]:
            res = db_session.execute(
                text("""
                    SELECT mv.*, m.name as model_name, f.name as factory_name, a.name as algorithm_name
                    FROM model_versions mv
                    JOIN models m ON m.id = mv.model_id
                    LEFT JOIN factories f ON f.id = m.factory_id
                    LEFT JOIN algorithms a ON a.id = m.algorithm_id
                    WHERE mv.id = :v_id
                """),
                {"v_id": v_id}
            ).fetchone()
            if res:
                full_rows.append(_enrich_version_row(res, db_session))

    # 2. Fallback lookup if we couldn't resolve from query results (matching model names)
    if len(full_rows) < 2:
        # Search the query for model names, sorted by length DESC to match longest first
        all_models = db_session.execute(
            text("SELECT id, name FROM models WHERE :q LIKE '%' || lower(name) || '%' ORDER BY length(name) DESC"),
            {"q": q}
        ).fetchall()
        matched_model_ids = []
        matched_model_names = []
        temp_q = q
        for m_id, m_name in all_models:
            name_lower = m_name.lower()
            if name_lower in temp_q:
                matched_model_ids.append(m_id)
                matched_model_names.append(m_name)
                temp_q = temp_q.replace(name_lower, "")
                
        fallback_rows = []
        if len(matched_model_ids) == 1:
            import re
            m_id = matched_model_ids[0]
            ver_nums = []
            for m in re.finditer(r"\bversion\s*(\d+)\b|\bv\s*(\d+)\b", q):
                val = m.group(1) or m.group(2)
                if val:
                    ver_nums.append(int(val))
                    
            if len(ver_nums) >= 2:
                for v_num in ver_nums[:2]:
                    res = db_session.execute(
                        text("""
                            SELECT mv.*, m.name as model_name, f.name as factory_name, a.name as algorithm_name
                            FROM model_versions mv
                            JOIN models m ON m.id = mv.model_id
                            LEFT JOIN factories f ON f.id = m.factory_id
                            LEFT JOIN algorithms a ON a.id = m.algorithm_id
                            WHERE mv.model_id = :model_id AND mv.version_number = :v_num
                            LIMIT 1
                        """),
                        {"model_id": m_id, "v_num": v_num}
                    ).fetchone()
                    if res:
                        fallback_rows.append(_enrich_version_row(res, db_session))
        elif len(matched_model_ids) >= 2:
            # Fetch the active or latest version for each model
            for m_id in matched_model_ids[:2]:
                res = db_session.execute(
                    text("""
                        SELECT mv.*, m.name as model_name, f.name as factory_name, a.name as algorithm_name
                        FROM model_versions mv
                        JOIN models m ON m.id = mv.model_id
                        LEFT JOIN factories f ON f.id = m.factory_id
                        LEFT JOIN algorithms a ON a.id = m.algorithm_id
                        WHERE mv.model_id = :model_id AND mv.is_active = true
                        LIMIT 1
                    """),
                    {"model_id": m_id}
                ).fetchone()
                if not res:
                    res = db_session.execute(
                        text("""
                            SELECT mv.*, m.name as model_name, f.name as factory_name, a.name as algorithm_name
                            FROM model_versions mv
                            JOIN models m ON m.id = mv.model_id
                            LEFT JOIN factories f ON f.id = m.factory_id
                            LEFT JOIN algorithms a ON a.id = m.algorithm_id
                            WHERE mv.model_id = :model_id
                            ORDER BY mv.version_number DESC
                            LIMIT 1
                        """),
                        {"model_id": m_id}
                    ).fetchone()
                if res:
                    fallback_rows.append(_enrich_version_row(res, db_session))
        if len(fallback_rows) >= 2:
            full_rows = fallback_rows

    # 2.1 Factory comparison fallback
    if len(full_rows) < 2:
        all_factories = db_session.execute(
            text("SELECT id, name FROM factories WHERE :q LIKE '%' || lower(name) || '%' ORDER BY length(name) DESC"),
            {"q": q}
        ).fetchall()
        matched_factory_ids = []
        matched_factory_names = []
        temp_q = q
        for f_id, f_name in all_factories:
            name_lower = f_name.lower()
            if name_lower in temp_q:
                matched_factory_ids.append(f_id)
                matched_factory_names.append(f_name)
                temp_q = temp_q.replace(name_lower, "")
                
        if len(matched_factory_ids) >= 2:
            factory_rows = []
            for f_id in matched_factory_ids[:2]:
                # Find active model versions for this factory
                res = db_session.execute(
                    text("""
                        SELECT mv.*, m.name as model_name, f.name as factory_name, a.name as algorithm_name
                        FROM model_versions mv
                        JOIN models m ON m.id = mv.model_id
                        LEFT JOIN factories f ON f.id = m.factory_id
                        LEFT JOIN algorithms a ON a.id = m.algorithm_id
                        WHERE m.factory_id = :factory_id AND mv.is_active = true
                        ORDER BY mv.version_number DESC
                        LIMIT 1
                    """),
                    {"factory_id": f_id}
                ).fetchone()
                if not res:
                    # Fallback to latest version in this factory
                    res = db_session.execute(
                        text("""
                            SELECT mv.*, m.name as model_name, f.name as factory_name, a.name as algorithm_name
                            FROM model_versions mv
                            JOIN models m ON m.id = mv.model_id
                            LEFT JOIN factories f ON f.id = m.factory_id
                            LEFT JOIN algorithms a ON a.id = m.algorithm_id
                            WHERE m.factory_id = :factory_id
                            ORDER BY mv.version_number DESC
                            LIMIT 1
                        """),
                        {"factory_id": f_id}
                    ).fetchone()
                if res:
                    factory_rows.append(_enrich_version_row(res, db_session))
            if len(factory_rows) >= 2:
                full_rows = factory_rows

    # 2.2 Algorithm comparison fallback
    if len(full_rows) < 2:
        all_algorithms = db_session.execute(
            text("SELECT id, name FROM algorithms WHERE :q LIKE '%' || lower(name) || '%' ORDER BY length(name) DESC"),
            {"q": q}
        ).fetchall()
        matched_algo_ids = []
        matched_algo_names = []
        temp_q = q
        for a_id, a_name in all_algorithms:
            name_lower = a_name.lower()
            if name_lower in temp_q:
                matched_algo_ids.append(a_id)
                matched_algo_names.append(a_name)
                temp_q = temp_q.replace(name_lower, "")
                
        if len(matched_algo_ids) >= 2:
            algo_rows = []
            for a_id in matched_algo_ids[:2]:
                # Find active model versions for this algorithm
                res = db_session.execute(
                    text("""
                        SELECT mv.*, m.name as model_name, f.name as factory_name, a.name as algorithm_name
                        FROM model_versions mv
                        JOIN models m ON m.id = mv.model_id
                        LEFT JOIN factories f ON f.id = m.factory_id
                        LEFT JOIN algorithms a ON a.id = m.algorithm_id
                        WHERE m.algorithm_id = :algorithm_id AND mv.is_active = true
                        ORDER BY mv.version_number DESC
                        LIMIT 1
                    """),
                    {"algorithm_id": a_id}
                ).fetchone()
                if not res:
                    # Fallback to latest version
                    res = db_session.execute(
                        text("""
                            SELECT mv.*, m.name as model_name, f.name as factory_name, a.name as algorithm_name
                            FROM model_versions mv
                            JOIN models m ON m.id = mv.model_id
                            LEFT JOIN factories f ON f.id = m.factory_id
                            LEFT JOIN algorithms a ON a.id = m.algorithm_id
                            WHERE m.algorithm_id = :algorithm_id
                            ORDER BY mv.version_number DESC
                            LIMIT 1
                        """),
                        {"algorithm_id": a_id}
                    ).fetchone()
                if res:
                    algo_rows.append(_enrich_version_row(res, db_session))
            if len(algo_rows) >= 2:
                full_rows = algo_rows

    # 3. Third-level fallback: if we have query rows but couldn't get IDs, search by model names
    if len(full_rows) < 2 and len(rows) >= 2:
        for r in rows:
            m_name = r.get("model_name") or r.get("name")
            v_num = r.get("version_number")
            if m_name and v_num is not None:
                res = db_session.execute(
                    text("""
                        SELECT mv.*, m.name as model_name, f.name as factory_name, a.name as algorithm_name
                        FROM model_versions mv
                        JOIN models m ON m.id = mv.model_id
                        LEFT JOIN factories f ON f.id = m.factory_id
                        LEFT JOIN algorithms a ON a.id = m.algorithm_id
                        WHERE m.name ILIKE :m_name AND mv.version_number = :v_num
                        LIMIT 1
                    """),
                    {"m_name": f"%{m_name}%", "v_num": int(v_num)}
                ).fetchone()
                if res:
                    full_rows.append(_enrich_version_row(res, db_session))
                    if len(full_rows) >= 2:
                        break

    if len(full_rows) < 2:
        return None

    rows = full_rows

    # Extract entity names from rows
    entities = []
    for i, r in enumerate(rows[:2]):
        e_name = r.get("model_name") or r.get("factory_name") or r.get("algorithm_name") or r.get("name")
        v_num = r.get("version_number")
        if e_name and v_num is not None:
            name = f"{e_name} v{v_num}"
        elif e_name:
            name = str(e_name)
        elif v_num is not None:
            name = f"Version {v_num}"
        else:
            name = f"Entity {i+1}"
        entities.append(name)

    exclude_keys = {
        "id", "version_id", "model_id", "factory_id", "algorithm_id", 
        "version_number", "is_active", "created_at", "updated_at", 
        "note", "description", "name", "model_name", "factory_name", 
        "algorithm_name", "framework"
    }

    metrics = []
    # Collect all unique columns present in the row dictionaries
    all_keys = set(rows[0].keys())
    if len(rows) > 1:
        all_keys.update(rows[1].keys())

    for col in sorted(all_keys):
        if col in exclude_keys:
            continue
            
        val1 = rows[0].get(col)
        val2 = rows[1].get(col) if len(rows) > 1 else None

        # Determine if values are numeric
        def is_numeric(v):
            if v is None:
                return False
            try:
                float(v)
                return True
            except (ValueError, TypeError):
                return False

        if is_numeric(val1) or is_numeric(val2):
            display_name = col.replace("_", " ").title()
            # Handle acronym casing
            if display_name == "Cpu Utilization":
                display_name = "CPU Utilization"
            elif display_name == "Gpu Utilization":
                display_name = "GPU Utilization"
            elif display_name == "Cpu Memory Usage":
                display_name = "CPU Memory Usage"
            elif display_name == "Gpu Memory Usage":
                display_name = "GPU Memory Usage"
            elif display_name == "F1 Score":
                display_name = "F1 Score"

            metrics.append({
                "name": display_name,
                "entity1": float(val1) if is_numeric(val1) else None,
                "entity2": float(val2) if is_numeric(val2) else None
            })

    if not metrics:
        return None

    title = f"{entities[0]} vs {entities[1]}"

    return {
        "response_type": "comparison",
        "show_compare": True,
        "comparison_title": title,
        "entities": entities,
        "metrics": metrics,
        "data": rows,
        "type": "comparison"
    }

def handle_download_interactive(q: str, context: Optional[List[Dict[str, Any]]], db_session: Session) -> Optional[Dict[str, Any]]:
    import re
    q = q.lower()
    
    last_bot_msg = None
    if context:
        for msg in reversed(context):
            if msg.get("role") == "bot":
                last_bot_msg = msg.get("content", "")
                break

    if last_bot_msg:
        match = re.search(r"<!-- DOWNLOAD_PROMPT: model_id=(\d+), version_id=(\d+), available=\{(.*?)\} -->", last_bot_msg)
        if match:
            model_id = int(match.group(1))
            version_id = int(match.group(2))
            available_str = match.group(3)
            available_types = {}
            if available_str.strip():
                for item in available_str.split(","):
                    if ":" in item:
                        k, v = item.split(":")
                        available_types[k.strip().replace("'", "").replace('"', '')] = int(v.strip())

            model_row = db_session.execute(
                text("SELECT id, name, algorithm_id, factory_id FROM models WHERE id = :id"),
                {"id": model_id}
            ).fetchone()
            version_row = db_session.execute(
                text("SELECT id, version_number FROM model_versions WHERE id = :id"),
                {"id": version_id}
            ).fetchone()

            if model_row and version_row:
                download_all = any(w in q for w in ["all", "everything", "whole", "complete", "both"])
                dataset_selected = download_all or any(w in q for w in ["dataset", "image", "images", "data"])
                labels_selected = download_all or any(w in q for w in ["label", "labels", "annotation", "annotations"])
                model_selected = download_all or any(w in q for w in ["model", "weights", "parameter", "parameters", "pt", "pth", "onnx", "engine"])
                code_selected = download_all or any(w in q for w in ["code", "script", "scripts", "py", "python", "src"])

                if not (dataset_selected or labels_selected or model_selected or code_selected):
                    dataset_selected = labels_selected = model_selected = code_selected = True

                selected_types_display = []
                params = {}

                if dataset_selected and "dataset" in available_types:
                    params["dataset"] = "true"
                    selected_types_display.append("Dataset")
                if labels_selected and "label" in available_types:
                    params["labels"] = "true"
                    selected_types_display.append("Labels")
                if model_selected and "model" in available_types:
                    params["model"] = "true"
                    selected_types_display.append("Model weights")
                if code_selected and "code" in available_types:
                    params["code"] = "true"
                    selected_types_display.append("Code")

                if not params:
                    if "dataset" in available_types:
                        params["dataset"] = "true"
                        selected_types_display.append("Dataset")
                    if "label" in available_types:
                        params["labels"] = "true"
                        selected_types_display.append("Labels")
                    if "model" in available_types:
                        params["model"] = "true"
                        selected_types_display.append("Model weights")
                    if "code" in available_types:
                        params["code"] = "true"
                        selected_types_display.append("Code")

                query_str = "&".join(f"{k}={v}" for k, v in params.items())
                download_url = f"/algorithms/{model_row.algorithm_id}/factories/{model_row.factory_id}/models/{model_row.id}/versions/{version_row.id}/download?{query_str}"

                components_str = ", ".join(selected_types_display)
                return {
                    "response": f"Here is the zip file export bundle for **{model_row.name}** (v{version_row.version_number}) containing the selected components: **{components_str}**.",
                    "answer": f"Here is the zip file export bundle for **{model_row.name}** (v{version_row.version_number}) containing the selected components: **{components_str}**.",
                    "actions": [{
                        "type": "download",
                        "label": f"Download ZIP: {model_row.name} v{version_row.version_number}",
                        "download_type": "zip",
                        "entity_type": "version",
                        "entity_id": int(version_row.id),
                        "download_url": download_url
                    }],
                    "download_url": download_url,
                    "model_name": model_row.name,
                    "version_number": version_row.version_number,
                    "type": "zip_download",
                    "confidence": 1.0
                }

    zip_kws = {"zip", "bundle", "export", "files", "weights"}
    is_zip_request = any(w in q for w in zip_kws)
    if is_zip_request and not ("report" in q):
        models = db_session.execute(
            text("SELECT id, name, algorithm_id, factory_id FROM models WHERE :q LIKE '%' || lower(name) || '%'"),
            {"q": q}
        ).fetchall()
        model_row = None
        for m in models:
            if re.search(r'\b' + re.escape(m.name.lower()) + r'\b', q):
                model_row = m
                break
                
        if model_row:
            version_row = None
            ver_num_match = re.search(r"\bversion\s*(\d+)\b|\bv\s*(\d+)\b", q)
            if ver_num_match:
                ver_num = int(ver_num_match.group(1) or ver_num_match.group(2))
                version_row = db_session.execute(
                    text("SELECT id, version_number FROM model_versions WHERE model_id = :model_id AND version_number = :version_number"),
                    {"model_id": model_row.id, "version_number": ver_num}
                ).fetchone()
            else:
                version_row = db_session.execute(
                    text("SELECT id, version_number FROM model_versions WHERE model_id = :model_id AND is_active = true"),
                    {"model_id": model_row.id}
                ).fetchone()
                if not version_row:
                    version_row = db_session.execute(
                        text("SELECT id, version_number FROM model_versions WHERE model_id = :model_id ORDER BY version_number DESC LIMIT 1"),
                        {"model_id": model_row.id}
                    ).fetchone()

            if not version_row:
                ver_str = f" v{ver_num}" if ver_num_match else ""
                return {
                    "response": f"I couldn't find version{ver_str} for model **{model_row.name}** in the repository.",
                    "answer": f"I couldn't find version{ver_str} for model **{model_row.name}** in the repository.",
                    "actions": [],
                    "type": "text",
                    "confidence": 1.0
                }

            artifacts_res = db_session.execute(
                text("SELECT type, COUNT(*) FROM artifacts WHERE version_id = :version_id GROUP BY type"),
                {"version_id": version_row.id}
            ).fetchall()

            available_types = {row[0]: row[1] for row in artifacts_res}

            if not available_types:
                return {
                    "response": f"There are no artifacts or files uploaded for **{model_row.name}** (v{version_row.version_number}) yet.",
                    "answer": f"There are no artifacts or files uploaded for **{model_row.name}** (v{version_row.version_number}) yet.",
                    "actions": [],
                    "type": "text",
                    "confidence": 1.0
                }

            summary_lines = []
            display_map = {
                "dataset": "Dataset",
                "label": "Labels",
                "model": "Model weights",
                "code": "Code"
            }

            for t, count in available_types.items():
                disp = display_map.get(t, t.capitalize())
                unit = "file" if count == 1 else "files"
                if t == "dataset":
                    unit = "image" if count == 1 else "images"
                summary_lines.append(f"- **{disp}**: {count} {unit}")

            summary_str = "\n".join(summary_lines)
            state_dict_str = ",".join(f"'{k}':{v}" for k, v in available_types.items())
            state_comment = f"<!-- DOWNLOAD_PROMPT: model_id={model_row.id}, version_id={version_row.id}, available={{{state_dict_str}}} -->"

            ans = (
                f"I found the following files uploaded for **{model_row.name}** (Version {version_row.version_number}):\n"
                f"{summary_str}\n\n"
                f"What components would you like to download? (e.g., 'dataset', 'weights', or 'all')\n"
                f"{state_comment}"
            )
            
            follow_ups = ["Download All Components"]
            for t in available_types:
                if t == "dataset":
                    follow_ups.append("Dataset only")
                elif t == "label":
                    follow_ups.append("Labels only")
                elif t == "model":
                    follow_ups.append("Weights only")
                elif t == "code":
                    follow_ups.append("Code only")

            return {
                "response": ans,
                "answer": ans,
                "actions": [],
                "follow_ups": follow_ups,
                "type": "text",
                "confidence": 1.0
            }
            
    return None

def generate_default_follow_ups(user_question: str) -> List[str]:
    all_suggestions = [
        "List all models",
        "List active versions",
        "Compare YOLOv11 and R2+1D",
        "Show top 5 models by accuracy",
        "What is precision and recall?",
        "List all factories",
        "List all algorithms"
    ]
    q = user_question.lower()
    words = [w for w in re.split(r'\W+', q) if len(w) > 3]
    filtered = []
    for sug in all_suggestions:
        sug_lower = sug.lower()
        if not any(w in sug_lower for w in words):
            filtered.append(sug)
    return filtered[:3]

def run_chat_pipeline(
    user_question: str,
    db_session: Session,
    context: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """
    Executes the unified dynamic Text-to-SQL chat pipeline.
    
    Workflow:
    User Query -> Context Resolution -> Schema Discovery -> Text-to-SQL (with retries)
               -> SQL Validation -> Query Execution -> Response Generation
               
    Returns:
        {
            "response": str (the conversational markdown answer),
            "answer": str (the conversational markdown answer),
            "actions": list (dynamic download actions),
            "type": "text",
            "confidence": float
        }
    """
    start_time = time.time()
    
    # Context and pronoun resolution is handled natively by the LLM prompts
    resolved_question = user_question
    
    print(f"[ChatPipeline] User question: {user_question}")
    print(f"[ChatPipeline] Resolved question: {resolved_question}")
    
    # Check for interactive zip download prompts first
    interactive_response = handle_download_interactive(resolved_question, context, db_session)
    if interactive_response:
        return interactive_response
    
    # 1.5 Query Routing Interceptor
    from app.services.query_router import route_query, handle_knowledge_query, handle_hybrid_query
    routing = route_query(resolved_question, db_session, context=context)
    q_type = routing.get("query_type", "DATABASE_QUERY")
    print(f"[ChatPipeline] Routed query type: {q_type} (Reason: {routing.get('explanation')})")
    
    if q_type == "KNOWLEDGE_QUERY":
        answer = handle_knowledge_query(resolved_question)
        if answer == "__LLM_OFFLINE__":
            answer = "⚠️ The AI service is currently rate-limited or offline. Please wait a few seconds and try again."
        return {
            "response": answer,
            "answer": answer,
            "actions": [],
            "type": "text",
            "confidence": 1.0
        }
        
    if q_type == "HYBRID_QUERY":
        answer = handle_hybrid_query(resolved_question, db_session)
        if answer == "__LLM_OFFLINE__":
            answer = "⚠️ The AI service is currently rate-limited or offline. Please wait a few seconds and try again."
        return {
            "response": answer,
            "answer": answer,
            "actions": [],
            "type": "text",
            "confidence": 1.0
        }
    
    # 2. Schema Provider
    schema_provider = SchemaProvider.from_session(db_session)
    schema_desc = schema_provider.get_pruned_schema(resolved_question)
    
    # 3. Text-to-SQL translation with self-correcting retry loop
    translation = generate_sql(resolved_question, schema_desc, context=context)
    generated_sql = translation.get("sql", "").strip()
    reasoning = translation.get("reasoning", "")
    
    print(f"[ChatPipeline] Initial Generated SQL: {generated_sql}")
    print(f"[ChatPipeline] Initial Reasoning: {reasoning}")
    
    # 4. SQL Validator with self-correction (up to 3 total validation attempts)
    validation = validate_sql(generated_sql, schema_provider)
    attempts = 1
    max_attempts = 3
    
    while not validation["valid"] and attempts < max_attempts:
        if not generated_sql:
            print("[ChatPipeline] Generated SQL is empty. Skipping retry.")
            break
            
        print(f"[ChatPipeline] Validation failed (Attempt {attempts}/{max_attempts}): {validation['errors']}")
        print("[ChatPipeline] Requesting SQL regeneration...")
        
        translation = regenerate_sql(
            user_query=resolved_question,
            schema_description=schema_desc,
            failed_sql=generated_sql,
            validation_errors=validation["errors"],
            context=context
        )
        generated_sql = translation.get("sql", "").strip()
        reasoning = translation.get("reasoning", "")
        attempts += 1
        
        print(f"[ChatPipeline] Regenerated SQL (Attempt {attempts}/{max_attempts}): {generated_sql}")
        print(f"[ChatPipeline] Reasoning: {reasoning}")
        
        validation = validate_sql(generated_sql, schema_provider)
        
    # 5. Query Executor (Only run if SQL is validated)
    if validation["valid"]:
        validated_sql = validation["sql"]
        print(f"[ChatPipeline] Executing validated SQL:\n{validated_sql}")
        try:
            query_results = execute_query(validated_sql, db_session)
        except Exception as e:
            print(f"[ChatPipeline] Query execution error: {e}")
            query_results = {"error": f"Database query execution failed: {str(e)}"}
    else:
        # SQL was rejected or empty. Skip execution.
        print(f"[ChatPipeline] SQL validation failed or no SQL generated: {validation['errors']}")
        validated_sql = ""
        query_results = {"error": ", ".join(validation["errors"])}
        
    # 6. Response Generator
    final_answer = generate_response(
        user_question=resolved_question,
        generated_sql=validated_sql or generated_sql,
        query_results=query_results
    )
    if final_answer == "__LLM_OFFLINE__":
        final_answer = "⚠️ The AI service is currently rate-limited or offline. Please wait a few seconds and try again."
    
    # 7. Dynamic Actions Generation
    actions = generate_dynamic_actions(resolved_question, query_results, db_session)
    print(f"[ChatPipeline] Generated dynamic actions: {actions}")
    
    # Suggest zip download if we generated a model report action
    has_model_report = any(a.get("download_type") == "report" and a.get("entity_type") == "model" for a in actions)
    has_zip = any(a.get("download_type") == "zip" for a in actions)
    if has_model_report and not has_zip:
        final_answer += "\n\n*(If you would also like to download the source files like weights or dataset for this model, just ask to download the ZIP file!)*"
    
    # 8. Dynamic Comparison Generation
    comp_payload = generate_comparison_payload(resolved_question, query_results, db_session)
    if comp_payload:
        print(f"[ChatPipeline] Generated comparison payload: {comp_payload}")
    
    duration_ms = int((time.time() - start_time) * 1000)
    print(f"[ChatPipeline] Completed pipeline in {duration_ms}ms")
    
    # 7.5 Check if we should elevate to a direct download response
    report_action = None
    if actions:
        for a in actions:
            if a.get("download_type") == "report":
                report_action = a
                break
                
    response_payload = {
        "response": final_answer,
        "answer": final_answer,
        "actions": actions,
        "follow_ups": generate_default_follow_ups(resolved_question),
        "type": "download" if report_action else "text",
        "confidence": 1.0
    }
    if report_action:
        response_payload.update({
            "report_type": report_action.get("entity_type"),
            "report_name": report_action.get("label").split(": ")[-1] if report_action.get("label") else "",
            "download_url": report_action.get("download_url")
        })
        if report_action.get("entity_type") == "model":
            m_id = report_action.get("entity_id")
            response_payload["model_id"] = m_id
            res_m = db_session.execute(text("SELECT algorithm_id, factory_id FROM models WHERE id = :id"), {"id": m_id}).fetchone()
            if res_m:
                response_payload["algorithm_id"] = res_m[0]
                response_payload["factory_id"] = res_m[1]
        elif report_action.get("entity_type") == "algorithm":
            response_payload["algorithm_id"] = report_action.get("entity_id")
        elif report_action.get("entity_type") == "factory":
            response_payload["factory_id"] = report_action.get("entity_id")
            
    if comp_payload:
        response_payload.update(comp_payload)
        
    return response_payload
