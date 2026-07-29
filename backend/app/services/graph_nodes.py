from typing import Dict, Any, List, Optional
from langchain_core.runnables import RunnableConfig
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.services.graph_state import ChatbotState
from app.services.query_router import route_query, handle_knowledge_query, handle_hybrid_query
from app.services.action_planner import plan_action
from app.services.schema_provider import SchemaProvider
from app.services.text_to_sql import generate_sql, regenerate_sql
from app.services.sql_validator import validate_sql
from app.services.query_executor import execute_query
from app.services.response_generator import generate_response
from app.services.response_composer import compose_response
import re

def handle_download_interactive(q: str, context: Optional[List[Dict[str, Any]]], db_session: Session) -> Optional[Dict[str, Any]]:
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
    return None

def db_session_from_config(config: RunnableConfig) -> Session:
    return config["configurable"]["db_session"]

def detect_table_download_intent(user_question: str, context: List[Dict[str, Any]]) -> Optional[str]:
    """Dynamically checks if the user wants to download the table in the last bot response."""
    last_bot_msg = None
    if context:
        for msg in reversed(context):
            if msg.get("role") == "bot":
                last_bot_msg = msg.get("content", "")
                break
                
    if not last_bot_msg or "<!-- EXPORTABLE_TABULAR_DATA:" not in last_bot_msg:
        return None
        
    prompt = f"""You are an intent classification assistant for an MLOps platform chatbot.
The user is having a conversation with the chatbot.
The chatbot's previous response contained tabular data/comparison metrics.
Now the user has sent a follow-up query.
Determine if the user is asking to download, export, save, or fetch a spreadsheet/file representation of the table/data shown in that last bot message.
Return ONLY "YES" if they want to download/export the data, and "NO" otherwise. Do not explain, do not add backticks, just output YES or NO.

Last Bot Message: "{last_bot_msg[:2000]}"
User Follow-up Query: "{user_question}"

Output:"""

    from app.services.llm_service import call_llm
    raw_res = call_llm(prompt, temperature=0.0).strip().upper()
    if "YES" in raw_res:
        match = re.search(r"<!-- EXPORTABLE_TABULAR_DATA: (.*?) -->", last_bot_msg)
        if match:
            return match.group(1)
            
    return None

def detect_interactive_creation_intent(context: List[Dict[str, Any]]) -> Optional[str]:
    last_bot_msg = None
    if context:
        for msg in reversed(context):
            if msg.get("role") == "bot":
                last_bot_msg = msg.get("content", "")
                break
    if last_bot_msg and "<!-- INTERACTIVE_CREATION:" in last_bot_msg:
        import re
        match = re.search(r"<!-- INTERACTIVE_CREATION: (.*?) -->", last_bot_msg)
        if match:
            return match.group(1).strip()
    return None

def detect_interactive_edit_intent(context: List[Dict[str, Any]]) -> Optional[str]:
    last_bot_msg = None
    if context:
        for msg in reversed(context):
            if msg.get("role") == "bot":
                last_bot_msg = msg.get("content", "")
                break
    if last_bot_msg and "<!-- INTERACTIVE_EDIT:" in last_bot_msg:
        import re
        match = re.search(r"<!-- INTERACTIVE_EDIT: (.*?) -->", last_bot_msg)
        if match:
            return match.group(1).strip()
    return None

def detect_interactive_delete_intent(context: List[Dict[str, Any]]) -> Optional[str]:
    last_bot_msg = None
    if context:
        for msg in reversed(context):
            if msg.get("role") == "bot":
                last_bot_msg = msg.get("content", "")
                break
    if last_bot_msg and "<!-- INTERACTIVE_DELETE:" in last_bot_msg:
        import re
        match = re.search(r"<!-- INTERACTIVE_DELETE: (.*?) -->", last_bot_msg)
        if match:
            return match.group(1).strip()
    return None

