import re
from typing import Any, Dict, Union, List
import sqlglot
from sqlglot import exp
from sqlglot.optimizer.qualify import qualify
from app.services.schema_provider import SchemaProvider

def validate_sql(sql: str, schema: Union[Dict[str, Any], SchemaProvider]) -> Dict[str, Any]:
    """
    Validates a SQL query using sqlglot against read-only rules and a schema.
    
    Rules:
    1. Allow only SELECT and WITH statements.
    2. Reject INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, TRUNCATE.
    3. Verify that all tables and columns referenced in the query exist in the schema.
    4. Add automatic LIMIT 100 if missing.
    
    Returns:
       {
           "valid": bool,
           "sql": str (updated SQL query if valid, else empty string),
           "errors": list of str (error messages if invalid)
       }
    """
    errors: List[str] = []
    
    # 1. Parse query
    try:
        statements = [stmt for stmt in sqlglot.parse(sql, read="postgres") if stmt is not None]
    except Exception as e:
        return {
            "valid": False,
            "sql": "",
            "errors": [f"SQL Parse Error: {str(e)}"]
        }
        
    if not statements:
        return {
            "valid": False,
            "sql": "",
            "errors": ["No SQL statement found."]
        }
        
    if len(statements) > 1:
        return {
            "valid": False,
            "sql": "",
            "errors": ["Only a single SQL statement is allowed."]
        }
        
    parsed = statements[0]
    
    # 2. Check statement type (must be exp.Query)
    if not isinstance(parsed, exp.Query):
        return {
            "valid": False,
            "sql": "",
            "errors": ["Only SELECT and WITH queries are allowed."]
        }
        
    # 3. Check for forbidden DDL/DML nodes
    forbidden_types = (
        exp.Insert,
        exp.Update,
        exp.Delete,
        exp.Drop,
        exp.Alter,
        exp.Create,
        exp.TruncateTable,
        exp.Into,
        exp.Merge
    )
    
    forbidden_nodes = list(parsed.find_all(forbidden_types))
    if forbidden_nodes:
        node_names = sorted(list({node.__class__.__name__ for node in forbidden_nodes}))
        errors.append(f"Destructive or write operations are not allowed (found: {', '.join(node_names)}).")
        return {
            "valid": False,
            "sql": "",
            "errors": errors
        }
        
    # 4. Resolve/Extract Schema Description
    schema_dict = {}
    if isinstance(schema, SchemaProvider):
        schema_dict = schema.get_detailed_schema()
    elif hasattr(schema, "get_detailed_schema"):
        schema_dict = schema.get_detailed_schema()
    elif hasattr(schema, "get_simplified_schema"):
        schema_dict = schema.get_simplified_schema()
    elif isinstance(schema, dict):
        schema_dict = schema
    else:
        errors.append("Invalid schema type provided.")
        return {
            "valid": False,
            "sql": "",
            "errors": errors
        }
        
    # Normalize schema for sqlglot
    sqlglot_schema = {}
    for table_name, info in schema_dict.items():
        table_lower = table_name.lower()
        if isinstance(info, list):
            sqlglot_schema[table_lower] = {col.lower(): "" for col in info}
        elif isinstance(info, dict):
            cols = info.get("columns", [])
            if cols:
                col_dict = {}
                for col in cols:
                    if isinstance(col, dict):
                        col_dict[col["name"].lower()] = str(col.get("type", ""))
                    else:
                        col_dict[str(col).lower()] = ""
                sqlglot_schema[table_lower] = col_dict
            else:
                sqlglot_schema[table_lower] = {
                    k.lower(): str(v) for k, v in info.items()
                }
                
    # 5. Verify tables exist
    ctes = {cte.alias_or_name.lower() for cte in parsed.find_all(exp.CTE)}
    
    referenced_tables = []
    for t_node in parsed.find_all(exp.Table):
        t_name = t_node.name.lower()
        if t_name not in ctes:
            referenced_tables.append(t_node.name)
            if t_name not in sqlglot_schema:
                errors.append(f"Table '{t_node.name}' does not exist in the database schema.")
                
    if errors:
        return {
            "valid": False,
            "sql": "",
            "errors": errors
        }
        
    # 6. Verify columns exist via qualify
    try:
        qualify(parsed.copy(), schema=sqlglot_schema)
    except Exception as e:
        errors.append(f"Column/Query validation error: {str(e)}")
        return {
            "valid": False,
            "sql": "",
            "errors": errors
        }
        
    # 7. Add LIMIT 100 if missing
    if parsed.args.get("limit") is None:
        parsed = parsed.limit(100)
        
    # Generate final validated SQL in PostgreSQL dialect
    validated_sql = parsed.sql(dialect="postgres")
    
    return {
        "valid": True,
        "sql": validated_sql,
        "errors": []
    }
