import json
import re
from typing import Any, Dict, List, Union
from app.services.llm_service import call_llm

def generate_sql(user_query: str, schema_description: Union[str, Dict[str, Any]]) -> Dict[str, str]:
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
    prompt = f"""You are a database-connected AI assistant translating a user question into a PostgreSQL query.

DATABASE SCHEMA DESCRIPTION:
{schema_str}

STRICT SQL GENERATION RULES:
1. ONLY reference tables and columns defined in the schema above. Do not hallucinate or use any other tables/columns.
2. The generated query must be compatible with PostgreSQL.
3. Use case-insensitive matching where appropriate (e.g. ILIKE for search/filter operations on text columns).
4. ALWAYS append "LIMIT 100" to the generated SQL query unless the query is an aggregation (e.g. contains COUNT, SUM, AVG, MIN, MAX, GROUP BY).
5. The query must be strictly READ-ONLY. NEVER generate any write operations: INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, or CREATE.

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

    # 4. Parse JSON safely from LLM output
    response_clean = response.strip()
    # Remove markdown code block fences if the LLM wrapped it anyway
    match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', response_clean, re.DOTALL)
    if match:
        response_clean = match.group(1)

    try:
        result = json.loads(response_clean)
        # Ensure return fields are present
        if "sql" not in result:
            result["sql"] = ""
        if "reasoning" not in result:
            result["reasoning"] = "No reasoning provided by LLM."
        return result
    except json.JSONDecodeError:
        # Try finding first '{' and last '}'
        start = response_clean.find('{')
        end = response_clean.rfind('}')
        if start != -1 and end != -1:
            try:
                result = json.loads(response_clean[start:end+1])
                if "sql" not in result:
                    result["sql"] = ""
                if "reasoning" not in result:
                    result["reasoning"] = "No reasoning provided."
                return result
            except json.JSONDecodeError:
                pass

        # Return failure fallback
        return {
            "sql": "",
            "reasoning": f"Failed to parse JSON response from LLM. Raw response: {response}"
        }


def regenerate_sql(
    user_query: str,
    schema_description: Union[str, Dict[str, Any]],
    failed_sql: str,
    validation_errors: List[str]
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
    prompt = f"""You are a database-connected AI assistant translating a user question into a PostgreSQL query.
Your previous generated SQL query failed validation checks. You must correct the SQL query to resolve the validation errors.

DATABASE SCHEMA DESCRIPTION:
{schema_str}

STRICT SQL GENERATION RULES:
1. ONLY reference tables and columns defined in the schema above. Do not hallucinate or use any other tables/columns.
2. The generated query must be compatible with PostgreSQL.
3. Use case-insensitive matching where appropriate (e.g. ILIKE for search/filter operations on text columns).
4. ALWAYS append "LIMIT 100" to the generated SQL query unless the query is an aggregation (e.g. contains COUNT, SUM, AVG, MIN, MAX, GROUP BY).
5. The query must be strictly READ-ONLY. NEVER generate any write operations: INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, or CREATE.

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

    # 4. Parse JSON safely from LLM output
    response_clean = response.strip()
    match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', response_clean, re.DOTALL)
    if match:
        response_clean = match.group(1)

    try:
        result = json.loads(response_clean)
        if "sql" not in result:
            result["sql"] = ""
        if "reasoning" not in result:
            result["reasoning"] = "No reasoning provided."
        return result
    except json.JSONDecodeError:
        start = response_clean.find('{')
        end = response_clean.rfind('}')
        if start != -1 and end != -1:
            try:
                result = json.loads(response_clean[start:end+1])
                if "sql" not in result:
                    result["sql"] = ""
                if "reasoning" not in result:
                    result["reasoning"] = "No reasoning provided."
                return result
            except json.JSONDecodeError:
                pass

        return {
            "sql": "",
            "reasoning": f"Failed to parse JSON response from LLM. Raw response: {response}"
        }

