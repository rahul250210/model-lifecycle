import os
import shutil
import sys
from pathlib import Path

# Load env file manually to ensure DATABASE_URL is read correctly
def load_env_manually():
    env_path = Path(__file__).resolve().parent / ".env"
    if env_path.exists():
        print(f"Loading environment variables from {env_path}...")
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, val = line.split("=", 1)
                    # Strip quotes if any
                    val = val.strip().strip('"').strip("'")
                    os.environ[key.strip()] = val
    else:
        print("Warning: .env file not found in the current directory.")

load_env_manually()

# Add backend directory to sys.path to allow imports
sys.path.append(str(Path(__file__).resolve().parent))

# Import database configuration and all models so SQLAlchemy is aware of them
try:
    from app.database import Base, engine
    # Import standard models (automatically registered through app.models imports)
    import app.models
    # Import knowledge base models
    from app.models.algorithm_knowledge import AlgorithmKnowledge
    from app.models.algorithm_knowledge_file import AlgorithmKnowledgeFile
except ImportError as e:
    print(f"Error importing modules: {e}")
    sys.exit(1)

def main():
    print("=" * 60)
    print("                 DATABASE RESET UTILITY")
    print("=" * 60)
    print(f"Target Database URL: {os.getenv('DATABASE_URL')}")
    print("This will:")
    print("1. DROP all tables in the database.")
    print("2. CREATE all tables clean and empty.")
    print("3. DELETE all uploaded files in the 'storage/' directory.")
    print("-" * 60)
    
    confirm = input("Are you absolutely sure you want to proceed? (yes/no): ").strip().lower()
    if confirm != "yes":
        print("Reset cancelled.")
        return

    # 1. Drop and recreate tables
    print("\nDropping database tables...")
    try:
        Base.metadata.drop_all(bind=engine)
        print("Tables dropped successfully.")
        
        print("Creating clean database tables...")
        Base.metadata.create_all(bind=engine)
        print("Tables created successfully.")
    except Exception as e:
        print(f"Database operation failed: {e}")
        print("Please check database connection credentials and try again.")
        sys.exit(1)

    # 2. Clear storage folder
    storage_dir = Path(__file__).resolve().parent / "storage"
    if storage_dir.exists():
        print(f"\nClearing storage directory: {storage_dir}...")
        try:
            # Delete contents but keep the folder
            for item in storage_dir.iterdir():
                if item.is_dir():
                    shutil.rmtree(item)
                else:
                    item.unlink()
            print("Storage directory cleared successfully.")
        except Exception as e:
            print(f"Warning: Failed to clear some storage files: {e}")
    else:
        print("\nStorage directory does not exist yet (no files to delete).")

    print("\n" + "=" * 60)
    print("DATABASE RESET COMPLETED SUCCESSFULLY!")
    print("=" * 60)

if __name__ == "__main__":
    main()