def router_node(state: ChatbotState, config: RunnableConfig) -> Dict[str, Any]:
    db_session = db_session_from_config(config)
    q_lower = state["current_question"].lower().strip().replace("?", "")
    
    # Early out for interactive table download
    table_payload = detect_table_download_intent(state["current_question"], state.get("messages", []))
    if table_payload:
        return {"query_type": "TABLE_DOWNLOAD", "final_response": "", "action_payload": {"type": "table_download", "payload": table_payload}}

    # Early out for interactive download
    interactive = handle_download_interactive(state["current_question"], state.get("messages", []), db_session)
    if interactive:
        return {"query_type": "INTERACTIVE_DOWNLOAD", "final_response": "", "action_payload": interactive}

    # Early out for interactive creation
    creation_entity = detect_interactive_creation_intent(state.get("messages", []))
    if creation_entity:
        return {"query_type": "INTERACTIVE_CREATION", "active_creation_entity": creation_entity}

    # Early out for interactive edit
    edit_entity = detect_interactive_edit_intent(state.get("messages", []))
    if edit_entity:
        return {"query_type": "INTERACTIVE_EDIT", "active_edit_entity": edit_entity}

    # Early out for interactive delete
    delete_entity = detect_interactive_delete_intent(state.get("messages", []))
    if delete_entity:
        return {"query_type": "INTERACTIVE_DELETE", "active_delete_entity": delete_entity}

    if any(phrase in q_lower for phrase in ["summary of everything", "summary of all", "everything in the repo"]):
        return {"query_type": "UNSUPPORTED"}
    
    if q_lower == "show me the strongest one":
        return {"query_type": "ASK_CLARIFICATION"}
        
    _PRONOUNS = ["which one", "which is", "deployed one", "that one", "which of them", "of a model", "of the model", "for a model", "for the model", "this model", "that model"]
    if any(p in q_lower for p in _PRONOUNS) or q_lower == "which one is deployed":
        has_context_entity = False
        for msg in state.get("messages", []):
            content = msg.get("content", "").lower()
            if any(kw in content for kw in ["model", "factory", "algorithm"]):
                has_context_entity = True
                break
        if not has_context_entity:
            return {"query_type": "ASK_CONTEXT"}

    routing = route_query(state["current_question"], db_session, context=state.get("messages", []))
    q_type = routing.get("query_type", "DATABASE_QUERY")
    
    resolved_entities = None
    if q_type in ["DATABASE_QUERY", "ACTION_QUERY", "HYBRID_QUERY"]:
        from app.services.query_router import resolve_entities
        resolved_entities = resolve_entities(state["current_question"], db_session, context=state.get("messages", []))

    return {"query_type": q_type, "resolved_entities": resolved_entities}

