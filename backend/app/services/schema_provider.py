from typing import Any, Dict, List
from sqlalchemy import inspect
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

_DETAILED_SCHEMA_CACHE: Dict[str, Dict[str, Any]] = {}
_SIMPLIFIED_SCHEMA_CACHE: Dict[str, Dict[str, List[str]]] = {}

class SchemaProvider:
    """
    SchemaProvider dynamically discovers database metadata (tables, columns,
    primary keys, and foreign keys) to describe the database layout.
    """
    def __init__(self, engine: Engine):
        self.engine = engine

    @classmethod
    def from_session(cls, db_session: Session) -> 'SchemaProvider':
        """
        Creates a SchemaProvider from a SQLAlchemy Session instance.
        """
        return cls(db_session.bind)

    def get_simplified_schema(self) -> Dict[str, List[str]]:
        """
        Generates a simplified schema description object mapping table names to their columns list.
        Example:
        {
          "models": ["id", "name", "description", "created_at"]
        }
        """
        cache_key = str(self.engine.url)
        if cache_key in _SIMPLIFIED_SCHEMA_CACHE:
            return _SIMPLIFIED_SCHEMA_CACHE[cache_key]
            
        inspector = inspect(self.engine)
        schema = {}
        for table_name in inspector.get_table_names():
            columns = inspector.get_columns(table_name)
            schema[table_name] = [col["name"] for col in columns]
        
        _SIMPLIFIED_SCHEMA_CACHE[cache_key] = schema
        return schema

    def get_detailed_schema(self) -> Dict[str, Any]:
        """
        Extracts full schema details including tables, columns (with types), 
        primary keys, and foreign keys.
        """
        cache_key = str(self.engine.url)
        if cache_key in _DETAILED_SCHEMA_CACHE:
            return _DETAILED_SCHEMA_CACHE[cache_key]
            
        inspector = inspect(self.engine)
        schema_desc = {}
        for table_name in inspector.get_table_names():
            columns = inspector.get_columns(table_name)
            pk_info = inspector.get_pk_constraint(table_name)
            fk_info = inspector.get_foreign_keys(table_name)

            schema_desc[table_name] = {
                "columns": [
                    {
                        "name": col["name"],
                        "type": str(col["type"]),
                        "nullable": col.get("nullable", True)
                    }
                    for col in columns
                ],
                "primary_keys": pk_info.get("constrained_columns", []),
                "foreign_keys": [
                    {
                        "constrained_columns": fk["constrained_columns"],
                        "referred_table": fk["referred_table"],
                        "referred_columns": fk["referred_columns"]
                    }
                    for fk in fk_info
                ]
            }
            
        _DETAILED_SCHEMA_CACHE[cache_key] = schema_desc
        return schema_desc

    @classmethod
    def invalidate_cache(cls):
        """
        Invalidates the module-level schema cache.
        """
        _DETAILED_SCHEMA_CACHE.clear()
        _SIMPLIFIED_SCHEMA_CACHE.clear()

    def get_pruned_schema(self, user_query: str) -> Dict[str, Any]:
        """
        Returns the detailed schema.
        Note: Keyword-based pruning was removed because it caused silent missing-table failures. 
        Token cost for this schema size is negligible.
        TODO: A smarter LLM-driven table selection approach could be implemented as the next improvement.
        """
        return self.get_detailed_schema()

    def generate_prompt_description(self, user_query: str = None) -> str:
        """
        Generates a text description of the schema, suitable for injecting into LLM system prompts.
        If user_query is provided, prunes the schema first to save context tokens.
        """
        if user_query:
            schema_desc = self.get_pruned_schema(user_query)
        else:
            schema_desc = self.get_detailed_schema()
        lines = []
        for table_name, info in schema_desc.items():
            lines.append(f"Table: {table_name}")
            col_list = ", ".join(col["name"] for col in info["columns"])
            lines.append(f"  Columns: {col_list}")
            if info["primary_keys"]:
                lines.append(f"  Primary Key(s): {', '.join(info['primary_keys'])}")
            if info["foreign_keys"]:
                for fk in info["foreign_keys"]:
                    local_cols = ", ".join(fk["constrained_columns"])
                    ref_cols = ", ".join(fk["referred_columns"])
                    lines.append(f"  Foreign Key: ({local_cols}) references {fk['referred_table']}({ref_cols})")
            lines.append("")
        return "\n".join(lines)
