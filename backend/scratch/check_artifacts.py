import sys
import os
from pathlib import Path
from sqlalchemy import text

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

DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
db = SessionLocal()

try:
    res = db.execute(text("SELECT COUNT(*) FROM artifacts")).fetchone()
    print("Artifacts count:", res[0])
    
    rows = db.execute(text("SELECT * FROM artifacts LIMIT 3")).fetchall()
    print("Sample artifacts:")
    for r in rows:
        print(dict(r._mapping))
finally:
    db.close()
