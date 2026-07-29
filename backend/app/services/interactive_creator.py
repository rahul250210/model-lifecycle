import json
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.services.llm_service import call_llm, parse_json_from_llm
from app.models.algorithm import Algorithm
from app.models.factory import Factory
from app.models.model import Model

def process_creation_flow(entity_type: str, context: List[Dict[str, Any]], current_question: str, db_session: Session) -> Dict[str, Any]:
    """
    Uses LLM to extract fields from conversation history for creating an entity.
    If fields are missing, returns a question to ask the user.
    If fields are complete, creates the record in the DB and returns a success message.
    """
    # 1. Provide instructions based on entity_type
    requirements = ""
    if entity_type == "algorithm":
        requirements = "Required fields: 'name'. You MUST also ask the user if they want to provide a 'description' and an 'ini_config' (INI file content) if they haven't mentioned them yet. If they explicitly skip them, you can proceed with them being null. If the user provides a file path (absolute or relative) for the INI file, extract it into 'ini_file_path' instead of 'ini_config'."
    elif entity_type == "factory":
        requirements = "Required fields: 'name'. Optional field: 'algorithm_name' (if the user wants to create it inside a specific algorithm, or link an existing factory to an algorithm). You MUST also ask the user if they want to provide a 'description' if they haven't mentioned it. If they skip it, proceed with null."
    elif entity_type == "model":
        requirements = "Required fields: 'name', 'algorithm_name', 'factory_name'. You MUST also ask if they want to provide a 'description'. If they skip it, proceed with null."
    elif entity_type == "version":
        requirements = "Required fields: 'model_name', 'algorithm_name', 'factory_name'. You MUST then guide the user step-by-step for the optional fields to make it user friendly. For example: first ask if they want to base this on an existing version (extract 'base_version_number'). If they say no, ask if they want to log any training parameters. If they say no, move on to ask about metrics. If they say no, ask about file paths. Do NOT ask for everything at once in a massive question. If they provide local file paths, extract them into lists of strings (e.g. dataset_paths, model_paths, label_paths, code_paths). You can provide file paths that point to a folder, and it will upload the entire folder."
    else:
        return {"type": "complete", "message": f"Interactive creation for {entity_type} is not fully supported yet.", "success": False}

    # 2. Format history
    history_str = ""
    if context:
        formatted = []
        for msg in context:
            role = "User" if msg.get("role") == "user" else "Assistant"
            content = msg.get("content", "")
            if content:
                formatted.append(f"{role}: {content}")
        if formatted:
            history_str = "\nCONVERSATION HISTORY:\n" + "\n".join(formatted) + "\n"
            
    if current_question:
        history_str += f"User: {current_question}\n"

    # 3. Prompt LLM
    prompt = f"""You are an interactive creation assistant for an MLOps platform.
The user wants to create a new {entity_type}.
{requirements}

{history_str}
Analyze the conversation history to extract the required and optional fields for the {entity_type}.
If ANY required fields are missing, OR if you haven't asked about the optional fields yet and the user hasn't provided them, you must generate a natural conversational question asking the user for the missing information.
If ALL required fields are present AND the user has either provided the optional fields or explicitly stated they don't want to provide them, output the extracted fields.

Output ONLY a raw JSON object with this schema:
{{
  "is_complete": true or false,
  "clarifying_question": "string (null if is_complete is true)",
  "extracted_fields": {{
     {"\"name\": \"string or null\"," if entity_type != "version" else ""}
     "description": "string or null",
     "ini_config": "string or null (only if algorithm)",
     "ini_file_path": "string or null (only if algorithm)",
     "algorithm_name": "string or null",
     "factory_name": "string or null",
     "model_name": "string or null",
     "base_version_number": "int or null",
     "note": "string or null",
     "accuracy": "float or null",
     "precision": "float or null",
     "recall": "float or null",
     "f1_score": "float or null",
     "batch_size": "int or null",
     "epochs": "int or null",
     "learning_rate": "float or null",
     "optimizer": "string or null",
     "image_size": "int or null",
     "dataset_paths": "list of strings or []",
     "model_paths": "list of strings or []",
     "label_paths": "list of strings or []",
     "code_paths": "list of strings or []"
  }}
}}
Do NOT wrap in markdown backticks. Do NOT write any explanations.
"""

    raw_res = call_llm(prompt, temperature=0.0)
    parsed = parse_json_from_llm(raw_res)

    if not parsed:
        print(f"[InteractiveCreator] Failed to parse JSON: {raw_res}")
        return {"type": "question", "message": "I encountered an error trying to extract the details. Could you please provide them again?"}

    fields = parsed.get("extracted_fields", {})
    name = fields.get("name")
    desc = fields.get("description", "")
    ini = fields.get("ini_config", "")
    ini_file_path = fields.get("ini_file_path", "")

    if ini_file_path:
        import os
        original_ini_path = ini_file_path
        if not os.path.isabs(ini_file_path):
            workspace_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..'))
            ini_file_path = os.path.join(workspace_root, ini_file_path)
            
        if os.path.exists(ini_file_path):
            try:
                with open(ini_file_path, 'r', encoding='utf-8') as f:
                    ini = f.read()
            except Exception as e:
                return {"type": "question", "message": f"I tried to read the INI file at `{ini_file_path}` but encountered an error: {e}. Could you provide a valid path or the raw content?"}
        else:
            return {"type": "question", "message": f"I couldn't find a file at `{original_ini_path}`. Could you please double-check the path?"}

    # Early existence check
    if name:
        if entity_type == "algorithm":
            existing = db_session.query(Algorithm).filter(Algorithm.name.ilike(name)).first()
            if existing:
                return {"type": "complete", "message": f"An algorithm named '{existing.name}' already exists. Please choose a different name.", "success": False}
        elif entity_type == "model":
            factory_name = fields.get("factory_name")
            if factory_name:
                factory = db_session.query(Factory).filter(Factory.name.ilike(factory_name)).first()
                if factory:
                    existing = db_session.query(Model).filter(Model.name.ilike(name), Model.factory_id == factory.id).first()
                    if existing:
                        return {"type": "complete", "message": f"A model named '{name}' already exists in the {factory.name} factory. Please choose a different name.", "success": False}

    if not parsed.get("is_complete"):
        msg = parsed.get("clarifying_question", "Could you provide more details?")
        msg += f"\n<!-- INTERACTIVE_CREATION: {entity_type} -->"
        return {"type": "question", "message": msg}

    # 4. If complete, validate and insert into DB
    if not name and entity_type != "version":
        return {"type": "question", "message": f"I still need a name. What should we call it?\n<!-- INTERACTIVE_CREATION: {entity_type} -->"}

    if entity_type == "algorithm":
        
        algo = Algorithm(name=name, description=desc, ini_config=ini)
        db_session.add(algo)
        db_session.commit()
        return {"type": "complete", "message": f"🎉 Algorithm **{name}** has been successfully created!", "success": True}

    elif entity_type == "factory":
        algo_name = fields.get("algorithm_name")
        created_by_algo_id = None
        if algo_name:
            algo = db_session.query(Algorithm).filter(Algorithm.name.ilike(algo_name)).first()
            if not algo:
                return {"type": "question", "message": f"I couldn't find an algorithm named '{algo_name}' in the database. Could you please verify the algorithm name?\n<!-- INTERACTIVE_CREATION: {entity_type} -->"}
            created_by_algo_id = algo.id

        existing = db_session.query(Factory).filter(Factory.name.ilike(name)).first()
        if existing:
            if created_by_algo_id:
                from app.models.factory import AlgorithmFactoryLink
                link = db_session.query(AlgorithmFactoryLink).filter_by(algorithm_id=created_by_algo_id, factory_id=existing.id).first()
                if not link:
                    link = AlgorithmFactoryLink(algorithm_id=created_by_algo_id, factory_id=existing.id, description=desc)
                    db_session.add(link)
                    db_session.commit()
                return {"type": "complete", "message": f"🎉 Existing factory **{existing.name}** has been successfully linked to the **{algo.name}** algorithm!", "success": True}
            else:
                return {"type": "complete", "message": f"A factory named '{existing.name}' already exists.", "success": False}
        
        factory = Factory(name=name, description=desc, created_by_algorithm_id=created_by_algo_id)
        db_session.add(factory)
        db_session.commit()
        if created_by_algo_id:
            return {"type": "complete", "message": f"🎉 Factory **{name}** has been successfully created inside the **{algo.name}** algorithm!", "success": True}
        else:
            return {"type": "complete", "message": f"🎉 Factory **{name}** has been successfully created!", "success": True}

    elif entity_type == "model":
        algo_name = fields.get("algorithm_name")
        factory_name = fields.get("factory_name")
        
        algo = db_session.query(Algorithm).filter(Algorithm.name.ilike(algo_name)).first()
        if not algo:
            return {"type": "question", "message": f"I couldn't find an algorithm named '{algo_name}' in the database. Could you please verify the algorithm name?"}
            
        factory = db_session.query(Factory).filter(Factory.name.ilike(factory_name)).first()
        if not factory:
            return {"type": "question", "message": f"I couldn't find a factory named '{factory_name}' in the database. Could you please verify the factory name?"}

        model = Model(name=name, description=desc, algorithm_id=algo.id, factory_id=factory.id)
        db_session.add(model)
        db_session.commit()
        return {"type": "complete", "message": f"🎉 Model **{name}** has been successfully registered under the {algo.name} algorithm and {factory.name} factory!", "success": True}

    elif entity_type == "version":
        algo_name = fields.get("algorithm_name")
        factory_name = fields.get("factory_name")
        model_name = fields.get("model_name")
        
        algo = db_session.query(Algorithm).filter(Algorithm.name.ilike(algo_name)).first()
        if not algo:
            return {"type": "question", "message": f"I couldn't find an algorithm named '{algo_name}'. Could you please verify the algorithm name?"}
            
        factory = db_session.query(Factory).filter(Factory.name.ilike(factory_name)).first()
        if not factory:
            return {"type": "question", "message": f"I couldn't find a factory named '{factory_name}'. Could you please verify the factory name?"}

        model = db_session.query(Model).filter(Model.name.ilike(model_name), Model.factory_id == factory.id).first()
        if not model:
            return {"type": "question", "message": f"I couldn't find a model named '{model_name}' in the {factory.name} factory. Could you please verify the model name?"}

        import requests
        import os
        url_base = os.environ.get("API_BASE_URL", "http://localhost:8000")
        url = f"{url_base}/algorithms/{algo.id}/factories/{factory.id}/models/{model.id}/versions"
        
        data = {}
        for k in ["note", "accuracy", "precision", "recall", "f1_score", "batch_size", "epochs", "learning_rate", "optimizer", "image_size"]:
            v = fields.get(k)
            if v is not None:
                data[k] = v
                
        base_version_num = fields.get("base_version_number")
        if base_version_num is not None:
            from app.models.version import ModelVersion
            base_v = db_session.query(ModelVersion).filter(ModelVersion.model_id == model.id, ModelVersion.version_number == base_version_num).first()
            if base_v:
                data["base_version_id"] = base_v.id
            else:
                return {"type": "question", "message": f"I couldn't find version number {base_version_num} for model '{model.name}'. Could you verify the version number?"}
                
        files = []
        open_files = []
        try:
            for file_type, key in [("dataset_files", "dataset_paths"), ("label_files", "label_paths"), ("model_files", "model_paths"), ("code_files", "code_paths")]:
                paths = fields.get(key)
                if paths and isinstance(paths, list):
                    for path in paths:
                        original_path = path
                        if not os.path.isabs(path):
                            workspace_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..'))
                            path = os.path.join(workspace_root, path)
                            
                        if os.path.exists(path):
                            if os.path.isfile(path):
                                f = open(path, 'rb')
                                open_files.append(f)
                                files.append((file_type, (os.path.basename(path), f)))
                            elif os.path.isdir(path):
                                for root, _, filenames in os.walk(path):
                                    for filename in filenames:
                                        file_path = os.path.join(root, filename)
                                        f = open(file_path, 'rb')
                                        open_files.append(f)
                                        # Use relative path from the provided directory root as filename? 
                                        # FastAPI UploadFile only gives filename. We can just use filename.
                                        files.append((file_type, (filename, f)))
                        else:
                            for opened_f in open_files: opened_f.close()
                            return {"type": "complete", "message": f"I couldn't find the file or directory at `{original_path}`. Please verify the path is correct.", "success": False}
                            
            resp = requests.post(url, data=data, files=files)
        except Exception as e:
            return {"type": "complete", "message": f"An error occurred while creating the version: {e}", "success": False}
        finally:
            for f in open_files:
                f.close()
                
        if resp.status_code == 201:
            return {"type": "complete", "message": f"🎉 A new version has been successfully created for model **{model.name}**!", "success": True}
        else:
            return {"type": "complete", "message": f"Failed to create version. Server responded: {resp.text}", "success": False}

    return {"type": "complete", "message": "Creation flow not supported for this entity yet.", "success": False}