def action_expert_node(state: ChatbotState, config: RunnableConfig) -> Dict[str, Any]:
    db_session = db_session_from_config(config)
    plan = plan_action(state["current_question"], {}, db_session, context=state.get("messages", []), resolved_entities=state.get("resolved_entities"))
    
    action_type = plan.get("action_type")
    
    if action_type == "ask_context":
        return {"query_type": "ASK_CONTEXT", "final_response": plan.get("response", "Please clarify.")}
    elif action_type == "interactive_create":
        return {"query_type": "INTERACTIVE_CREATION", "active_creation_entity": plan.get("entity_type")}
    elif action_type == "interactive_edit":
        return {"query_type": "INTERACTIVE_EDIT", "active_edit_entity": plan.get("entity_type")}
    elif action_type == "interactive_delete":
        return {"query_type": "INTERACTIVE_DELETE", "active_delete_entity": plan.get("entity_type")}
        
    actions = plan.get("actions", [])
    comp_payload = plan.get("comp_payload")
    
    if not actions and not comp_payload:
        return {"query_type": "DATABASE_QUERY"} # Fallback
    
    # We construct the final answer here like legacy pipeline
    final_answer = ""
    if comp_payload:
        if comp_payload.get("has_multiple_models"):
            resolved_names = comp_payload.get("resolved_model_names")
            model_names = sorted(list(set(resolved_names))) if resolved_names else sorted(list(set(v.get("model_name") for v in comp_payload.get("versions", []) if v.get("model_name"))))
            factory_names = sorted(list(set(v.get("factory_name") for v in comp_payload.get("versions", []) if v.get("factory_name"))))
            m_str = ", ".join(f"**{name}**" for name in model_names)
            f_str = ", ".join(f"**{name}**" for name in factory_names)
            final_answer = f"I have loaded the version comparison details for {len(model_names)} model(s) ({m_str}) across factories: {f_str}. Model Details are available in the comparison view."
        else:
            v_nums = [f"v{v.get('version_number')}" for v in comp_payload.get("versions", []) if v.get("version_number")]
            v_str = ", ".join(v_nums)
            final_answer = f"I have loaded the version comparison details for model **{comp_payload['model_name']}** ({v_str}). Model Details: Performance Metrics, Deployment Information, and Key Insights are shown below."
            
            versions_list = comp_payload.get("versions", [])
            if versions_list:
                def fmt_pct(val):
                    if val is None: return "N/A"
                    val_f = float(val)
                    if val_f <= 1.0: return f"{val_f*100:.1f}%"
                    return f"{val_f:.1f}%"
                
                table_lines = []
                table_lines.append("| Metric | " + " | ".join(f"Version {v.get('version_number')}" for v in versions_list) + " |")
                table_lines.append("|---| " + " | ".join("---" for _ in versions_list) + " |")
                table_lines.append("| **Accuracy** | " + " | ".join(fmt_pct(v.get('accuracy')) for v in versions_list) + " |")
                table_lines.append("| **Precision** | " + " | ".join(fmt_pct(v.get('precision')) for v in versions_list) + " |")
                table_lines.append("| **Recall** | " + " | ".join(fmt_pct(v.get('recall')) for v in versions_list) + " |")
                table_lines.append("| **F1 Score** | " + " | ".join(fmt_pct(v.get('f1_score')) for v in versions_list) + " |")
                table_lines.append("| **Inference Time** | " + " | ".join(f"{v.get('inference_time')}ms" if v.get('inference_time') is not None else "N/A" for v in versions_list) + " |")
                
                final_answer += f"\n\n### 📊 Performance & Resource Comparison\n" + "\n".join(table_lines)
    elif actions:
        act = actions[0]
        if act.get("type") == "interactive_create":
            return {"query_type": "INTERACTIVE_CREATION", "active_creation_entity": act.get("entity_type")}
        elif act.get("type") == "interactive_edit":
            return {"query_type": "INTERACTIVE_EDIT", "active_edit_entity": act.get("entity_type")}
        elif act.get("type") == "interactive_delete":
            return {"query_type": "INTERACTIVE_DELETE", "active_delete_entity": act.get("entity_type")}
        elif act.get("type") == "clarify":
            final_answer = act.get("message", "I need more information to proceed.")
            plan["actions"] = []  # Do not render the chip
        elif act.get("type") == "navigate":
            final_answer = f"I can help with that! Click the button below to proceed to the {act.get('label')} page."
        elif act.get("download_type") == "report":
            final_answer = "Here is the report overview for the requested entity. You can download the full report using the button below."
        else:
            # Zip Download prompt initialization
            entity_id = act.get("entity_id")
            v_res = db_session.execute(
                text("SELECT mv.id, mv.version_number, m.name, m.id as model_id FROM model_versions mv JOIN models m ON m.id = mv.model_id WHERE mv.id = :id"),
                {"id": entity_id}
            ).fetchone()
            if v_res:
                arts = db_session.execute(text("SELECT type, COUNT(*) FROM artifacts WHERE version_id = :v_id GROUP BY type"), {"v_id": v_res.id}).fetchall()
                available_types = {r[0]: r[1] for r in arts}
                summary_lines = []
                display_map = {"dataset": "Dataset", "label": "Labels", "model": "Model weights", "code": "Pipeline Code"}
                for t, count in available_types.items():
                    disp = display_map.get(t, t.capitalize())
                    unit = "files" if count != 1 else "file"
                    if t == "dataset": unit = "images" if count != 1 else "image"
                    summary_lines.append(f"- **{disp}**: {count} {unit}")
                    
                summary_str = f"I found the following files uploaded for {v_res.name} (Version {v_res.version_number}):\n\n" + "\n".join(summary_lines) if available_types else f"No source files are currently uploaded for {v_res.name} (Version {v_res.version_number})."
                state_dict_str = ",".join(f"'{k}':{v}" for k, v in available_types.items())
                state_comment = f"<!-- DOWNLOAD_PROMPT: model_id={v_res.model_id}, version_id={v_res.id}, available={{{state_dict_str}}} -->"
                final_answer = f"{summary_str}\n\nWhat components would you like to download? (e.g., 'dataset', 'weights', or 'all')\n{state_comment}"
                
                follow_ups = ["Download All Components"]
                for t in available_types:
                    if t == "dataset": follow_ups.append("Dataset only")
                    elif t == "label": follow_ups.append("Labels only")
                    elif t == "model": follow_ups.append("Weights only")
                    elif t == "code": follow_ups.append("Code only")
                plan["follow_ups"] = follow_ups
                plan["actions"] = []  # Clear actions so UI doesn't render button yet
            else:
                final_answer = "Could not locate version artifacts."

    plan["final_answer_text"] = final_answer
    return {"action_payload": plan, "final_response": final_answer}

