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

from app.database import engine
from app.services.schema_provider import SchemaProvider
from app.services.text_to_sql import generate_sql

try:
    print("Initializing SchemaProvider...")
    provider = SchemaProvider(engine)
    schema = provider.get_detailed_schema()

    query = "Find the models in the Sejong factory with an accuracy greater than 85%"
    print(f"\nUser query: '{query}'")
    print("Generating SQL...")
    result = generate_sql(query, schema)

    print("\n--- RESULT ---")
    print(f"SQL:\n{result.get('sql')}")
    print(f"Reasoning:\n{result.get('reasoning')}")
    
    print("\nSuccess! text_to_sql executed cleanly.")
except Exception as e:
    print(f"Error: {e}")
    import traceback; traceback.print_exc()
    sys.exit(1)
