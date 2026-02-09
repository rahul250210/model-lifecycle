from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import factories, algorithms, models, versions, experiments, artifacts, auth
from app.api.knowledge_base import router as kb_router
from app.database import Base, engine

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
)

# Register routers
# app.include_router(auth.router)  # Temporarily commented for testing without auth
app.include_router(factories.router, prefix="/factories", tags=["Factories"])
app.include_router(algorithms.router, prefix="/factories", tags=["Algorithms"])
app.include_router(models.router, prefix="/factories", tags=["Models"])
app.include_router(versions.router, prefix="/factories", tags=["Versions"])
app.include_router(experiments.router, prefix="/factories", tags=["Experiments"])
app.include_router(artifacts.router, prefix="/artifacts", tags=["Artifacts"])  
app.include_router(kb_router)


@app.get("/")
def health_check():
    return {"status": "Backend running"}