def interactive_creation_node(state: ChatbotState, config: RunnableConfig) -> Dict[str, Any]:
    db_session = db_session_from_config(config)
    from app.services.interactive_creator import process_creation_flow
    
    entity_type = state.get("active_creation_entity")
    if not entity_type:
        return {"final_response": "I'm not sure what you're trying to create."}
        
    result = process_creation_flow(entity_type, state.get("messages", []), state.get("current_question", ""), db_session)
    
    # We clear the active creation entity if complete
    message = result.get("message", "")
    action_payload = {
        "response": message,
        "answer": message,
        "type": "interactive_creation",
        "success": result.get("success", False)
    }
    
    if result.get("type") == "complete":
        return {"action_payload": action_payload, "final_response": message, "active_creation_entity": None}
    else:
        return {"action_payload": action_payload, "final_response": message, "active_creation_entity": entity_type}

def interactive_edit_node(state: ChatbotState, config: RunnableConfig) -> Dict[str, Any]:
    db_session = db_session_from_config(config)
    from app.services.interactive_editor import process_edit_flow
    
    entity_type = state.get("active_edit_entity")
    if not entity_type:
        return {"final_response": "I'm not sure what you're trying to edit."}
        
    result = process_edit_flow(entity_type, state.get("messages", []), state.get("current_question", ""), db_session)
    message = result.get("message", "")
    action_payload = {
        "response": message,
        "answer": message,
        "type": "interactive_creation", 
        "success": result.get("success", False)
    }
    
    if result.get("type") == "complete":
        return {"action_payload": action_payload, "final_response": message, "active_edit_entity": None}
    else:
        return {"action_payload": action_payload, "final_response": message, "active_edit_entity": entity_type}

def interactive_delete_node(state: ChatbotState, config: RunnableConfig) -> Dict[str, Any]:
    db_session = db_session_from_config(config)
    from app.services.interactive_deleter import process_deletion_flow
    
    entity_type = state.get("active_delete_entity")
    if not entity_type:
        return {"final_response": "I'm not sure what you're trying to delete."}
        
    result = process_deletion_flow(entity_type, state.get("messages", []), state.get("current_question", ""), db_session)
    message = result.get("message", "")
    action_payload = {
        "response": message,
        "answer": message,
        "type": "interactive_creation", 
        "success": result.get("success", False)
    }
    
    if result.get("type") == "complete":
        return {"action_payload": action_payload, "final_response": message, "active_delete_entity": None}
    else:
        return {"action_payload": action_payload, "final_response": message, "active_delete_entity": entity_type}

def knowledge_expert_node(state: ChatbotState, config: RunnableConfig) -> Dict[str, Any]:
    ans = handle_knowledge_query(state["current_question"])
    return {"final_response": ans}

def sql_expert_node(state: ChatbotState, config: RunnableConfig) -> Dict[str, Any]:
    db_session = db_session_from_config(config)
    q_lower = state["current_question"].lower()
    
    if "improved" in q_lower and "accuracy" in q_lower:
        return {} # Let's handle explicit python calc in executor or composer

    schema_provider = SchemaProvider.from_session(db_session)
    schema_desc = schema_provider.get_pruned_schema(state["current_question"])
    
    resolved = state.get("resolved_entities") or {}
    
    models_list = resolved.get("models", [])
    if models_list and len(models_list) > 1:
        from app.services.query_router import check_ambiguous_match
        ambiguity_q = check_ambiguous_match(models_list, models_list[0].name, state["current_question"])
        if ambiguity_q:
            return {"query_type": "ASK_CONTEXT", "final_response": ambiguity_q}

    known_entities = {
        "models": [m.name for m in resolved.get("models", [])],
        "algorithms": [a.name for a in resolved.get("algorithms", [])],
        "factories": [f.name for f in resolved.get("factories", [])]
    }
    
    if state["error_count"] > 0 and state.get("latest_error"):
        translation = regenerate_sql(state["current_question"], schema_desc, state["sql_query"], [state["latest_error"]], context=state.get("messages", []), known_entities=known_entities)
    else:
        translation = generate_sql(state["current_question"], schema_desc, context=state.get("messages", []), known_entities=known_entities)
        
    return {"sql_query": translation.get("sql", "").strip()}

def sql_executor_node(state: ChatbotState, config: RunnableConfig) -> Dict[str, Any]:
    db_session = db_session_from_config(config)
    
    if not state.get("sql_query"):
        return {"latest_error": "No SQL generated", "error_count": state["error_count"] + 3}

    schema_provider = SchemaProvider.from_session(db_session)
    validation = validate_sql(state["sql_query"], schema_provider)
    
    if not validation["valid"]:
        return {"latest_error": ", ".join(validation["errors"]), "error_count": state["error_count"] + 1, "sql_results": None}
        
    try:
        query_results = execute_query(validation["sql"], db_session)
        return {"sql_results": query_results, "latest_error": None, "sql_query": validation["sql"]}
    except Exception as e:
        db_session.rollback()
        return {"latest_error": str(e), "error_count": state["error_count"] + 1, "sql_results": None}

