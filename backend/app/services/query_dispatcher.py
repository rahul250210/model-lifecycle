import time
from typing import Any, Dict, List
from sqlalchemy.orm import Session
from app.services.llm_service import call_llm

_cached_graph = None

def get_chat_graph():
    global _cached_graph
    if _cached_graph is None:
        from app.services.chat_graph import build_chat_graph
        _cached_graph = build_chat_graph()
    return _cached_graph

def run_sql_agent(
    user_question: str,
    db_session: Session,
    context: List[Dict] = [],
) -> Dict[str, Any]:
    """
    Unified entrypoint for MIRA AI chatbot, routing all queries through the 
    new dynamic, LLM-driven Text-to-SQL chat pipeline.
    """
    from app.utils.fuzzy import auto_correct_query
    
    # Auto-correct query for misspelled entities
    corrected_question = auto_correct_query(user_question, db_session)
    
    graph = get_chat_graph()
    
    initial_state = {
        "messages": context,
        "current_question": corrected_question,
        "query_type": "UNKNOWN",
        "sql_query": None,
        "sql_results": None,
        "action_payload": None,
        "final_response": "",
        "error_count": 0,
        "latest_error": None
    }
    
    config = {"configurable": {"db_session": db_session}}
    
    final_state = graph.invoke(initial_state, config=config)
    
    return final_state["action_payload"]

import json

def stream_sql_agent(
    user_question: str,
    db_session: Session,
    context: List[Dict] = [],
):
    """
    Streams the execution graph's progress as Server-Sent Events (SSE).
    """
    from app.utils.fuzzy import auto_correct_query
    
    corrected_question = auto_correct_query(user_question, db_session)
    graph = get_chat_graph()
    
    initial_state = {
        "messages": context,
        "current_question": corrected_question,
        "query_type": "UNKNOWN",
        "sql_query": None,
        "sql_results": None,
        "action_payload": None,
        "final_response": "",
        "error_count": 0,
        "latest_error": None
    }
    
    config = {"configurable": {"db_session": db_session}}
    
    # Map node names to user-friendly status messages
    status_map = {
        "router": "Analyzing intent...",
        "action_expert": "Planning actions...",
        "knowledge_expert": "Searching knowledge base...",
        "sql_expert": "Generating database query...",
        "sql_executor": "Executing database search...",
        "response_composer": "Formatting response..."
    }
    
    last_state = initial_state
    
    try:
        for event in graph.stream(initial_state, config=config):
            node_name = list(event.keys())[0]
            last_state = event[node_name]
            status_msg = status_map.get(node_name, f"Processing step: {node_name}...")
            
            yield f"event: status\ndata: {json.dumps({'status': status_msg})}\n\n"
            
        final_payload = last_state.get("action_payload", {})
        if "answer" not in final_payload and "response" in final_payload:
            final_payload["answer"] = final_payload["response"]
            
        yield f"event: done\ndata: {json.dumps(final_payload, default=str)}\n\n"
    except Exception as e:
        error_payload = {"answer": f"Stream error: {str(e)}", "type": "error"}
        yield f"event: error\ndata: {json.dumps(error_payload)}\n\n"
