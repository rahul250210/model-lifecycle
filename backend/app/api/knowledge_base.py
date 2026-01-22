
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    UploadFile,
    File,
    status,
)
from sqlalchemy.orm import Session
from sqlalchemy import func
from pathlib import Path
import os
from pydantic import BaseModel
from app.api.deps import get_db
from app.models.algorithm_knowledge import AlgorithmKnowledge
from app.models.algorithm_knowledge_file import AlgorithmKnowledgeFile
from fastapi.responses import FileResponse
from app.schemas.kb import AlgorithmCreate

router = APIRouter(prefix="/kb", tags=["Knowledge Base"])

STORAGE_ROOT = Path("storage/knowledge")
STORAGE_ROOT.mkdir(parents=True, exist_ok=True)

class AlgorithmUpdate(BaseModel):
    name: str


@router.post("/algorithms", status_code=status.HTTP_201_CREATED)
def create_algorithm_repo(
    payload: AlgorithmCreate,
    db: Session = Depends(get_db),
):
    name = payload.name

    slug = name.lower().strip().replace(" ", "-")

    existing = (
        db.query(AlgorithmKnowledge)
        .filter(AlgorithmKnowledge.slug == slug)
        .first()
    )
    if existing:
        return existing

    algo = AlgorithmKnowledge(
        name=name,
        description=payload.description,
        slug=slug,
    )
    db.add(algo)
    db.commit()
    db.refresh(algo)

    (STORAGE_ROOT / slug).mkdir(parents=True, exist_ok=True)

    return {
        "id": algo.id,
        "name": algo.name,
        "file_count": 0,
    }


@router.get("/algorithms")
def list_algorithms(db: Session = Depends(get_db)):
    results = (
        db.query(
            AlgorithmKnowledge.id,
            AlgorithmKnowledge.name,
            AlgorithmKnowledge.description, 
            func.count(AlgorithmKnowledgeFile.id).label("file_count"),
        )
        .outerjoin(AlgorithmKnowledgeFile)
        .group_by(
            AlgorithmKnowledge.id,
            AlgorithmKnowledge.name,
            AlgorithmKnowledge.description,  
        )
        .order_by(AlgorithmKnowledge.name.asc())
        .all()
    )

    return [
        {
            "id": r.id,
            "name": r.name,
            "description": r.description,  
            "file_count": r.file_count,
        }
        for r in results
    ]

@router.post("/algorithms/{algorithm_id}/files", status_code=201)
def upload_algorithm_file(
    algorithm_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    algo = db.query(AlgorithmKnowledge).get(algorithm_id)
    if not algo:
        raise HTTPException(404, "Algorithm not found")

    ext = file.filename.split(".")[-1].lower()
    storage_dir = STORAGE_ROOT / algo.slug
    storage_dir.mkdir(parents=True, exist_ok=True)

    file_path = storage_dir / file.filename

    with open(file_path, "wb") as f:
        f.write(file.file.read())

    record = AlgorithmKnowledgeFile(
        algorithm_id=algorithm_id,
        name=file.filename,
        type=ext,
        path=str(file_path),
        size=file_path.stat().st_size,
    )

    db.add(record)
    db.commit()
    db.refresh(record)

    return {
        "id": record.id,
        "name": record.name,
        "size": record.size,
        "type": record.type,
        "url": f"/kb/files/{record.id}/download",
    }


@router.get("/algorithms/{algorithm_id}/files")
def list_algorithm_files(
    algorithm_id: int,
    db: Session = Depends(get_db),
):
    algo = db.query(AlgorithmKnowledge).get(algorithm_id)
    if not algo:
        raise HTTPException(404, "Algorithm not found")

    files = (
        db.query(AlgorithmKnowledgeFile)
        .filter(AlgorithmKnowledgeFile.algorithm_id == algorithm_id)
        .order_by(AlgorithmKnowledgeFile.created_at.desc())
        .all()
    )

    return [
        {
            "id": f.id,
            "name": f.name,
            "size": f.size,
            "type": f.type,
            "url": f"/kb/files/{f.id}/download",
            "created_at": f.created_at,
        }
        for f in files
    ]


@router.get("/files/{file_id}/download")
def download_algorithm_file(
    file_id: int,
    db: Session = Depends(get_db),
):
    file = db.query(AlgorithmKnowledgeFile).get(file_id)
    if not file:
        raise HTTPException(404, "File not found")

    if not os.path.exists(file.path):
        raise HTTPException(404, "File missing from storage")

    return FileResponse(
        path=file.path,
        filename=file.name,
        media_type="application/octet-stream",
    )


@router.delete("/files/{file_id}", status_code=204)
def delete_algorithm_file(
    file_id: int,
    db: Session = Depends(get_db),
):
    file = db.query(AlgorithmKnowledgeFile).get(file_id)
    if not file:
        raise HTTPException(404, "File not found")

    try:
        if os.path.exists(file.path):
            os.remove(file.path)
    except Exception:
        pass

    db.delete(file)
    db.commit()



@router.put("/algorithms/{algorithm_id}")
def update_algorithm(
    algorithm_id: int,
    payload: AlgorithmCreate,
    db: Session = Depends(get_db),
):
    algo = db.query(AlgorithmKnowledge).get(algorithm_id)

    if not algo:
        raise HTTPException(status_code=404, detail="Algorithm not found")

    algo.name = payload.name
    algo.description = payload.description

    db.commit()
    db.refresh(algo)

    return algo


@router.delete("/algorithms/{algorithm_id}", status_code=204)
def delete_algorithm(
    algorithm_id: int,
    db: Session = Depends(get_db),
):
    algo = db.query(AlgorithmKnowledge).get(algorithm_id)

    if not algo:
        raise HTTPException(status_code=404, detail="Algorithm not found")

    # delete files on disk
    storage_dir = STORAGE_ROOT / algo.slug
    if storage_dir.exists():
        for f in storage_dir.iterdir():
            f.unlink()
        storage_dir.rmdir()

    db.delete(algo)
    db.commit()
