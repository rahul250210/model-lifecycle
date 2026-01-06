from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
    UploadFile,
    File,
    Form,
)
from sqlalchemy.orm import Session
from sqlalchemy import func
from pathlib import Path
from fastapi import Query
from app.api.deps import get_db
from app.models.model import Model
from app.models.version import ModelVersion, VersionDelta
from app.models.artifact import Artifact
from app.schemas.version import VersionOut
from app.utils.hashing import sha256_bytes
from fastapi.responses import FileResponse
import zipfile
import tempfile
import os
from app.schemas.artifact import ArtifactOut

router = APIRouter()

STORAGE_ROOT = Path("storage")
CACHE_ROOT = STORAGE_ROOT / "cache"
CACHE_ROOT.mkdir(parents=True, exist_ok=True)

# ======================================================
# CREATE VERSION (TRUE DVC DATASET DELTA)
# ======================================================
@router.post(
    "/{factory_id}/algorithms/{algorithm_id}/models/{model_id}/versions",
    response_model=VersionOut,
    status_code=status.HTTP_201_CREATED,
)
def create_version(
    factory_id: int,
    algorithm_id: int,
    model_id: int,
    dataset_files: list[UploadFile] = File(...),
    label_files: list[UploadFile] = File(...),
    model: UploadFile = File(...),
    code: UploadFile | None = File(None),

    accuracy: float | None = Form(None),
    precision: float | None = Form(None),
    recall: float | None = Form(None),
    f1_score: float | None = Form(None),

    note: str = Form(""),
    db: Session = Depends(get_db),
):
    # -------------------------------
    # Validate model
    # -------------------------------
    model_obj = (
        db.query(Model)
        .filter(Model.id == model_id, Model.algorithm_id == algorithm_id)
        .first()
    )
    if not model_obj:
        raise HTTPException(404, "Model not found")

    # -------------------------------
    # Validate metrics
    # -------------------------------
    for name, value in {
        "accuracy": accuracy,
        "precision": precision,
        "recall": recall,
        "f1_score": f1_score,
    }.items():
        if value is not None and not (0.0 <= value <= 100.0):
            raise HTTPException(400, f"{name} must be between 0 and 100")

    # -------------------------------
    # GLOBAL dataset index (ALL versions)
    # -------------------------------
    global_artifacts = {
        a.checksum: a
        for a in db.query(Artifact)
        .filter(Artifact.type.in_(["dataset", "label"]))
        .distinct(Artifact.checksum)
    }

    # -------------------------------
    # Create new version
    # -------------------------------
    latest = (
        db.query(func.max(ModelVersion.version_number))
        .filter(ModelVersion.model_id == model_id)
        .scalar()
    )
    version_number = (latest or 0) + 1

    db.query(ModelVersion).filter(
        ModelVersion.model_id == model_id,
        ModelVersion.is_active == True,
    ).update({"is_active": False})

    version = ModelVersion(
        model_id=model_id,
        version_number=version_number,
        note=note,
        is_active=True,
        accuracy=accuracy,
        precision=precision,
        recall=recall,
        f1_score=f1_score,
    )
    db.add(version)
    db.commit()
    db.refresh(version)

    # -------------------------------
    # Previous version snapshot
    # -------------------------------
    prev_version = (
        db.query(ModelVersion)
        .filter(
            ModelVersion.model_id == model_id,
            ModelVersion.version_number == version_number - 1,
        )
        .first()
    )

    prev_dataset_checksums = {
        a.checksum
        for a in prev_version.artifacts
        if a.type == "dataset"
    } if prev_version else set()

    prev_label_checksums = {
        a.checksum
        for a in prev_version.artifacts
        if a.type == "label"
    } if prev_version else set()


    # -------------------------------
    # Build snapshot + delta
    # -------------------------------
    new_count = reused_count = unchanged_count = 0
    current_checksums = set()
    dataset_checksums: set[str] = set()
    label_checksums: set[str] = set()

    dataset_new = dataset_reused = 0
    label_new = label_reused = 0
    # --------------------------------------------------
    # Shared processor (DVC-style)
    # --------------------------------------------------
    def process_files(files, artifact_type, checksum_set, prev_set):
        nonlocal dataset_new, dataset_reused, label_new, label_reused

        for file in files:
            data = file.file.read()
            file.file.seek(0)
            checksum = sha256_bytes(data)
            
            checksum_set.add(checksum)

            # Reuse globally
            if checksum in global_artifacts:
                old = global_artifacts[checksum]
                db.add(
                    Artifact(
                        version_id=version.id,
                        name=old.name,
                        type=artifact_type,
                        path=old.path,
                        size=old.size,
                        checksum=old.checksum,
                    )
                )
                if artifact_type == "dataset":
                    dataset_reused += 1
                else:
                    label_reused += 1
                continue

            # New file → cache
            cache_dir = CACHE_ROOT / checksum[:2] / checksum[2:4]
            cache_dir.mkdir(parents=True, exist_ok=True)
            cache_path = cache_dir / checksum

            if not cache_path.exists():
                with open(cache_path, "wb") as f:
                    f.write(data)

            db.add(
                Artifact(
                    version_id=version.id,
                    name=file.filename,
                    type=artifact_type,
                    path=str(cache_path),
                    size=len(data),
                    checksum=checksum,
                )
            )
            if artifact_type == "dataset":
                dataset_new += 1
            else:
                label_new += 1

    # --------------------------------------------------
    # Process DATASET IMAGES + LABELS
    # --------------------------------------------------
    process_files(dataset_files, "dataset", dataset_checksums, prev_dataset_checksums)
    process_files(label_files, "label", label_checksums, prev_label_checksums)

    dataset_removed = len(prev_dataset_checksums - dataset_checksums)
    label_removed = len(prev_label_checksums - label_checksums)

    unchanged_count = (
        len(dataset_checksums & prev_dataset_checksums)
        + len(label_checksums & prev_label_checksums)
    )


    # -------------------------------
    # Save model / code
    # -------------------------------
    def save_single(file: UploadFile, artifact_type: str):
        data = file.file.read()
        file.file.seek(0)
        checksum = sha256_bytes(data)

        cache_dir = CACHE_ROOT / checksum[:2] / checksum[2:4]
        cache_dir.mkdir(parents=True, exist_ok=True)
        cache_path = cache_dir / checksum

        if not cache_path.exists():
            with open(cache_path, "wb") as f:
                f.write(data)

        db.add(
            Artifact(
                version_id=version.id,
                name=file.filename,
                type=artifact_type,
                path=str(cache_path),
                size=len(data),
                checksum=checksum,
            )
        )

    save_single(model, "model")
    if code:
        save_single(code, "code")

    # -------------------------------
    # Save delta
    # -------------------------------
    db.add(
        VersionDelta(
            version_id=version.id,
            dataset_count=len(dataset_checksums),
            label_count=len(label_checksums),
            dataset_new=dataset_new,
            dataset_reused=dataset_reused,
            dataset_removed=dataset_removed,

            label_new=label_new,
            label_reused=label_reused,
            label_removed=label_removed,

            new_count=dataset_new + label_new,
            reused_count=dataset_reused + label_reused,
            removed_count=dataset_removed + label_removed,
        )
    )
    print("Images:", len(dataset_files))
    print("Labels:", len(label_files))

    db.commit()
    return version

