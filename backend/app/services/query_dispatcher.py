import time
from typing import Any, Dict, List
from sqlalchemy.orm import Session
from app.services.llm_service import call_llm

def run_sql_agent(
    user_question: str,
    db_session: Session,
    context: List[Dict] = [],
) -> Dict[str, Any]:
    """
    Unified entrypoint for MIRA AI chatbot, routing all queries through the 
    new dynamic, LLM-driven Text-to-SQL chat pipeline.
    """
    from app.services.chat_pipeline import run_chat_pipeline
    return run_chat_pipeline(user_question, db_session, context)
