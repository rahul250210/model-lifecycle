
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    UploadFile,
    File,
    status,
    Query,
)
from sqlalchemy.orm import Session
from sqlalchemy import func
from pathlib import Path
import os
import shutil
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
def upload_algorithm_files(
    algorithm_id: int,
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
):
    algo = db.query(AlgorithmKnowledge).get(algorithm_id)
    if not algo:
        raise HTTPException(404, "Algorithm not found")

    storage_dir = STORAGE_ROOT / algo.slug
    storage_dir.mkdir(parents=True, exist_ok=True)

    saved_paths = []
    try:
        for file in files:
            ext = file.filename.split(".")[-1].lower()
            file_path = storage_dir / file.filename
            
            # Create subdirectories if the filename contains paths (folder uploads)
            file_path.parent.mkdir(parents=True, exist_ok=True)
            
            with open(file_path, "wb") as f:
                f.write(file.file.read())
            
            saved_paths.append(file_path)

            record = AlgorithmKnowledgeFile(
                algorithm_id=algorithm_id,
                name=file.filename,
                type=ext,
                path=str(file_path),
                size=file_path.stat().st_size,
            )
            db.add(record)
        
        db.commit()
    except Exception as e:
        db.rollback()
        # Clean up files from disk if anything failed
        for p in saved_paths:
            if p.exists():
                try: p.unlink()
                except: pass
        raise HTTPException(500, detail=f"Upload failed: {str(e)}")

    return {"status": "success", "count": len(files)}


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
        try:
            shutil.rmtree(storage_dir)
        except Exception as e:
            print(f"Error deleting directory {storage_dir}: {e}")
            # we continue even if file deletion fails, to remove the DB record

    db.delete(algo)
    db.commit()


@router.get("/algorithms/{algorithm_id}/download_bundle")
def download_algorithm_bundle(
    algorithm_id: int,
    categories: list[str] = Query(default=[]),
    db: Session = Depends(get_db),
):
    from fastapi.responses import StreamingResponse
    import zipstream

    algo = db.query(AlgorithmKnowledge).get(algorithm_id)
    if not algo:
        raise HTTPException(404, "Algorithm not found")

    files = (
        db.query(AlgorithmKnowledgeFile)
        .filter(AlgorithmKnowledgeFile.algorithm_id == algorithm_id)
        .all()
    )

    if not files:
        raise HTTPException(404, "No artifacts found to export")

    # Helper to categorize
    def get_category_key(filename):
        ext = filename.split('.')[-1].lower() if '.' in filename else ''
        if ext in ['jpg', 'jpeg', 'png', 'webp', 'gif']: return "images"
        if ext in ['ppt', 'pptx']: return "presentations"
        if ext in ['pdf']: return "documents"
        if ext in ['py', 'js', 'ts', 'tsx', 'jsx', 'java', 'cpp', 'c', 'h', 'cs', 'go', 'rb', 'php', 'sh', 'bat', 'ps1', 'json', 'xml', 'yaml', 'yml', 'md', 'sql']: return "code"
        return "other"

    # Filter files
    selected_files = []
    # If no categories specified, default to all? Or none? 
    # Usually "export bundle" implies user selected specific ones. 
    # If list is empty (e.g. ?categories=), we might return empty.
    # But usually API behavior: if param missing, maybe all? 
    # Let's assume frontend ALWAYS sends categories.
    
    for f in files:
        cat = get_category_key(f.name)
        if cat in categories:
            selected_files.append((f, cat))

    if not selected_files:
         raise HTTPException(400, "No files match the selected categories")

    def stream_generator():
        zs = zipstream.ZipStream(compress_type=zipstream.ZIP_DEFLATED)
        
        for f, cat in selected_files:
            file_path = Path(f.path)
            if not file_path.exists():
                continue
            
            # Structure: category/filename
            # We map "images" -> "Photos & Images" folder? Or just simple "images"?
            # Simple "images" is better for file systems.
            arcname = f"{cat}/{f.name}"
            
            zs.add_path(str(file_path), arcname=arcname)

        for chunk in zs:
            yield chunk

    response = StreamingResponse(
        stream_generator(),
        media_type="application/zip",
    )
    response.headers["Content-Disposition"] = f'attachment; filename="{algo.slug}_bundle.zip"'
    return response
