import re
import json
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import text
from difflib import SequenceMatcher

from app.services.llm_service import call_llm, parse_json_from_llm
from app.models.model import Model
from app.models.algorithm import Algorithm
from app.models.factory import Factory

# Relying 100% on LLM routing

def route_query(user_question: str, db_session: Session, context: List[Dict[str, Any]] = []) -> Dict[str, Any]:
    """
    Classifies the user query into one of the four supported query types:
    DATABASE_QUERY, KNOWLEDGE_QUERY, HYBRID_QUERY, ACTION_QUERY.
    """
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

    prompt = f"""You are a query routing assistant for MARS, an MLOps platform repository.
{history_str}
Your task is to classify the user's question into one of the four query types:

1. DATABASE_QUERY:
- Requests specific database records, lists, statistics, rankings, or analytics of the system.
- Does not ask for definitions, AI/ML theory, or architectural explanations.
- Examples: "how many versions does Model X have?", "show top 5 models by accuracy", "list all active versions".

2. KNOWLEDGE_QUERY:
- Conceptual questions, definitions, AI/ML theory, architecture explanations, general tutorials, or software engineering concepts.
- Does not reference specific data or models stored in the local repository database.
- Examples: "What is LangChain?", "Explain CNN architecture.", "What is a neural network?", "What is RAG?", "Explain Transformer architecture."

3. HYBRID_QUERY:
- Combines general conceptual explanations/theory with specific local repository data or entities.
- Examples: "What is Model X?", "Explain Model X used in our repository.", "How does Random Forest work and what versions do we have?"

4. ACTION_QUERY:
- Requests actions such as download reports, download zip bundles, compare entities, compare versions, export, navigate, or open screens.
- Examples: "Download model report for Model X", "Compare Model X version 1 and version 2", "Export weights for Model Y".

Analyze the user's question and respond with ONLY a single JSON object (do NOT wrap it in markdown code block formatting, do NOT write ```json, do NOT write any explanation before or after):
{{
  "query_type": "DATABASE_QUERY" | "KNOWLEDGE_QUERY" | "HYBRID_QUERY" | "ACTION_QUERY",
  "explanation": "Brief reasoning for classification"
}}

User Question: {user_question}"""

    raw_response = call_llm(prompt, temperature=0.0)
    
    parsed = parse_json_from_llm(raw_response)
    if parsed and parsed.get("query_type") in ["DATABASE_QUERY", "KNOWLEDGE_QUERY", "HYBRID_QUERY", "ACTION_QUERY"]:
        return parsed
        
    # Simple default fallback if LLM is offline or JSON parsing fails
    q = user_question.lower()
    is_action = False
    
    if any(kw in q for kw in ["download", "export", "report", "csv", "zip", "bundle", "weights"]):
        is_action = True
        
    if "compare" in q or "vs" in q or "versus" in q or "evolution" in q or "changed" in q or "change" in q or "delta" in q:
        if any(kw in q for kw in ["accuracy", "precision", "recall", "f1", "inference", "latency", "average", "mean", "max", "min", "highest", "lowest", "best"]):
            is_action = False
        else:
            is_action = True
            
    if is_action:
        return {"query_type": "ACTION_QUERY", "explanation": "Rule fallback: contains action keywords"}
        
    is_hybrid = False
    if any(kw in q for kw in ["explain", "what is", "how does", "why"]):
        is_hybrid = True
        
    if is_hybrid:
        return {"query_type": "HYBRID_QUERY", "explanation": "LLM offline hybrid query fallback"}
        
    return {"query_type": "DATABASE_QUERY", "explanation": "LLM offline/rate-limited fallback"}

def handle_knowledge_query(user_question: str) -> str:
    """Answers a pure knowledge/conceptual question using the LLM directly."""
    prompt = f"""You are a helpful AI assistant for MARS, an MLOps platform.
Answer the following general conceptual question conversationally in markdown.
Your answer should be accurate, detailed, and cover relevant AI/ML, MLOps, or software engineering concepts.

User Question: {user_question}"""
    
    answer = call_llm(prompt, temperature=0.5)
    if answer == "__LLM_OFFLINE__":
        return "⚠️ I'm sorry, I am currently offline and cannot answer conceptual questions. Please try again later or ask a database-related query."
    return answer

