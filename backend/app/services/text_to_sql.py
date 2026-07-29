import json
import re
from typing import Any, Dict, List, Union
from app.services.llm_service import call_llm, parse_json_from_llm

def _format_context(context: List[Dict[str, Any]]) -> str:
    if not context:
        return ""
    formatted = []
    for msg in context:
        role = "User" if msg.get("role") == "user" else "Assistant"
        content = msg.get("content", "")
        if content:
            formatted.append(f"{role}: {content}")
    return "\n".join(formatted)

def generate_sql(
    user_query: str,
    schema_description: Union[str, Dict[str, Any]],
    context: List[Dict[str, Any]] = [],
    known_entities: Dict[str, List[str]] = None
) -> Dict[str, str]:
    """
    Generates a PostgreSQL query from a user query under strict schema constraints
    and safety rules using the LLM service.
    
    Returns:
        Dict containing "sql" and "reasoning".
    """
    # 1. Format the schema description into a clean string if it's a dictionary
    if isinstance(schema_description, dict):
        lines = []
        for table, info in schema_description.items():
            lines.append(f"Table: {table}")
            if isinstance(info, list):
                # Simple list of columns
                lines.append(f"  Columns: {', '.join(info)}")
            elif isinstance(info, dict):
                # Detailed dictionary with columns, PK, FK
                cols = info.get("columns", [])
                if cols and isinstance(cols[0], dict):
                    col_list = ", ".join(c["name"] for c in cols)
                else:
                    col_list = ", ".join(cols)
                lines.append(f"  Columns: {col_list}")
                if info.get("primary_keys"):
                    lines.append(f"  Primary Keys: {', '.join(info['primary_keys'])}")
                if info.get("foreign_keys"):
                    for fk in info["foreign_keys"]:
                        local = ", ".join(fk["constrained_columns"])
                        ref_tbl = fk["referred_table"]
                        ref_cols = ", ".join(fk["referred_columns"])
                        lines.append(f"  Foreign Key: ({local}) -> {ref_tbl}({ref_cols})")
            lines.append("")
        schema_str = "\n".join(lines)
    else:
        schema_str = str(schema_description)

    # 2. Build the system/instruction prompt
    history_str = _format_context(context)
    history_section = f"\nCONVERSATION HISTORY:\n{history_str}\n" if history_str else ""

    known_entities_section = ""
    if known_entities:
        known_entities_section = "\nKNOWN EXTRACTED ENTITIES FROM QUERY:\n"
        if known_entities.get("models"):
            known_entities_section += f"- Models: {', '.join(known_entities['models'])}\n"
        if known_entities.get("algorithms"):
            known_entities_section += f"- Algorithms: {', '.join(known_entities['algorithms'])}\n"
        if known_entities.get("factories"):
            known_entities_section += f"- Factories: {', '.join(known_entities['factories'])}\n"
        known_entities_section += "\nIMPORTANT: Use these exact names when filtering their respective tables (e.g. models.name ILIKE '%name%'). Do not mix up model names with algorithm or factory names.\n"

    prompt = f"""You are a database-connected AI assistant translating a user question into a PostgreSQL query.
{history_section}{known_entities_section}
DATABASE SCHEMA DESCRIPTION:
{schema_str}

STRICT SQL GENERATION RULES:
1. ONLY reference tables and columns defined in the schema above. Do not hallucinate or use any other tables/columns.
2. The generated query must be compatible with PostgreSQL.
3. Use case-insensitive matching where appropriate (e.g. ILIKE for search/filter operations on text columns).
4. ALWAYS append "LIMIT 100" to the generated SQL query unless the query is an aggregation (e.g. contains COUNT, SUM, AVG, MIN, MAX, GROUP BY).
5. The query must be strictly READ-ONLY. NEVER generate any write operations: INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, or CREATE.
6. ALWAYS link a model to its factory using `models.factory_id = factories.id`. DO NOT use `factories.created_by_algorithm_id` to find a model's factory.
7. When querying a list of entities (factories, algorithms, models, versions), ALWAYS select their primary key `id` and any foreign keys (e.g. `factory_id`, `algorithm_id`, `model_id`). ALWAYS ensure the primary display name is selected as `name` (do not alias it to 'model' or 'factory'). This allows the frontend UI to render interactive cards.
8. When listing algorithms associated with a factory (or factories for an algorithm), you MUST include BOTH algorithms that have deployed models in that factory (via the `models` table) AND the algorithm that created the factory (via `factories.created_by_algorithm_id`). You should use a UNION or an OR condition to get all relevant algorithms, since relying on just one method will miss some algorithms.
9. When asked to compare models or versions, ALWAYS include the factory name (alias as `factory_name`) alongside the model name and version number. Also, pay close attention to the scope: ONLY filter by `is_active = true` if the user explicitly mentions "active", "deployed", or "current". If they ask for "all", do NOT filter by `is_active`.

OUTPUT FORMAT:
You must respond with a single JSON object in the exact format shown below:
{{
  "sql": "the generated PostgreSQL query",
  "reasoning": "step-by-step reasoning explaining the columns used, joins made, and logic followed"
}}

Do NOT wrap the output in markdown code blocks. Return ONLY the JSON object.

User Question: {user_query}
JSON Output:"""

    # 3. Call the LLM
    response = call_llm(prompt, temperature=0.0)
    if response == "__LLM_OFFLINE__":
        return {
            "sql": "",
            "reasoning": "__LLM_OFFLINE__: LLM server is down."
        }

    # 4. Parse JSON safely from LLM output
    result = parse_json_from_llm(response)
    if not result:
        return {
            "sql": "",
            "reasoning": f"Failed to parse JSON response from LLM. Raw response: {response}"
        }
        
    if "sql" not in result:
        result["sql"] = ""
    if "reasoning" not in result:
        result["reasoning"] = "No reasoning provided by LLM."
    return result