# ======================================================
# LIST ALL VERSIONS (TIMELINE)
# ======================================================
@router.get(
    "/{factory_id}/algorithms/{algorithm_id}/models/{model_id}/versions",
    response_model=list[VersionOut],
)
def list_versions(
    model_id: int,
    db: Session = Depends(get_db),
):
    return (
        db.query(ModelVersion)
        .filter(ModelVersion.model_id == model_id)
        .order_by(ModelVersion.version_number.desc())
        .all()
    )


# ======================================================
# GET VERSION DETAILS
# ======================================================
@router.get(
    "/{factory_id}/algorithms/{algorithm_id}/models/{model_id}/versions/{version_id}",
    response_model=VersionOut,
)
def get_version(
    algorithm_id: int,
    model_id: int,
    version_id: int,
    db: Session = Depends(get_db),
):
    version = (
        db.query(ModelVersion)
        .filter(
            ModelVersion.id == version_id,
            ModelVersion.model_id == model_id,
        )
        .first()
    )
    
    if not version:
        raise HTTPException(404, "Version not found")
    return version


# ======================================================
# CHECKOUT / ROLLBACK VERSION (DVC CORE)
# ======================================================
@router.post(
    "/{factory_id}/algorithms/{algorithm_id}/models/{model_id}/versions/{version_id}/checkout",
    status_code=status.HTTP_200_OK,
)
def checkout_version(
    model_id: int,
    version_id: int,
    db: Session = Depends(get_db),
):
    version = (
        db.query(ModelVersion)
        .filter(
            ModelVersion.id == version_id,
            ModelVersion.model_id == model_id,
        )
        .first()
    )
    if not version:
        raise HTTPException(404, "Version not found")

    # Deactivate all
    db.query(ModelVersion).filter(
        ModelVersion.model_id == model_id
    ).update({"is_active": False})

    # Activate selected
    version.is_active = True
    db.commit()

    return {"message": f"Checked out version v{version.version_number}"}



