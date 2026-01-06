from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pathlib import Path
import json
import csv
from mimetypes import guess_type
from app.api.deps import get_db
from app.models.artifact import Artifact
from app.schemas.artifact import ArtifactOut

router = APIRouter()
MAX_PREVIEW_BYTES = 10_000 

# ======================================================
# GET ARTIFACT METADATA
# ======================================================
@router.get(
    "/{artifact_id}",
    response_model=ArtifactOut,
)
def get_artifact(
    artifact_id: int,
    db: Session = Depends(get_db),
):
    artifact = db.query(Artifact).filter(Artifact.id == artifact_id).first()
    if not artifact:
        raise HTTPException(404, "Artifact not found")
    return artifact


# ======================================================
# DOWNLOAD ARTIFACT
# ======================================================
@router.get("/{artifact_id}/download")
def download_artifact(
    artifact_id: int,
    db: Session = Depends(get_db),
):
    artifact = db.query(Artifact).filter(Artifact.id == artifact_id).first()
    if not artifact:
        raise HTTPException(404, "Artifact not found")

    file_path = Path(artifact.path)
    if not file_path.exists():
        raise HTTPException(404, "File missing on server")

    return FileResponse(
        path=file_path,
        filename=artifact.name,
        media_type="application/octet-stream",
    )


# ======================================================
# PREVIEW ARTIFACT (CSV / JSON / TEXT)
# ======================================================
@router.get("/{artifact_id}/preview")
def preview_artifact(
    artifact_id: int,
    db: Session = Depends(get_db),
):
    artifact = db.query(Artifact).filter(Artifact.id == artifact_id).first()
    if not artifact:
        raise HTTPException(404, "Artifact not found")

    file_path = Path(artifact.path)
    if not file_path.exists():
        raise HTTPException(404, "File missing on server")

    # 🔥 USE ORIGINAL FILENAME (NOT CACHE NAME)
    suffix = Path(artifact.name).suffix.lower()

    # ---------- JSON ----------
    if suffix == ".json":
        with open(file_path, "r", errors="ignore") as f:
            return json.load(f)

    # ---------- CSV ----------
    if suffix == ".csv":
        with open(file_path, newline="", errors="ignore") as csvfile:
            reader = csv.DictReader(csvfile)
            rows = []
            for i, row in enumerate(reader):
                rows.append(row)
                if i >= 20:
                    break
            return rows

    # ---------- CODE / TEXT ----------
    if suffix in [".txt", ".log", ".md", ".py", ".js", ".ts", ".cpp", ".c", ".h", ".hpp", ".java"]:
        with open(file_path, "r", errors="ignore") as f:
            return f.read(50_000)  # 50 KB preview

    # ---------- UNSUPPORTED ----------
    return {"message": "Preview not supported for this file type"}

@router.delete("/{artifact_id}", status_code=204)
def delete_artifact(
    artifact_id: int,
    db: Session = Depends(get_db),
):
    artifact = db.query(Artifact).filter(Artifact.id == artifact_id).first()
    if not artifact:
        raise HTTPException(404, "Artifact not found")

    db.delete(artifact)
    db.commit()



@router.get("/{artifact_id}/image")
def get_image(
    artifact_id: int,
    db: Session = Depends(get_db),
):
    artifact = db.query(Artifact).filter(Artifact.id == artifact_id).first()
    if not artifact:
        raise HTTPException(404, "Artifact not found")

    # ✅ Trust dataset artifacts as images
    if artifact.type != "dataset":
        raise HTTPException(400, "Artifact is not an image")

    file_path = Path(artifact.path)
    if not file_path.exists():
        raise HTTPException(404, "Image file missing")

    return FileResponse(
        path=file_path,
        media_type="image/jpeg",  # ✅ force image rendering
        headers={"Cache-Control": "public, max-age=3600"},
    )
