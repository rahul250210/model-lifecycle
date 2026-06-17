import time
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.services.sql_agent import AliasCache, EntityExtractor, ContextMemory, resolve_context_rules
from app.services.schema_provider import SchemaProvider
from app.services.text_to_sql import generate_sql, regenerate_sql
from app.services.sql_validator import validate_sql
from app.services.query_executor import execute_query
from app.services.response_generator import generate_response

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
    
    # Check if download/report keywords are present
    download_keywords = ["download", "export", "report", "csv", "zip", "bundle", "weights", "file", "files", "artifact", "artifacts"]
    if not any(kw in q for kw in download_keywords):
        return actions
        
    rows = query_results.get("rows", [])
    if not rows:
        # Fallback 1: Check if the query asks for a ZIP / version bundle, we search for model/version in database
        is_zip_request = any(kw in q for kw in ["zip", "bundle", "weights", "export", "files"])
        if is_zip_request or "version" in q:
            models = db_session.execute(text("SELECT id, name FROM models")).fetchall()
            for m_id, m_name in models:
                if m_name.lower() in q:
                    import re
                    ver_num_match = re.search(r"\bversion\s*(\d+)\b|\bv\s*(\d+)\b", q)
                    if ver_num_match:
                        ver_num = int(ver_num_match.group(1) or ver_num_match.group(2))
                        res = db_session.execute(
                            text("""
                                SELECT mv.id, mv.version_number, m.id as model_id, m.name as model_name,
                                       f.id as factory_id, a.id as algorithm_id
                                FROM model_versions mv
                                JOIN models m ON m.id = mv.model_id
                                LEFT JOIN factories f ON f.id = m.factory_id
                                LEFT JOIN algorithms a ON a.id = m.algorithm_id
                                WHERE mv.model_id = :model_id AND mv.version_number = :ver_num
                                LIMIT 1
                            """),
                            {"model_id": m_id, "ver_num": ver_num}
                        ).fetchone()
                    else:
                        res = db_session.execute(
                            text("""
                                SELECT mv.id, mv.version_number, m.id as model_id, m.name as model_name,
                                       f.id as factory_id, a.id as algorithm_id
                                FROM model_versions mv
                                JOIN models m ON m.id = mv.model_id
                                LEFT JOIN factories f ON f.id = m.factory_id
                                LEFT JOIN algorithms a ON a.id = m.algorithm_id
                                WHERE mv.model_id = :model_id AND mv.is_active = true
                                LIMIT 1
                            """),
                            {"model_id": m_id}
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
                        return actions

        # Fallback 2: Check for specific entities by name in the query for report download
        factories = db_session.execute(text("SELECT id, name FROM factories")).fetchall()
        for f_id, f_name in factories:
            if f_name.lower() in q:
                actions.append({
                    "type": "download",
                    "label": f"Download Factory Report: {f_name}",
                    "download_type": "report",
                    "entity_type": "factory",
                    "entity_id": int(f_id),
                    "download_url": f"/chatbot/download-report?report_type=factory&factory_id={f_id}"
                })
                return actions
                
        algos = db_session.execute(text("SELECT id, name FROM algorithms")).fetchall()
        for a_id, a_name in algos:
            if a_name.lower() in q:
                actions.append({
                    "type": "download",
                    "label": f"Download Algorithm Report: {a_name}",
                    "download_type": "report",
                    "entity_type": "algorithm",
                    "entity_id": int(a_id),
                    "download_url": f"/chatbot/download-report?report_type=algorithm&algorithm_id={a_id}"
                })
                return actions
                
        models = db_session.execute(text("SELECT id, name FROM models")).fetchall()
        for m_id, m_name in models:
            if m_name.lower() in q:
                actions.append({
                    "type": "download",
                    "label": f"Download Model Report: {m_name}",
                    "download_type": "report",
                    "entity_type": "model",
                    "entity_id": int(m_id),
                    "download_url": f"/chatbot/download-report?report_type=model&model_id={m_id}"
                })
                ver_res = db_session.execute(
                    text("""
                        SELECT mv.id, mv.version_number, m.id as model_id, m.name as model_name,
                               f.id as factory_id, a.id as algorithm_id
                        FROM model_versions mv
                        JOIN models m ON m.id = mv.model_id
                        LEFT JOIN factories f ON f.id = m.factory_id
                        LEFT JOIN algorithms a ON a.id = m.algorithm_id
                        WHERE mv.model_id = :model_id AND mv.is_active = true
                        LIMIT 1
                    """),
                    {"model_id": m_id}
                ).fetchone()
                if ver_res:
                    download_url = f"/algorithms/{ver_res.algorithm_id}/factories/{ver_res.factory_id}/models/{ver_res.model_id}/versions/{ver_res.id}/download?dataset=true&labels=true&model=true&code=true"
                    actions.append({
                        "type": "download",
                        "label": f"Download ZIP: {ver_res.model_name} v{ver_res.version_number}",
                        "download_type": "zip",
                        "entity_type": "version",
                        "entity_id": int(ver_res.id),
                        "download_url": download_url
                    })
                return actions

        # Fallback 3: General keyword check
        if "factory" in q:
            actions.append({
                "type": "download",
                "label": "Download Factory Report (All)",
                "download_type": "report",
                "entity_type": "factory",
                "entity_id": 0,
                "download_url": "/chatbot/download-report?report_type=factory"
            })
        elif "algorithm" in q:
            actions.append({
                "type": "download",
                "label": "Download Algorithm Report (All)",
                "download_type": "report",
                "entity_type": "algorithm",
                "entity_id": 0,
                "download_url": "/chatbot/download-report?report_type=algorithm"
            })
        elif "model" in q:
            actions.append({
                "type": "download",
                "label": "Download Model Report (All)",
                "download_type": "report",
                "entity_type": "model",
                "entity_id": 0,
                "download_url": "/chatbot/download-report?report_type=model"
            })
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
            actions.append({
                "type": "download",
                "label": f"Download Model Report: {model_name}",
                "download_type": "report",
                "entity_type": "model",
                "entity_id": int(model_id),
                "download_url": f"/chatbot/download-report?report_type=model&model_id={model_id}"
            })
            
            # Offer active version ZIP for the model as well
            ver_res = db_session.execute(
                text("""
                    SELECT mv.id, mv.version_number, m.id as model_id, m.name as model_name,
                           f.id as factory_id, a.id as algorithm_id
                    FROM model_versions mv
                    JOIN models m ON m.id = mv.model_id
                    LEFT JOIN factories f ON f.id = m.factory_id
                    LEFT JOIN algorithms a ON a.id = m.algorithm_id
                    WHERE mv.model_id = :model_id AND mv.is_active = true
                    LIMIT 1
                """),
                {"model_id": model_id}
            ).fetchone()
            if ver_res:
                download_url = f"/algorithms/{ver_res.algorithm_id}/factories/{ver_res.factory_id}/models/{ver_res.model_id}/versions/{ver_res.id}/download?dataset=true&labels=true&model=true&code=true"
                actions.append({
                    "type": "download",
                    "label": f"Download ZIP: {ver_res.model_name} v{ver_res.version_number}",
                    "download_type": "zip",
                    "entity_type": "version",
                    "entity_id": int(ver_res.id),
                    "download_url": download_url
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
                "download_url": f"/chatbot/download-report?report_type=algorithm&algorithm_id={algo_id}"
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
                "download_url": f"/chatbot/download-report?report_type=factory&factory_id={factory_id}"
            })
            return actions

    # General fallback
    if "factory" in q:
        actions.append({
            "type": "download",
            "label": "Download Factory Report (All)",
            "download_type": "report",
            "entity_type": "factory",
            "entity_id": 0,
            "download_url": "/chatbot/download-report?report_type=factory"
        })
    elif "algorithm" in q:
        actions.append({
            "type": "download",
            "label": "Download Algorithm Report (All)",
            "download_type": "report",
            "entity_type": "algorithm",
            "entity_id": 0,
            "download_url": "/chatbot/download-report?report_type=algorithm"
        })
    elif "model" in q:
        actions.append({
            "type": "download",
            "label": "Download Model Report (All)",
            "download_type": "report",
            "entity_type": "model",
            "entity_id": 0,
            "download_url": "/chatbot/download-report?report_type=model"
        })

    return actions

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
    
    # 1. Initialize AliasCache and resolve context pronouns/entities
    AliasCache.initialize(db_session)
    extractor = EntityExtractor(db_session)
    context_memory = ContextMemory.build_from_context(context or [], extractor)
    resolved_question, _ = resolve_context_rules(user_question, context_memory)
    
    print(f"[ChatPipeline] User question: {user_question}")
    print(f"[ChatPipeline] Resolved question: {resolved_question}")
    
    # 2. Schema Provider
    schema_provider = SchemaProvider.from_session(db_session)
    schema_desc = schema_provider.get_detailed_schema()
    
    # 3. Text-to-SQL translation with self-correcting retry loop
    translation = generate_sql(resolved_question, schema_desc)
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
            validation_errors=validation["errors"]
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
    
    # 7. Dynamic Actions Generation
    actions = generate_dynamic_actions(resolved_question, query_results, db_session)
    print(f"[ChatPipeline] Generated dynamic actions: {actions}")
    
    duration_ms = int((time.time() - start_time) * 1000)
    print(f"[ChatPipeline] Completed pipeline in {duration_ms}ms")
    
    return {
        "response": final_answer,
        "answer": final_answer,
        "actions": actions,
        "type": "text",
        "confidence": 1.0
    }
