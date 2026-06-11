from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import factories, algorithms, models, versions, experiments, artifacts, auth, dashboard, chatbot
from app.api.knowledge_base import router as kb_router
from app.database import Base, engine
from sqlalchemy import text

def run_db_migrations():
    try:
        with engine.connect() as conn:
            is_postgres = (engine.dialect.name == 'postgresql')
            
            if is_postgres:
                res_table = conn.execute(text("SELECT to_regclass('public.models');")).fetchone()
                if res_table and res_table[0]:
                    res_col = conn.execute(text("""
                        SELECT column_name 
                        FROM information_schema.columns 
                        WHERE table_name='models' AND column_name='factory_id';
                    """)).fetchone()
                    
                    if not res_col:
                        conn.execute(text("ALTER TABLE models ADD COLUMN factory_id INTEGER;"))
                        conn.execute(text("""
                            ALTER TABLE models 
                            ADD CONSTRAINT fk_models_factory 
                            FOREIGN KEY (factory_id) 
                            REFERENCES factories(id) 
                            ON DELETE CASCADE;
                        """))
                        
                        res_algo = conn.execute(text("""
                            SELECT column_name 
                            FROM information_schema.columns 
                            WHERE table_name='algorithms' AND column_name='factory_id';
                        """)).fetchone()
                        
                        if res_algo:
                            conn.execute(text("""
                                UPDATE models 
                                SET factory_id = algorithms.factory_id 
                                FROM algorithms 
                                WHERE models.algorithm_id = algorithms.id;
                            """))
                        conn.commit()

                res_algo_table = conn.execute(text("SELECT to_regclass('public.algorithms');")).fetchone()
                if res_algo_table and res_algo_table[0]:
                    res_algo_col = conn.execute(text("""
                        SELECT column_name 
                        FROM information_schema.columns 
                        WHERE table_name='algorithms' AND column_name='factory_id';
                    """)).fetchone()
                    
                    if res_algo_col:
                        constraints = conn.execute(text("""
                            SELECT constraint_name 
                            FROM information_schema.table_constraints 
                            WHERE table_name='algorithms' AND constraint_type='FOREIGN KEY';
                        """)).fetchall()
                        for c in constraints:
                            try:
                                conn.execute(text(f"ALTER TABLE algorithms DROP CONSTRAINT {c[0]};"))
                            except:
                                pass
                        conn.execute(text("ALTER TABLE algorithms DROP COLUMN factory_id;"))
                        conn.commit()
            else:
                try:
                    conn.execute(text("ALTER TABLE models ADD COLUMN factory_id INTEGER REFERENCES factories(id) ON DELETE CASCADE;"))
                    conn.execute(text("UPDATE models SET factory_id = (SELECT factory_id FROM algorithms WHERE algorithms.id = models.algorithm_id);"))
                    conn.commit()
                except:
                    pass
                
                try:
                    conn.execute(text("ALTER TABLE algorithms DROP COLUMN factory_id;"))
                    conn.commit()
                except:
                    pass
    except Exception as e:
        print(f"Migration log (normal if DB not initialized yet): {e}")

# Run migrations
run_db_migrations()

# Create tables
Base.metadata.create_all(bind=engine)

# --------------------------------------------------------------------------------
# Patch python-multipart to allow >1000 files (DoS protection default)
# --------------------------------------------------------------------------------
# --------------------------------------------------------------------------------
# Patch Starlette Request.form to allow >1000 files (Starlette 0.40+ default)
# --------------------------------------------------------------------------------
import starlette.requests
starlette.requests.Request.form.__kwdefaults__["max_files"] = 100000
starlette.requests.Request.form.__kwdefaults__["max_fields"] = 100000
# --------------------------------------------------------------------------------
# --------------------------------------------------------------------------------


app = FastAPI(
    title="MLOps Platform Backend",
    description="DVC + MLflow style backend",
    version="1.0.0",
)

# CORS (for React)
app.add_middleware(
    CORSMiddleware,
    # allow_origins=["*"],  # ❌ Cannot use "*" with allow_credentials=True
    allow_origin_regex="https?://.*",  # ✅ Allow any http/https origin via regex
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],  # ✅ Required for fetch() to read filename
)

# Register routers
# app.include_router(auth.router)  # Temporarily commented for testing without auth
app.include_router(factories.router, prefix="/factories", tags=["Factories"])
app.include_router(algorithms.router, prefix="/algorithms", tags=["Algorithms"])
app.include_router(models.router, prefix="/algorithms", tags=["Models"])
app.include_router(versions.router, prefix="/algorithms", tags=["Versions"])
app.include_router(experiments.router, prefix="/algorithms", tags=["Experiments"])
app.include_router(artifacts.router, prefix="/artifacts", tags=["Artifacts"])  
app.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])
app.include_router(chatbot.router)
app.include_router(kb_router)


# --------------------------------------------------------------------------------
# SERVE NETRON (Remote Model Visualization)
# --------------------------------------------------------------------------------
import netron
from fastapi.staticfiles import StaticFiles
import os

netron_path = os.path.dirname(netron.__file__)
# In some versions, it's 'www', in others it's the root. 
# We checked and index.html is in the root.
netron_www = netron_path 

if os.path.exists(os.path.join(netron_www, 'index.html')):
    app.mount("/netron", StaticFiles(directory=netron_www, html=True), name="netron")
else:
    print(f"⚠️ Netron index.html not found at {netron_www}")
def health_check():
    return {"status": "Backend running"}