@router.get(
    "/{factory_id}/algorithms/{algorithm_id}/models/{model_id}/versions/{version_id}/delta"
)
def get_version_delta(
    version_id: int,
    db: Session = Depends(get_db),
):
    delta = (
        db.query(VersionDelta)
        .filter(VersionDelta.version_id == version_id)
        .first()
    )

    if not delta:
        raise HTTPException(404, "Delta not found")

    return {
        "dataset": {
            "count": delta.dataset_count or 0,
            "new": delta.dataset_new,
            "reused": delta.dataset_reused,
            "removed": delta.dataset_removed,
        },
        "label": {
            "count": delta.label_count or 0,
            "new": delta.label_new,
            "reused": delta.label_reused,
            "removed": delta.label_removed,
        },
        "unchanged": delta.unchanged_count,
}


@router.get(
    "/{factory_id}/algorithms/{algorithm_id}/models/{model_id}/versions/{version_id}/download"
)
def download_version(
    model_id: int,
    version_id: int,
    dataset: bool = Query(False),
    model: bool = Query(False),
    code: bool = Query(False),
    db: Session = Depends(get_db),
):
    version = (
        db.query(ModelVersion)
        .filter(
            ModelVersion.id == version_id,
            ModelVersion.model_id == model_id,
        )
        .first()
    )

    if not version:
        raise HTTPException(404, "Version not found")

    # Map selection → artifact types
    selected_types = []
    if dataset:
         selected_types.extend(["dataset", "label"])
    if model:
        selected_types.append("model")
   
    if code:
        selected_types.append("code")

    if not selected_types:
        raise HTTPException(400, "No artifacts selected for download")

    artifacts = (
        db.query(Artifact)
        .filter(
            Artifact.version_id == version_id,
            Artifact.type.in_(selected_types),
        )
        .all()
    )

    if not artifacts:
        raise HTTPException(404, "No artifacts found for selected types")

    # Create temp ZIP
    tmp_dir = tempfile.mkdtemp()
    zip_path = os.path.join(
        tmp_dir, f"version_v{version.version_number}.zip"
    )

    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
        for artifact in artifacts:
            file_path = Path(artifact.path)
            if not file_path.exists():
                continue

           # Dataset images
            if artifact.type == "dataset":
                arcname = f"dataset/images/{artifact.name}"

            # Dataset labels
            elif artifact.type == "label":
                arcname = f"dataset/labels/{artifact.name}"

            else:
                arcname = f"{artifact.type}/{artifact.name}"

            zipf.write(file_path, arcname=arcname)

    return FileResponse(
        zip_path,
        filename=f"version_v{version.version_number}.zip",
        media_type="application/zip",
    )

@router.delete(
    "/{factory_id}/algorithms/{algorithm_id}/models/{model_id}/versions/{version_id}",
    status_code=204,
)
def delete_version(
    model_id: int,
    version_id: int,
    db: Session = Depends(get_db),
):
    version = (
        db.query(ModelVersion)
        .filter(
            ModelVersion.id == version_id,
            ModelVersion.model_id == model_id,
        )
        .first()
    )

    if not version:
        raise HTTPException(404, "Version not found")

    db.delete(version)
    db.commit()