def regenerate_sql(
    user_query: str,
    schema_description: Union[str, Dict[str, Any]],
    failed_sql: str,
    validation_errors: List[str],
    context: List[Dict[str, Any]] = [],
    known_entities: Dict[str, List[str]] = None
) -> Dict[str, str]:
    """
    Asks the LLM to correct/regenerate a SQL query that failed validation.
    
    Returns:
        Dict containing "sql" and "reasoning".
    """
    # 1. Format the schema description into a clean string if it's a dictionary
    if isinstance(schema_description, dict):
        lines = []
        for table, info in schema_description.items():
            lines.append(f"Table: {table}")
            if isinstance(info, list):
                lines.append(f"  Columns: {', '.join(info)}")
            elif isinstance(info, dict):
                cols = info.get("columns", [])
                if cols and isinstance(cols[0], dict):
                    col_list = ", ".join(c["name"] for c in cols)
                else:
                    col_list = ", ".join(cols)
                lines.append(f"  Columns: {col_list}")
                if info.get("primary_keys"):
                    lines.append(f"  Primary Keys: {', '.join(info['primary_keys'])}")
                if info.get("foreign_keys"):
                    for fk in info["foreign_keys"]:
                        local = ", ".join(fk["constrained_columns"])
                        ref_tbl = fk["referred_table"]
                        ref_cols = ", ".join(fk["referred_columns"])
                        lines.append(f"  Foreign Key: ({local}) -> {ref_tbl}({ref_cols})")
            lines.append("")
        schema_str = "\n".join(lines)
    else:
        schema_str = str(schema_description)

    # 2. Build correction prompt
    history_str = _format_context(context)
    history_section = f"\nCONVERSATION HISTORY:\n{history_str}\n" if history_str else ""

    known_entities_section = ""
    if known_entities:
        known_entities_section = "\nKNOWN EXTRACTED ENTITIES FROM QUERY:\n"
        if known_entities.get("models"):
            known_entities_section += f"- Models: {', '.join(known_entities['models'])}\n"
        if known_entities.get("algorithms"):
            known_entities_section += f"- Algorithms: {', '.join(known_entities['algorithms'])}\n"
        if known_entities.get("factories"):
            known_entities_section += f"- Factories: {', '.join(known_entities['factories'])}\n"
        known_entities_section += "\nIMPORTANT: Use these exact names when filtering their respective tables (e.g. models.name ILIKE '%name%'). Do not mix up model names with algorithm or factory names.\n"

    prompt = f"""You are a database-connected AI assistant translating a user question into a PostgreSQL query.
{history_section}
Your previous generated SQL query failed validation checks. You must correct the SQL query to resolve the validation errors.
{known_entities_section}
DATABASE SCHEMA DESCRIPTION:
{schema_str}

STRICT SQL GENERATION RULES:
1. ONLY reference tables and columns defined in the schema above. Do not hallucinate or use any other tables/columns.
2. The generated query must be compatible with PostgreSQL.
3. Use case-insensitive matching where appropriate (e.g. ILIKE for search/filter operations on text columns).
4. ALWAYS append "LIMIT 100" to the generated SQL query unless the query is an aggregation (e.g. contains COUNT, SUM, AVG, MIN, MAX, GROUP BY).
5. The query must be strictly READ-ONLY. NEVER generate any write operations: INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, or CREATE.
6. ALWAYS link a model to its factory using `models.factory_id = factories.id`. DO NOT use `factories.created_by_algorithm_id` to find a model's factory.
7. When querying a list of entities (factories, algorithms, models, versions), ALWAYS select their primary key `id` and any foreign keys (e.g. `factory_id`, `algorithm_id`, `model_id`). ALWAYS ensure the primary display name is selected as `name` (do not alias it to 'model' or 'factory'). This allows the frontend UI to render interactive cards.
8. When listing algorithms associated with a factory (or factories for an algorithm), you MUST include BOTH algorithms that have deployed models in that factory (via the `models` table) AND the algorithm that created the factory (via `factories.created_by_algorithm_id`). You should use a UNION or an OR condition to get all relevant algorithms, since relying on just one method will miss some algorithms.
9. When asked to compare models or versions, ALWAYS include the factory name (alias as `factory_name`) alongside the model name and version number. Also, pay close attention to the scope: ONLY filter by `is_active = true` if the user explicitly mentions "active", "deployed", or "current". If they ask for "all", do NOT filter by `is_active`.

PREVIOUS ATTEMPT DETAILS:
User Question: {user_query}
Failed SQL: {failed_sql}
Validation Errors: {', '.join(validation_errors)}

OUTPUT FORMAT:
You must respond with a single JSON object in the exact format shown below:
{{
  "sql": "the corrected PostgreSQL query",
  "reasoning": "explanation of what you corrected to fix the validation errors"
}}

Do NOT wrap the output in markdown code blocks. Return ONLY the JSON object.

JSON Output:"""

    # 3. Call the LLM
    response = call_llm(prompt, temperature=0.0)

    result = parse_json_from_llm(response)
    if not result:
        return {
            "sql": "",
            "reasoning": f"Failed to parse JSON response from LLM. Raw response: {response}"
        }
        
    if "sql" not in result:
        result["sql"] = ""
    if "reasoning" not in result:
        result["reasoning"] = "No reasoning provided."
    return result

