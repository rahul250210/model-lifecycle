import time
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from app.services.sql_agent import AliasCache, EntityExtractor, ContextMemory, resolve_context_rules
from app.services.schema_provider import SchemaProvider
from app.services.text_to_sql import generate_sql, regenerate_sql
from app.services.sql_validator import validate_sql
from app.services.query_executor import execute_query
from app.services.response_generator import generate_response

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
            "answer": str (the conversational markdown answer),
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
    
    duration_ms = int((time.time() - start_time) * 1000)
    print(f"[ChatPipeline] Completed pipeline in {duration_ms}ms")
    
    return {
        "answer": final_answer,
        "type": "text",
        "confidence": 1.0
    }
