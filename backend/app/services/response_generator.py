import json
from typing import Any, Dict, List, Union
from app.services.llm_service import call_llm

def generate_response(
    user_question: str,
    generated_sql: str,
    query_results: Union[List[Dict[str, Any]], Dict[str, Any]],
    temperature: float = 0.3
) -> str:
    """
    Generates a natural language response explaining database query results.
    
    Responsibilities:
    1. Explain results in natural language.
    2. Summarize large result sets.
    3. Produce markdown tables when appropriate.
    4. Never expose internal schema unless requested.
    5. Never expose stack traces.
    
    Args:
        user_question: The original user question.
        generated_sql: The SQL query that was generated and executed.
        query_results: Raw query execution output (either a list of rows or execution dictionary).
        temperature: Model sampling temperature.
        
    Returns:
        The final markdown-formatted chatbot response string.
    """
    # Normalize results input
    if isinstance(query_results, dict):
        rows = query_results.get("rows", [])
    elif isinstance(query_results, list):
        rows = query_results
    else:
        rows = [query_results]
        
    # Serialize to JSON for prompt injection
    results_json = json.dumps(rows, default=str)
    
    prompt = f"""You are MIRA, an intelligent AI assistant for the MARS MLOps platform.
Your task is to answer the user's question by explaining the database query results in natural, friendly, and professional language.

USER QUESTION:
{user_question}

GENERATED SQL QUERY:
{generated_sql}

QUERY RESULTS (JSON):
{results_json}

INSTRUCTIONS:
1. Explain the query results clearly in natural language relative to the user's question.
2. If the result set is large, summarize the key findings, trends, or top entries rather than printing every row.
3. When listing multiple factories, algorithms, or models, do NOT use tables. Use bulleted lists instead.
4. For each factory, algorithm, or model in the list, format its name as a Markdown hyperlink to its overview page. Use these exact URL structures:
   - Factory: `/factories/{{id}}`
   - Algorithm: `/algorithms/{{id}}`
   - Model: `/algorithms/{{algorithm_id}}/factories/{{factory_id}}/models/{{id}}`
   (Note: Use the actual numeric IDs from the JSON results in the URLs, e.g., `/factories/1`).
5. NEVER display database IDs in the visible text of the response. IDs should ONLY be used behind the scenes inside the Markdown URLs.
6. Produce markdown tables ONLY for comparisons (e.g., comparing metrics across models or versions).
7. Do NOT mention internal database schema details (such as database table names, column names, join conditions, schema keys) unless the user explicitly asked for them. Translate them into user-friendly business terms (e.g. instead of 'model_versions table', use 'model versions').
8. NEVER expose any database stack traces, raw SQL execution errors, or internal technical code details.
9. Provide a concise, professional answer.

Response:"""

    response = call_llm(prompt, temperature=temperature)
    return response.strip()
