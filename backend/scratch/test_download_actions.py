import os
import sys
from pathlib import Path

# Load env variables manually from .env
env_path = Path("c:/Users/Rahul/Desktop/model_lifecycle/backend/.env")
if env_path.exists():
    with open(env_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, val = line.split("=", 1)
                os.environ[key.strip()] = val.strip().strip('"').strip("'")

sys.path.append("c:/Users/Rahul/Desktop/model_lifecycle/backend")

from app.database import SessionLocal
from app.services.chat_pipeline import run_chat_pipeline

def test_query(q):
    print(f"\n==================================================")
    print(f"USER QUERY: '{q}'")
    print("==================================================")
    db = SessionLocal()
    try:
        res = run_chat_pipeline(q, db)
        print("RESPONSE:")
        print(res.get("response"))
        print("\nACTIONS:")
        import json
        print(json.dumps(res.get("actions"), indent=2))
    except Exception as e:
        print(f"Error executing query: {e}")
        import traceback; traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    # Test different download workflows
    test_query("Download the report for YOLOv11")
    test_query("Get ZIP bundle for YOLOv11 version 1")
    test_query("Download factory report for Sejong")
    test_query("Download report of all algorithms")
