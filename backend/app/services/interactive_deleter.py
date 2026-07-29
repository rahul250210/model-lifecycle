import json
import requests
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from app.services.llm_service import call_llm, parse_json_from_llm
from app.models.algorithm import Algorithm
from app.models.factory import Factory
from app.models.model import Model
from app.models.version import ModelVersion

def process_deletion_flow(
    entity_type: str,
    context: List[Dict[str, str]],
    current_question: str,
    db_session: Session
) -> Dict[str, Any]:
    
    requirements = ""
    if entity_type == "algorithm":
        requirements = "Required field: 'name'."
    elif entity_type == "factory":
        requirements = "Required field: 'name'."
    elif entity_type == "model":
        requirements = "Required fields: 'name', 'factory_name'."
    elif entity_type == "version":
        requirements = "Required fields: 'model_name', 'factory_name', 'version_number'."
    else:
        return {"type": "complete", "message": f"Interactive deletion for {entity_type} is not supported.", "success": False}

    history_str = ""
    if context:
        formatted = [f"{'User' if m.get('role') == 'user' else 'Assistant'}: {m.get('content', '')}" for m in context if m.get('content')]
        if formatted:
            history_str = "\nCONVERSATION HISTORY:\n" + "\n".join(formatted) + "\n"
            
    if current_question:
        history_str += f"User: {current_question}\n"

    prompt = f"""You are an interactive deletion assistant.
The user wants to delete an existing {entity_type}.
{requirements}

{history_str}
Analyze the conversation history to extract the required fields to identify the {entity_type}.
If ANY required fields are missing, output a natural clarifying question asking for them.
You MUST also check if the user has explicitly confirmed the deletion with a clear "yes", "sure", or "do it".
If they have NOT confirmed, you must ask them: "Are you sure you want to delete this {entity_type}?".

Output ONLY a raw JSON object with this schema:
{{
  "is_complete": true or false,
  "clarifying_question": "string (null if is_complete is true)",
  "has_confirmed": true or false,
  "extracted_fields": {{
     {"\"name\": \"string or null\"," if entity_type != "version" else ""}
     "factory_name": "string or null",
     "model_name": "string or null",
     "version_number": "int or null"
  }}
}}
Do NOT wrap in markdown backticks. Do NOT write any explanations.
"""

    raw_res = call_llm(prompt, temperature=0.0)
    parsed = parse_json_from_llm(raw_res)

    if not parsed:
        return {"type": "question", "message": "I encountered an error trying to extract details. Could you repeat?"}

    if not parsed.get("is_complete") or not parsed.get("has_confirmed"):
        msg = parsed.get("clarifying_question") or "Are you sure you want to delete this?"
        msg += f"\n<!-- INTERACTIVE_DELETE: {entity_type} -->"
        return {"type": "question", "message": msg}

    fields = parsed.get("extracted_fields", {})
    name = fields.get("name")
    factory_name = fields.get("factory_name")
    model_name = fields.get("model_name")
    version_number = fields.get("version_number")
    
    import os
    url_base = os.environ.get("API_BASE_URL", "http://localhost:8000")

    try:
        if entity_type == "algorithm":
            algo = db_session.query(Algorithm).filter(Algorithm.name.ilike(name)).first()
            if not algo: return {"type": "complete", "message": f"Algorithm '{name}' not found.", "success": False}
            requests.delete(f"{url_base}/algorithms/{algo.id}")
            return {"type": "complete", "message": f"Algorithm **{algo.name}** has been deleted.", "success": True}

        elif entity_type == "factory":
            factory = db_session.query(Factory).filter(Factory.name.ilike(name)).first()
            if not factory: return {"type": "complete", "message": f"Factory '{name}' not found.", "success": False}
            requests.delete(f"{url_base}/factories/{factory.id}")
            return {"type": "complete", "message": f"Factory **{factory.name}** has been deleted.", "success": True}

        elif entity_type == "model":
            factory = db_session.query(Factory).filter(Factory.name.ilike(factory_name)).first()
            if not factory: return {"type": "complete", "message": f"Factory '{factory_name}' not found.", "success": False}
            model = db_session.query(Model).filter(Model.name.ilike(name), Model.factory_id == factory.id).first()
            if not model: return {"type": "complete", "message": f"Model '{name}' not found.", "success": False}
            requests.delete(f"{url_base}/algorithms/{model.algorithm_id}/factories/{factory.id}/models/{model.id}")
            return {"type": "complete", "message": f"Model **{model.name}** has been deleted.", "success": True}

        elif entity_type == "version":
            factory = db_session.query(Factory).filter(Factory.name.ilike(factory_name)).first()
            if not factory: return {"type": "complete", "message": f"Factory '{factory_name}' not found.", "success": False}
            model = db_session.query(Model).filter(Model.name.ilike(model_name), Model.factory_id == factory.id).first()
            if not model: return {"type": "complete", "message": f"Model '{model_name}' not found.", "success": False}
            version = db_session.query(ModelVersion).filter(ModelVersion.model_id == model.id, ModelVersion.version_number == version_number).first()
            if not version: return {"type": "complete", "message": f"Version {version_number} not found.", "success": False}
            requests.delete(f"{url_base}/algorithms/{model.algorithm_id}/factories/{factory.id}/models/{model.id}/versions/{version.id}")
            return {"type": "complete", "message": f"Version **{version_number}** of **{model.name}** has been deleted.", "success": True}

    except Exception as e:
        return {"type": "complete", "message": f"Error deleting: {e}", "success": False}
        
    return {"type": "complete", "message": "Unknown entity type.", "success": False}
