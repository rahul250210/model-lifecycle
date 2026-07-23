import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import SessionLocal
from app.services.query_dispatcher import run_sql_agent

db = SessionLocal()
q = "compare accuracy of FAS in Sejong and workers in Worker Fall Detection"
res = run_sql_agent(q, db)
print("AGGREGATE COMPARISON RESULT:")
print("Type:", res.get("type"))
print("Answer:", repr(res.get("answer")))
print("SQL:", res.get("sql"))
print("Data keys:", res.get("data") is not None)