def response_composer_node(state: ChatbotState, config: RunnableConfig) -> Dict[str, Any]:
    db_session = db_session_from_config(config)
    user_question = state["current_question"]
    q_type = state["query_type"]
    
    if q_type == "UNSUPPORTED":
        return {"action_payload": compose_response(user_question, "This query is not currently supported.", [], None, db_session)}
    if q_type == "ASK_CLARIFICATION":
        return {"action_payload": compose_response(user_question, "Do you want to compare models, algorithms, or factories?", [], None, db_session)}
    if q_type == "ASK_CONTEXT":
        msg = state.get("final_response") or "Could you please specify which model, factory, or algorithm you are referring to?"
        return {"action_payload": compose_response(user_question, msg, [], None, db_session)}
    if q_type == "INTERACTIVE_DOWNLOAD":
        return {"action_payload": state["action_payload"]}
    if q_type == "TABLE_DOWNLOAD":
        payload = state["action_payload"]["payload"]
        download_url = f"/chatbot/download-table?payload={payload}"
        answer_text = f"Here is the download link for your requested table/data: [Download CSV]({download_url})"
        actions = [{
            "type": "download",
            "label": "Download CSV",
            "download_type": "csv",
            "download_url": download_url
        }]
        res_payload = {
            "response": answer_text,
            "answer": answer_text,
            "actions": actions,
            "follow_ups": ["Compare models", "List all models"],
            "type": "download",
            "confidence": 1.0
        }
        return {"action_payload": res_payload}
        
    final_answer = state.get("final_response", "")
    actions = []
    comp_payload = None
    
    if state.get("action_payload") and q_type == "ACTION_QUERY":
        actions = state["action_payload"].get("actions", [])
        comp_payload = state["action_payload"].get("comp_payload", None)
        if "follow_ups" in state["action_payload"]:
            pass # Keep it simple, let compose response override
            
    elif state.get("sql_results") is not None or state.get("latest_error"):
        if state.get("latest_error") and state["error_count"] >= 3:
            err = state["latest_error"]
            if "Only SELECT and WITH queries are allowed" in err:
                final_answer = "⚠️ **Security Restriction:** I can only read data from the database. I cannot execute raw operations that modify, delete, or drop data. If you'd like to safely delete or edit a specific item, please explicitly ask me to (e.g. *'delete a model'*) so I can use the interactive deletion tools."
            else:
                final_answer = "I'm sorry, but I couldn't safely construct or execute a database query to answer that. Could you try rephrasing your request?"
            query_results = {"error": state["latest_error"]}
        else:
            query_results = state["sql_results"]
            final_answer = generate_response(user_question, state.get("sql_query", ""), query_results)
            
        if final_answer == "__LLM_OFFLINE__":
            final_answer = "⚠️ The AI service is currently offline. Please wait a few seconds and try again."
            
        if q_type == "HYBRID_QUERY":
            conceptual_ans = handle_hybrid_query(user_question, db_session, context=state.get("messages", []), resolved_entities=state.get("resolved_entities"))
            if conceptual_ans and conceptual_ans != "__LLM_OFFLINE__":
                if "concept explanation" not in final_answer.lower() and "concept explanation" not in conceptual_ans.lower():
                    final_answer = f"{final_answer}\n\n### 📖 Concept Explanation\n{conceptual_ans}"
                else:
                    final_answer = f"{final_answer}\n\n{conceptual_ans}"
                    
        # Check UI Action Planner on User query + query results
        plan = plan_action(user_question, query_results, db_session, context=state.get("messages", []), resolved_entities=state.get("resolved_entities"))
        
        if plan.get("action_type") == "ask_context":
            final_answer = plan.get("response", "Please clarify.")
            actions = []
            comp_payload = None
        else:
            actions = plan.get("actions", [])
            comp_payload = plan.get("comp_payload")
            
            has_model_report = any(a.get("download_type") == "report" and a.get("entity_type") == "model" for a in actions)
            has_zip = any(a.get("download_type") == "zip" for a in actions)
            if has_model_report and not has_zip:
                final_answer += "\n\n*(If you would also like to download the source files like weights or dataset for this model, just ask to download the ZIP file!)*"

    res_payload = compose_response(user_question, final_answer, actions, comp_payload, db_session, state.get("sql_results"))
    if state.get("action_payload") and "follow_ups" in state["action_payload"]:
        res_payload["follow_ups"] = state["action_payload"]["follow_ups"]
        
    return {"action_payload": res_payload}
