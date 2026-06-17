from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.api.deps import get_db
from app.services.query_dispatcher import run_sql_agent

router = APIRouter(prefix="/chatbot", tags=["Chatbot"])

class ChatRequest(BaseModel):
    message: str
    context: list = []   # [{"role": "user"|"bot", "content": "..."}, ...]

@router.post("/ask")
async def ask_chatbot(payload: ChatRequest, db: Session = Depends(get_db)):
    try:
        # Delegate to the MARS AI Agent
        return run_sql_agent(payload.message, db, context=payload.context)
    except Exception as e:
        print(f"Chatbot error: {e}")
        return {"answer": f"Unexpected error: {e}", "type": "error"}
