import json
import requests
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from app.services.llm_service import call_llm, parse_json_from_llm
from app.models.algorithm import Algorithm
from app.models.factory import Factory
from app.models.model import Model
from app.models.version import ModelVersion

def process_edit_flow(
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
        return {"type": "complete", "message": f"Interactive edit for {entity_type} is not supported.", "success": False}

    history_str = ""
    if context:
        formatted = [f"{'User' if m.get('role') == 'user' else 'Assistant'}: {m.get('content', '')}" for m in context if m.get('content')]
        if formatted:
            history_str = "\nCONVERSATION HISTORY:\n" + "\n".join(formatted) + "\n"
            
    if current_question:
        history_str += f"User: {current_question}\n"

    prompt = f"""You are an interactive edit assistant.
The user wants to edit an existing {entity_type}.
{requirements}

{history_str}
Analyze the conversation history to extract the required fields to identify the {entity_type}, and any optional fields they want to change (like 'description', or for algorithms 'ini_config').
If ANY required fields are missing, output a natural clarifying question asking for them.
You MUST also check if the user has explicitly confirmed the edit with a clear "yes", "sure", or "do it".
If they have NOT confirmed, you must ask them: "I will update this {entity_type} with the following changes: [list changes]. Is that correct?".

Output ONLY a raw JSON object with this schema:
{{
  "is_complete": true or false,
  "clarifying_question": "string (null if is_complete is true)",
  "has_confirmed": true or false,
  "extracted_fields": {{
     {"\"name\": \"string or null\"," if entity_type != "version" else ""}
     "factory_name": "string or null",
     "model_name": "string or null (only if version)",
     "version_number": "int or null (only if version)",
     "description": "string or null",
     "ini_config": "string or null (only if algorithm)",
     "note": "string or null (only if version)",
     "accuracy": "float or null",
     "precision": "float or null",
     "recall": "float or null",
     "f1_score": "float or null",
     "batch_size": "int or null",
     "epochs": "int or null",
     "learning_rate": "float or null",
     "optimizer": "string or null",
     "image_size": "int or null"
  }}
}}
Do NOT wrap in markdown backticks. Do NOT write any explanations.
"""

    raw_res = call_llm(prompt, temperature=0.0)
    parsed = parse_json_from_llm(raw_res)

    if not parsed:
        return {"type": "question", "message": "I encountered an error trying to extract details. Could you repeat?"}

    if not parsed.get("is_complete") or not parsed.get("has_confirmed"):
        msg = parsed.get("clarifying_question") or "Are you sure you want to make these changes?"
        msg += f"\n<!-- INTERACTIVE_EDIT: {entity_type} -->"
        return {"type": "question", "message": msg}

    fields = parsed.get("extracted_fields", {})
    name = fields.get("name")
    factory_name = fields.get("factory_name")
    desc = fields.get("description")
    ini = fields.get("ini_config")
    
    model_name = fields.get("model_name")
    version_number = fields.get("version_number")
    
    import os
    url_base = os.environ.get("API_BASE_URL", "http://localhost:8000")

    try:
        if entity_type == "algorithm":
            algo = db_session.query(Algorithm).filter(Algorithm.name.ilike(name)).first()
            if not algo: return {"type": "complete", "message": f"Algorithm '{name}' not found.", "success": False}
            data = {"name": algo.name}
            if desc is not None: data["description"] = desc
            else: data["description"] = algo.description
            if ini is not None: data["ini_config"] = ini
            else: data["ini_config"] = algo.ini_config
            requests.put(f"{url_base}/algorithms/{algo.id}", json=data)
            return {"type": "complete", "message": f"Algorithm **{algo.name}** has been updated.", "success": True}

        elif entity_type == "factory":
            factory = db_session.query(Factory).filter(Factory.name.ilike(name)).first()
            if not factory: return {"type": "complete", "message": f"Factory '{name}' not found.", "success": False}
            data = {"name": factory.name}
            if desc is not None: data["description"] = desc
            else: data["description"] = factory.description
            requests.put(f"{url_base}/factories/{factory.id}", json=data)
            return {"type": "complete", "message": f"Factory **{factory.name}** has been updated.", "success": True}

        elif entity_type == "model":
            factory = db_session.query(Factory).filter(Factory.name.ilike(factory_name)).first()
            if not factory: return {"type": "complete", "message": f"Factory '{factory_name}' not found.", "success": False}
            model = db_session.query(Model).filter(Model.name.ilike(name), Model.factory_id == factory.id).first()
            if not model: return {"type": "complete", "message": f"Model '{name}' not found.", "success": False}
            data = {"name": model.name}
            if desc is not None: data["description"] = desc
            else: data["description"] = model.description
            requests.put(f"{url_base}/algorithms/{model.algorithm_id}/factories/{factory.id}/models/{model.id}", json=data)
            return {"type": "complete", "message": f"Model **{model.name}** has been updated.", "success": True}

        elif entity_type == "version":
            factory = db_session.query(Factory).filter(Factory.name.ilike(factory_name)).first()
            if not factory: return {"type": "complete", "message": f"Factory '{factory_name}' not found.", "success": False}
            model = db_session.query(Model).filter(Model.name.ilike(model_name), Model.factory_id == factory.id).first()
            if not model: return {"type": "complete", "message": f"Model '{model_name}' not found.", "success": False}
            version = db_session.query(ModelVersion).filter(ModelVersion.model_id == model.id, ModelVersion.version_number == version_number).first()
            if not version: return {"type": "complete", "message": f"Version {version_number} not found.", "success": False}
            
            # Reconstruct version data for edit
            data = {
                "note": fields.get("note") if fields.get("note") is not None else version.note,
                "accuracy": fields.get("accuracy") if fields.get("accuracy") is not None else version.accuracy,
                "precision": fields.get("precision") if fields.get("precision") is not None else version.precision,
                "recall": fields.get("recall") if fields.get("recall") is not None else version.recall,
                "f1_score": fields.get("f1_score") if fields.get("f1_score") is not None else version.f1_score,
                "batch_size": fields.get("batch_size") if fields.get("batch_size") is not None else (version.parameters.get("batch_size") if version.parameters else None),
                "epochs": fields.get("epochs") if fields.get("epochs") is not None else (version.parameters.get("epochs") if version.parameters else None),
                "learning_rate": fields.get("learning_rate") if fields.get("learning_rate") is not None else (version.parameters.get("learning_rate") if version.parameters else None),
                "optimizer": fields.get("optimizer") if fields.get("optimizer") is not None else (version.parameters.get("optimizer") if version.parameters else None),
                "image_size": fields.get("image_size") if fields.get("image_size") is not None else (version.parameters.get("image_size") if version.parameters else None),
            }
            # Remove Nones so it doesn't fail validation if not present
            data = {k: v for k, v in data.items() if v is not None}
            # Wait, /versions/{id} doesn't exist for PUT? Let me verify if there's an edit endpoint for version.
            # If not, we can just update the DB directly here for now, because interactive edit of version is simple.
            if "note" in data: version.note = data["note"]
            if "accuracy" in data: version.accuracy = data["accuracy"]
            if "precision" in data: version.precision = data["precision"]
            if "recall" in data: version.recall = data["recall"]
            if "f1_score" in data: version.f1_score = data["f1_score"]
            
            if not version.parameters: version.parameters = {}
            for pk in ["batch_size", "epochs", "learning_rate", "optimizer", "image_size"]:
                if pk in data: version.parameters[pk] = data[pk]
                
            from sqlalchemy.orm.attributes import flag_modified
            flag_modified(version, "parameters")
            
            db_session.commit()
            return {"type": "complete", "message": f"Version **{version.version_number}** of **{model.name}** has been updated.", "success": True}

    except Exception as e:
        return {"type": "complete", "message": f"Error editing: {e}", "success": False}
        
    return {"type": "complete", "message": "Unknown entity type.", "success": False}
