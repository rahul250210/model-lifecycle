import sys
import os
from pathlib import Path
import io

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
from app.services.sql_agent import EntityExtractor, _run_download

DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
db = SessionLocal()

try:
    if hasattr(sys.stdout, 'buffer'):
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

    extractor = EntityExtractor(db)
    
    queries = [
        "download the report of FAS(Algorithm name)",
        "download the report of Suwon factory"
    ]
    
    for q in queries:
        print(f"Query: {q}")
        entities = extractor.extract(q)
        print("Extracted Entities:")
        print(f"  Models: {entities.get('models')}")
        print(f"  Factories: {entities.get('factories')}")
        print(f"  Algorithms: {entities.get('algorithms')}")
        
        # Test _run_download
        res = _run_download(q, entities)
        print("Download Output:")
        print(f"  report_type: {res.get('report_type')}")
        print(f"  report_name: {res.get('report_name')}")
        print(f"  answer: {res.get('answer')}")
        print("-" * 50)
        
finally:
    db.close()
