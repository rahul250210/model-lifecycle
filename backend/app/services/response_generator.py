import json
import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional
from app.services.planner_llm import QueryPlan

class CustomEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        if isinstance(obj, (datetime.datetime, datetime.date)):
            return obj.isoformat()
        return super().default(obj)

def generate_response_llm(
    query_plan: QueryPlan,
    sql_results: List[Dict[str, Any]],
    question: str
) -> Optional[str]:
    """
    Transforms verified database results into a user-friendly markdown explanation using the LLM.
    If the LLM is offline or fails, returns None to allow falling back to structured formatters.
    """
    if not sql_results:
        return None

    # Format query plan details for prompt readability
    tasks_info = []
    for t in query_plan.tasks:
        tasks_info.append({
            "type": t.type,
            "entity_types": t.entity_types,
            "entity_names": t.entity_names,
            "metric": t.metric,
            "operation": t.operation,
            "filters": t.filters
        })
    
    plan_json = json.dumps(tasks_info, indent=2)
    results_json = json.dumps(sql_results, cls=CustomEncoder, indent=2)

    prompt = f"""You are MIRA, a professional AI assistant for the MARS MLOps platform.
Your task is to transform the verified database query results into a clear, user-friendly markdown explanation.

User Question: "{question}"
Query Plan Tasks:
{plan_json}

SQL Query Results:
{results_json}

Rules:
1. Provide a professional, natural, and helpful explanation of the results.
2. Ground your explanation STRICTLY in the SQL Query Results.
3. NEVER invent or hallucinate metrics, version numbers, factories, or algorithm names that are not explicitly present in the SQL Query Results.
4. If a value is missing, None, or empty in the results, report it as "Not Available".
5. Use markdown tables, lists, and bold text where appropriate to structure the information and make it highly readable.
6. Do NOT mention any internal system details like the query plan, SQL queries, database schema, tables, or technical jargon.
7. Return ONLY the markdown response itself. Do not include any prefix, suffix, or extra comments.

Markdown Response:"""

    try:
        # Dynamic import to prevent circular dependency
        from app.services.llm_service import call_llm
        response_str = call_llm(prompt, temperature=0.2)
        if response_str == "__LLM_OFFLINE__" or not response_str.strip():
            return None
        return response_str.strip()
    except Exception as e:
        print(f"[ResponseGenerator] LLM response generation failed: {e}")
        return None