def check_ambiguous_match(entity_list: List[Any], entity_name: str, context_hints: str) -> Optional[str]:
    """
    Checks if there are multiple entities matching the same name and context doesn't clarify.
    Returns a clarification question if ambiguous, None otherwise.
    """
    if not entity_list or len(entity_list) <= 1:
        return None
        
    context_lower = context_hints.lower()
    
    if hasattr(entity_list[0], 'factory') and hasattr(entity_list[0], 'name'):
        factory_names = [m.factory.name for m in entity_list if m.factory]
        
        for f_name in factory_names:
            if f_name.lower() in context_lower:
                return None
                
        unique_factories = list(set(factory_names))
        if len(unique_factories) > 1:
            if len(unique_factories) == 2:
                factories_str = f"{unique_factories[0]} and {unique_factories[1]}"
            else:
                factories_str = ", ".join(unique_factories[:-1]) + f", and {unique_factories[-1]}"
            return f"I found '{entity_name}' in multiple factories ({factories_str}). Which one did you mean?"
            
    return None

def resolve_entities(user_question: str, db_session: Session, context: Optional[List[Dict[str, Any]]] = None) -> Dict[str, List[Any]]:
    """
    Extracts referenced model, factory, or algorithm names from the query using the LLM,
    then retrieves matching records from the database using SQL ILIKE.
    """
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

    prompt = f"""You are a precise entity name extractor for an MLOps platform database.
{history_str}
Analyze the user's question and extract all references to the names of:
1. Models (e.g. Model X, Model Y, etc.)
2. Factories (e.g. Factory A, Factory B, etc.)
3. Algorithms (e.g. Algorithm X, Algorithm Y, etc.)

If the user's question uses pronouns, relative pronouns, or references (e.g., "them", "it", "that model", "the first one", "its versions", "this factory") to refer to entities mentioned in the CONVERSATION HISTORY, resolve those pronouns and extract the actual entity names from the conversation history. IMPORTANT: Do NOT extract entities from the CONVERSATION HISTORY unless the current User Question explicitly refers to them via pronouns or context. If the User Question is a completely new topic, ignore the history.

Return ONLY a JSON object with keys "models", "factories", and "algorithms". Each key should map to a list of strings representing the extracted names. If a category is not referenced, map it to an empty list [].
Do NOT wrap in markdown backticks, do NOT write ```json, do NOT write any explanation before or after.

User Question: "{user_question}"

Output:"""

    raw_response = call_llm(prompt, temperature=0.0)
    
    extracted = parse_json_from_llm(raw_response)
    
    if not extracted or not isinstance(extracted, dict):
        print(f"[QueryRouter] resolve_entities JSON parsing failed/empty.")
        # Fallback keyword match in case of LLM offline/parse error
        q = user_question.lower()
        models = db_session.execute(text("SELECT name FROM models")).fetchall()
        factories = db_session.execute(text("SELECT name FROM factories")).fetchall()
        algorithms = db_session.execute(text("SELECT name FROM algorithms")).fetchall()
        
        extracted = {"models": [], "factories": [], "algorithms": []}
        for m in models:
            if m[0].lower() in q:
                extracted["models"].append(m[0])
        for f in factories:
            if f[0].lower() in q:
                extracted["factories"].append(f[0])
        for a in algorithms:
            if a[0].lower() in q:
                extracted["algorithms"].append(a[0])

    # Database-backed alignment post-process: align LLM extractions with DB reality
    q_lower = user_question.lower()
    db_models = [r[0] for r in db_session.execute(text("SELECT name FROM models")).fetchall()]
    db_factories = [r[0] for r in db_session.execute(text("SELECT name FROM factories")).fetchall()]
    db_algorithms = [r[0] for r in db_session.execute(text("SELECT name FROM algorithms")).fetchall()]
    
    # Convert lists to case-insensitive sets for quick membership check
    ext_models_lower = {x.lower() for x in extracted.get("models", [])}
    ext_factories_lower = {x.lower() for x in extracted.get("factories", [])}
    ext_algorithms_lower = {x.lower() for x in extracted.get("algorithms", [])}
    
    for f in db_factories:
        if f.lower() in q_lower and f.lower() not in ext_factories_lower:
            if "factories" not in extracted:
                extracted["factories"] = []
            extracted["factories"].append(f)
            ext_factories_lower.add(f.lower())
            
    for a in db_algorithms:
        if a.lower() in q_lower and a.lower() not in ext_algorithms_lower:
            if "algorithms" not in extracted:
                extracted["algorithms"] = []
            extracted["algorithms"].append(a)
            ext_algorithms_lower.add(a.lower())
            
    for m in db_models:
        if m.lower() in q_lower and m.lower() not in ext_models_lower:
            if "models" not in extracted:
                extracted["models"] = []
            extracted["models"].append(m)
            ext_models_lower.add(m.lower())

    matched_models = []
    matched_factories = []
    matched_algorithms = []

    for name in extracted.get("factories", []):
        factory = db_session.query(Factory).filter(Factory.name.ilike(name)).first()
        if factory:
            matched_factories.append(factory)
            
    for name in extracted.get("algorithms", []):
        algo = db_session.query(Algorithm).filter(Algorithm.name.ilike(name)).first()
        if algo:
            matched_algorithms.append(algo)

    STOP_WORDS = {
        "compare", "model", "models", "version", "versions", "from", "and", "the", "with", 
        "factory", "factories", "in", "of", "for", "to", "on", "at", "by", "or", "a", "an", 
        "is", "are", "was", "were", "which", "what", "how", "why", "algorithm", "algorithms"
    }

    # Query DB using ILIKE for exact case-insensitive matches of models, contextually checking factories
    factory_ids = [f.id for f in matched_factories]
    for name in extracted.get("models", []):
        if factory_ids:
            for fid in factory_ids:
                model = db_session.query(Model).filter(Model.name.ilike(name), Model.factory_id == fid).first()
                if model:
                    matched_models.append(model)
        if not matched_models:
            models = db_session.query(Model).filter(Model.name.ilike(name)).all()
            matched_models.extend(models)

        # Word-level fallback: if no direct name match, check individual words (e.g. "RF" in "RF models")
        if not matched_models:
            words = [w.strip() for w in re.split(r"\W+", name) if len(w) > 1]
            for word in words:
                if word.lower() in STOP_WORDS:
                    continue
                models = db_session.query(Model).filter(Model.name.ilike(f"%{word}%")).all()
                for m in models:
                    if m not in matched_models:
                        matched_models.append(m)

    # Implicit model lookup: if no models matched but factories were specified (and potentially an algorithm or general query words)
    if not matched_models and matched_factories:
        q_words = [w.strip() for w in re.split(r"\W+", user_question) if len(w) > 1]
        for f in matched_factories:
            found = False
            for w in q_words:
                if w.lower() in STOP_WORDS:
                    continue
                model = db_session.query(Model).filter(Model.factory_id == f.id, Model.name.ilike(f"%{w}%")).first()
                if model:
                    matched_models.append(model)
                    found = True
                    break
            
            if not found:
                if matched_algorithms:
                    for a in matched_algorithms:
                        model = db_session.query(Model).filter(
                            Model.factory_id == f.id, 
                            Model.algorithm_id == a.id
                        ).order_by(
                            Model.name.ilike('%test%').asc(), 
                            Model.id.asc()
                        ).first()
                        if model:
                            matched_models.append(model)
                            found = True
                if not found:
                    model = db_session.query(Model).filter(
                        Model.factory_id == f.id
                    ).order_by(
                        Model.name.ilike('%test%').asc(), 
                        Model.id.asc()
                    ).first()
                    if model:
                        matched_models.append(model)

    return {
        "models": matched_models,
        "factories": matched_factories,
        "algorithms": matched_algorithms
    }

