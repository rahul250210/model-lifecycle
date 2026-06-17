import time
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import text

def execute_query(
    sql: str, 
    db_session: Session, 
    params: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Executes a validated, read-only SQL query on the database.
    Uses parameterized queries and captures execution time and row count.
    
    Args:
        sql: The validated PostgreSQL query string to execute.
        db_session: Active SQLAlchemy Session instance.
        params: Optional dictionary of query parameters.
        
    Returns:
        A dictionary containing:
        - "rows": List of dictionaries, each representing a row (column names mapped to values).
        - "execution_time": Time taken to execute the query and fetch results, in seconds (float).
        - "row_count": Number of rows returned by the query.
    """
    start_time = time.perf_counter()
    
    # Execute the query
    result = db_session.execute(text(sql), params or {})
    
    # Fetch column names and map results to list of dicts
    cols = list(result.keys())
    rows = [dict(zip(cols, r)) for r in result]
    
    execution_time = time.perf_counter() - start_time
    
    return {
        "rows": rows,
        "execution_time": execution_time,
        "row_count": len(rows)
    }
