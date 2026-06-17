import sys
import os
from pathlib import Path

# Load env
env_path = Path("c:/Users/Rahul/Desktop/model_lifecycle/backend/.env")
if env_path.exists():
    with open(env_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, val = line.split("=", 1)
                os.environ[key.strip()] = val.strip().strip('"').strip("'")

sys.path.append("c:/Users/Rahul/Desktop/model_lifecycle/backend")

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.services.sql_agent import run_sql_agent

DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
db = SessionLocal()

try:
    # Set sys.stdout to output utf-8
    import sys
    import io
    if hasattr(sys.stdout, 'buffer'):
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

    q1 = "List all artifact names and types"
    print(f"Running agent on: {q1}")
    res1 = run_sql_agent(q1, db)
    print("Agent Response 1:")
    print(res1.get("answer"))
    print(f"Type: {res1.get('type')}")
    print(f"Data: {res1.get('data')}")
    print(f"Verified: {res1.get('verified')}\n")

finally:
    db.close()
