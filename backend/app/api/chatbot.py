import csv
import io
import base64
import json
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel
from app.api.deps import get_db
from app.models import Factory, Algorithm, Model, ModelVersion
from app.services.query_dispatcher import run_sql_agent, stream_sql_agent

router = APIRouter(prefix="/chatbot", tags=["Chatbot"])

class ChatRequest(BaseModel):
    message: str
    context: list = []   # [{"role": "user"|"bot", "content": "..."}, ...]

@router.post("/ask")
def ask_chatbot(payload: ChatRequest, db: Session = Depends(get_db)):
    try:
        # Delegate to the MARS AI Agent
        return run_sql_agent(payload.message, db, context=payload.context)
    except Exception as e:
        print(f"Chatbot error: {e}")
        return {"answer": f"Unexpected error: {e}", "type": "error"}

@router.post("/stream")
def stream_chatbot(payload: ChatRequest, db: Session = Depends(get_db)):
    """
    Server-Sent Events endpoint for real-time chatbot streaming.
    """
    return StreamingResponse(
        stream_sql_agent(payload.message, db, context=payload.context),
        media_type="text/event-stream"
    )

@router.get("/download-table")
def download_table(payload: str = Query(...)):
    try:
        # Pad payload if necessary
        missing_padding = len(payload) % 4
        if missing_padding:
            payload += '=' * (4 - missing_padding)
        
        decoded_bytes = base64.b64decode(payload)
        data = json.loads(decoded_bytes.decode('utf-8'))
        
        filename = data.get("filename", "exported_data.csv")
        headers = data.get("headers", [])
        rows = data.get("rows", [])
        
        output = io.StringIO()
        writer = csv.writer(output)
        
        if headers:
            writer.writerow(headers)
        for row in rows:
            writer.writerow(row)
            
        output.seek(0)
        
        return StreamingResponse(
            io.BytesIO(output.getvalue().encode('utf-8')),
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid payload or data: {str(e)}")

