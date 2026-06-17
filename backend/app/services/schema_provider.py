from typing import Any, Dict, List
from sqlalchemy import inspect
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

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
        inspector = inspect(self.engine)
        schema = {}
        for table_name in inspector.get_table_names():
            columns = inspector.get_columns(table_name)
            schema[table_name] = [col["name"] for col in columns]
        return schema

    def get_detailed_schema(self) -> Dict[str, Any]:
        """
        Extracts full schema details including tables, columns (with types), 
        primary keys, and foreign keys.
        """
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
        return schema_desc

    def generate_prompt_description(self) -> str:
        """
        Generates a text description of the schema, suitable for injecting into LLM system prompts.
        """
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