def get_database_context(user_question: str, db_session: Session, context: Optional[List[Dict[str, Any]]] = None, resolved_entities: Optional[Dict[str, List[Any]]] = None) -> str:
    """Searches the database for entities matching terms in the query and returns formatted context."""
    entities = resolved_entities or resolve_entities(user_question, db_session, context=context)
    
    matched_factories = entities.get("factories", [])
    matched_algorithms = entities.get("algorithms", [])
    matched_models = entities.get("models", [])
    
    context_lines = []
    
    # Build context for matched factories
    for f in matched_factories:
        context_lines.append(f"--- Factory Entity Found ---")
        context_lines.append(f"Name: {f.name}")
        context_lines.append(f"Description: {f.description or 'No description available'}")
        assoc_models = db_session.execute(
            text("SELECT name FROM models WHERE factory_id = :fid"),
            {"fid": f.id}
        ).fetchall()
        if assoc_models:
            model_names = ", ".join([m.name for m in assoc_models])
            context_lines.append(f"Associated models in this factory: {model_names}")
        context_lines.append("")
        
    # Build context for matched algorithms
    for a in matched_algorithms:
        context_lines.append(f"--- Algorithm Entity Found ---")
        context_lines.append(f"Name: {a.name}")
        context_lines.append(f"Description: {a.description or 'No description available'}")
        assoc_models = db_session.execute(
            text("SELECT name FROM models WHERE algorithm_id = :aid"),
            {"aid": a.id}
        ).fetchall()
        if assoc_models:
            model_names = ", ".join([m.name for m in assoc_models])
            context_lines.append(f"Associated models using this algorithm: {model_names}")
        context_lines.append("")
        
    # Build context for matched models
    for m in matched_models:
        context_lines.append(f"--- Model Entity Found ---")
        context_lines.append(f"Name: {m.name}")
        context_lines.append(f"Description: {m.description or 'No description available'}")
        
        # Get factory and algorithm names
        f_name_res = db_session.execute(text("SELECT name FROM factories WHERE id = :fid"), {"fid": m.factory_id}).fetchone()
        a_name_res = db_session.execute(text("SELECT name FROM algorithms WHERE id = :aid"), {"aid": m.algorithm_id}).fetchone()
        if f_name_res:
            context_lines.append(f"Associated Factory: {f_name_res[0]}")
        if a_name_res:
            context_lines.append(f"Associated Algorithm: {a_name_res[0]}")
            
        # Get versions
        versions = db_session.execute(
            text("""
                SELECT mv.version_number, mv.is_active, mv.accuracy, mv.precision, mv.recall, mv.f1_score, mv.inference_time, mv.note
                FROM model_versions mv
                WHERE mv.model_id = :mid
                ORDER BY mv.version_number ASC
            """),
            {"mid": m.id}
        ).fetchall()
        
        if versions:
            context_lines.append("Versions in Repository:")
            for v in versions:
                status = "Active" if v.is_active else "Inactive"
                metrics = []
                if v.accuracy is not None: metrics.append(f"Accuracy: {v.accuracy}%")
                if v.precision is not None: metrics.append(f"Precision: {v.precision}%")
                if v.recall is not None: metrics.append(f"Recall: {v.recall}%")
                if v.f1_score is not None: metrics.append(f"F1 Score: {v.f1_score}%")
                if v.inference_time is not None: metrics.append(f"Inference Time: {v.inference_time}ms")
                metrics_str = ", ".join(metrics) if metrics else "No metrics recorded"
                context_lines.append(f"  - Version {v.version_number} ({status}): {metrics_str} | Note: {v.note or 'None'}")
        else:
            context_lines.append("No versions registered for this model.")
        context_lines.append("")
        
    return "\n".join(context_lines).strip()

def handle_hybrid_query(user_question: str, db_session: Session, context: Optional[List[Dict[str, Any]]] = None, resolved_entities: Optional[Dict[str, List[Any]]] = None) -> str:
    """Answers a hybrid question combining database entity context and conceptual explanation."""
    db_context = get_database_context(user_question, db_session, context=context, resolved_entities=resolved_entities)
    if not db_context:
        # Fallback to pure knowledge if no entities are resolved in the repository database
        return handle_knowledge_query(user_question)
        
    prompt = f"""You are a helpful AI assistant for MARS, an MLOps platform.
We found the following context in our database repository related to the query:
{db_context}

User question: {user_question}

Please explain this concept and how it relates to the information in our repository.
Your answer should:
1. Explain the conceptual/theoretical aspects of the user's question.
2. Incorporate the specific repository models/versions/factories/metrics found in the database context.
3. Be conversational and formatted nicely in markdown."""

    answer = call_llm(prompt, temperature=0.3)
    if answer == "__LLM_OFFLINE__":
        return "⚠️ I'm sorry, I am currently offline and cannot answer queries. Please try again later."
    return answer