@router.post(
    "/{factory_id}/algorithms/{algorithm_id}/models/{model_id}/versions/{version_id}/edit",
    status_code=200,
)
def edit_version(
    version_id: int,
    dataset_files: list[UploadFile] | None = File(None),
    label_files: list[UploadFile] | None = File(None),
    model: UploadFile | None = File(None),
    code: UploadFile | None = File(None),

    accuracy: float | None = Form(None),
    precision: float | None = Form(None),
    recall: float | None = Form(None),
    f1_score: float | None = Form(None),

    note: str = Form(""),
    db: Session = Depends(get_db),
):
    version = db.query(ModelVersion).filter(ModelVersion.id == version_id).first()
    if not version:
        raise HTTPException(404, "Version not found")

    # -------------------------------
    # Update metrics
    # -------------------------------
    for k, v in {
        "accuracy": accuracy,
        "precision": precision,
        "recall": recall,
        "f1_score": f1_score,
    }.items():
        if v is not None:
            setattr(version, k, v)

    if note:
        version.note = note

    # -------------------------------
    # GLOBAL artifact index
    # -------------------------------
    global_artifacts = {
        a.checksum: a
        for a in db.query(Artifact)
        .filter(Artifact.type.in_(["dataset", "label"]))
        .distinct(Artifact.checksum)
    }
   
     # --------------------------------------------------
    # Helper to replace snapshot (DVC-style)
    # --------------------------------------------------
    def replace_files(files: list[UploadFile], artifact_type: str):
        for file in files:
            data = file.file.read()
            file.file.seek(0)
            checksum = sha256_bytes(data)

            # Reuse globally cached file
            if checksum in global_artifacts:
                old = global_artifacts[checksum]
                db.add(
                    Artifact(
                        version_id=version.id,
                        name=old.name,
                        type=artifact_type,
                        path=old.path,
                        size=old.size,
                        checksum=old.checksum,
                    )
                )
                continue

            # New file
            cache_dir = CACHE_ROOT / checksum[:2] / checksum[2:4]
            cache_dir.mkdir(parents=True, exist_ok=True)
            cache_path = cache_dir / checksum

            if not cache_path.exists():
                with open(cache_path, "wb") as f:
                    f.write(data)

            db.add(
                Artifact(
                    version_id=version.id,
                    name=file.filename,
                    type=artifact_type,
                    path=str(cache_path),
                    size=len(data),
                    checksum=checksum,
                )
            )
    if dataset_files is not None  or label_files is not None:

        # Remove existing snapshot
        db.query(Artifact).filter(
            Artifact.version_id == version.id,
            Artifact.type.in_(["dataset", "label"]),
        ).delete(synchronize_session=False)

        if dataset_files:
            replace_files(dataset_files, "dataset")

        if label_files:
            replace_files(label_files, "label")

    # -------------------------------
    # Replace model / code
    # -------------------------------
    def save_single(file, t):
        data = file.file.read()
        file.file.seek(0)
        checksum = sha256_bytes(data)

        cache_dir = CACHE_ROOT / checksum[:2] / checksum[2:4]
        cache_dir.mkdir(parents=True, exist_ok=True)
        cache_path = cache_dir / checksum

        if not cache_path.exists():
            with open(cache_path, "wb") as f:
                f.write(data)

        db.add(
            Artifact(
                version_id=version.id,
                name=file.filename,
                type=t,
                path=str(cache_path),
                size=len(data),
                checksum=checksum,
            )
        )

    if model:
        save_single(model, "model")
    if code:
        save_single(code, "code")

    db.commit()

    return {"message": "Version updated successfully"}

# ======================================================
# LIST ARTIFACTS OF A VERSION
# ======================================================
@router.get(
    "/{factory_id}/algorithms/{algorithm_id}/models/{model_id}/versions/{version_id}/artifacts",
    response_model=list[ArtifactOut],
)
def list_artifacts(
    version_id: int,
    db: Session = Depends(get_db),
):
    return (
        db.query(Artifact)
        .filter(Artifact.version_id == version_id)
        .order_by(Artifact.id.desc())
        .all()
    )

