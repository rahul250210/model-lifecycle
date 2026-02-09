from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
    UploadFile,
    File,
    Form,
    BackgroundTasks,
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
import hashlib
import shutil
import json
from concurrent.futures import ThreadPoolExecutor
from app.schemas.artifact import ArtifactOut

router = APIRouter()

STORAGE_ROOT = Path("storage")
CACHE_ROOT = STORAGE_ROOT / "cache"
TEMP_ROOT = STORAGE_ROOT / "temp"
CACHE_ROOT.mkdir(parents=True, exist_ok=True)
TEMP_ROOT.mkdir(parents=True, exist_ok=True)

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
    dataset_files: list[UploadFile] = File([]),
    label_files: list[UploadFile] = File([]),
    model_files: list[UploadFile] = File([]),
    code_files: list[UploadFile] = File([]),

    accuracy: float | None = Form(None),
    precision: float | None = Form(None),
    recall: float | None = Form(None),
    f1_score: float | None = Form(None),
    tp: int | None = Form(None),
    tn: int | None = Form(None),
    fp: int | None = Form(None),
    fn: int | None = Form(None),

    # Training parameters
    batch_size: int | None = Form(None),
    epochs: int | None = Form(None),
    learning_rate: float | None = Form(None),
    optimizer: str | None = Form(None),
    image_size: int | None = Form(None),
    custom_params: str | None = Form(None), # JSON string for dynamic key-values

    note: str = Form(""),
    db: Session = Depends(get_db),
):
    print(f"=== CREATE VERSION DEBUG ===")
    print(f"Dataset: {len(dataset_files)}")
    print(f"Labels:  {len(label_files)}")
    print(f"Models:  {len(model_files)}")
    print(f"Code:    {len(code_files)}")
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

    parameters = {}

    if batch_size is not None:
        parameters["batch_size"] = batch_size

    if epochs is not None:
        parameters["epochs"] = epochs

    if learning_rate is not None:
        parameters["learning_rate"] = learning_rate

    if optimizer:
        parameters["optimizer"] = optimizer

    if image_size is not None:
        parameters["image_size"] = image_size

    if custom_params:
        try:
            custom = json.loads(custom_params)
            if isinstance(custom, dict):
                parameters.update(custom)
        except Exception as e:
            print(f"Error parsing custom_params: {e}")

    
    
    
    # -------------------------------
    # Efficient Deduplication Strategy
    # -------------------------------
    # 1. We will NOT load the entire global artifact index.
    # 2. We will compute checksums of incoming files first.
    # 3. Then query DB for existing artifacts matching those checksums.
    # -------------------------------

    
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
        tp=tp,
        tn=tn,
        fp=fp,
        fn=fn,
        parameters=parameters,
    )
    db.add(version)
    db.flush()  # Populate version.id for artifacts
    # Previous version snapshot (for delta calc)
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

    
    dataset_checksums: set[str] = set()
    label_checksums: set[str] = set()

    dataset_new = dataset_reused = 0
    label_new = label_reused = 0

    new_files_on_disk = []

    # --------------------------------------------------
    # Shared processor (DVC-style)
    # --------------------------------------------------
    def process_files(files, artifact_type, checksum_set, prev_set):
        nonlocal dataset_new, dataset_reused, label_new, label_reused

        if not files:
            return

        # 1. Compute checksums & Prepare data
        file_map = {}
        
        def handle_single_file(file: UploadFile):
            hasher = hashlib.sha256()
            spooled_file = file.file
            spooled_file.seek(0)
            
            with tempfile.NamedTemporaryFile(dir=TEMP_ROOT, delete=False) as tmp:
                while chunk := spooled_file.read(1024 * 1024):
                    hasher.update(chunk)
                    tmp.write(chunk)
                tmp_path = tmp.name
                size = tmp.tell()

            checksum_hex = hasher.hexdigest()
            return (checksum_hex, {
                "name": file.filename,
                "tmp_path": tmp_path,
                "size": size
            })

        with ThreadPoolExecutor(max_workers=32) as executor:
            io_results = list(executor.map(handle_single_file, files))

        for checksum_str, info in io_results:
            file_map[checksum_str] = info
            checksum_set.add(checksum_str)

        # 2. Batch Query Existing Artifacts
        existing_artifacts = {}
        unique_checksums = list(file_map.keys())
        
        chunk_size = 500
        for i in range(0, len(unique_checksums), chunk_size):
            batch = unique_checksums[i : i + chunk_size]
            results = (
                db.query(Artifact)
                .filter(Artifact.checksum.in_(batch))
                .filter(Artifact.type == artifact_type) 
                .all()
            )
            for art in results:
                existing_artifacts[art.checksum] = art

        # 3. Process each file
        artifacts_to_insert = []
        for checksum, info in io_results:
            tmp_path = info["tmp_path"]
            
            if checksum in existing_artifacts:
                old = existing_artifacts[checksum]
                artifacts_to_insert.append(
                    Artifact(
                        version_id=version.id,
                        name=info["name"],
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
                try: os.unlink(tmp_path)
                except: pass
            else:
                cache_dir = CACHE_ROOT / checksum[:2] / checksum[2:4]
                cache_dir.mkdir(parents=True, exist_ok=True)
                cache_path = cache_dir / checksum

                if not cache_path.exists():
                    shutil.move(tmp_path, cache_path)
                    new_files_on_disk.append(cache_path)
                else:
                    try: os.unlink(tmp_path)
                    except: pass

                artifacts_to_insert.append(
                    Artifact(
                        version_id=version.id,
                        name=info["name"],
                        type=artifact_type,
                        path=str(cache_path),
                        size=info["size"],
                        checksum=checksum,
                    )
                )
                if artifact_type == "dataset":
                    dataset_new += 1
                else:
                    label_new += 1
                
                # Update existing_artifacts so subsequent duplicates in this batch use the new cache path
                existing_artifacts[checksum] = artifacts_to_insert[-1]

        # High-speed bulk insert
        if artifacts_to_insert:
            db.bulk_save_objects(artifacts_to_insert)

    def save_single(file: UploadFile, artifact_type: str):
        if not file or not file.filename:
            return

        hasher = hashlib.sha256()
        spooled_file = file.file
        spooled_file.seek(0)

        with tempfile.NamedTemporaryFile(dir=TEMP_ROOT, delete=False) as tmp:
            while chunk := spooled_file.read(1024 * 1024):
                hasher.update(chunk)
                tmp.write(chunk)
            tmp_path = tmp.name
            size = tmp.tell()

        checksum = hasher.hexdigest()
        cache_dir = CACHE_ROOT / checksum[:2] / checksum[2:4]
        cache_dir.mkdir(parents=True, exist_ok=True)
        cache_path = cache_dir / checksum

        if not cache_path.exists():
            shutil.move(tmp_path, cache_path)
            new_files_on_disk.append(cache_path)
        else:
            try: os.unlink(tmp_path)
            except: pass

        db.add(
            Artifact(
                version_id=version.id,
                name=file.filename,
                type=artifact_type,
                path=str(cache_path),
                size=size,
                checksum=checksum,
            )
        )

    try:
        # Process DATASET IMAGES + LABELS
        process_files(dataset_files, "dataset", dataset_checksums, prev_dataset_checksums)
        process_files(label_files, "label", label_checksums, prev_label_checksums)

        dataset_removed = len(prev_dataset_checksums - dataset_checksums)
        label_removed = len(prev_label_checksums - label_checksums)

        # Save model / code
        for model_file in model_files:
            save_single(model_file, "model")

        for f in code_files:
            save_single(f, "code")

        # Save delta
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

        db.commit()
        db.refresh(version)
        return version

    except Exception as e:
        db.rollback()
        # Clean up newly written files from disk
        for p in new_files_on_disk:
            if p.exists():
                try: p.unlink()
                except: pass
        print(f"FAILED ATOMIC VERSION CREATE: {e}")
        raise HTTPException(500, detail=str(e))

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
    model_id: int,
    version_id: int,
    db: Session = Depends(get_db),
):
    version = (
        db.query(ModelVersion)
        .filter(ModelVersion.id == version_id, ModelVersion.model_id == model_id)
        .first()
    )
    if not version:
        raise HTTPException(404, "Version not found")

    # 1. Total counts in this version
    artifacts = version.artifacts
    current_dataset = [a for a in artifacts if a.type == "dataset"]
    current_label = [a for a in artifacts if a.type == "label"]

    current_dataset_checksums = {a.checksum for a in current_dataset}
    current_label_checksums = {a.checksum for a in current_label}

    # 2. Identify the first version each checksum appeared in (across all existing versions of this model)
    # Mapping: checksum -> min(version_number)
    lineage = (
        db.query(Artifact.checksum, func.min(ModelVersion.version_number))
        .join(ModelVersion, Artifact.version_id == ModelVersion.id)
        .filter(ModelVersion.model_id == model_id)
        .group_by(Artifact.checksum)
        .all()
    )
    origin_map = {c: v for c, v in lineage}
    
    dataset_new = 0
    dataset_reused = 0
    for a in current_dataset:
        if origin_map.get(a.checksum) == version.version_number:
            dataset_new += 1
        else:
            dataset_reused += 1

    label_new = 0
    label_reused = 0
    for a in current_label:
        if origin_map.get(a.checksum) == version.version_number:
            label_new += 1
        else:
            label_reused += 1

    # 3. Identify Removed (compared to the *immediate* previous existing version)
    prev_version = (
        db.query(ModelVersion)
        .filter(
            ModelVersion.model_id == model_id,
            ModelVersion.version_number < version.version_number
        )
        .order_by(ModelVersion.version_number.desc())
        .first()
    )

    if prev_version:
        prev_dataset_checksums = {a.checksum for a in prev_version.artifacts if a.type == "dataset"}
        prev_label_checksums = {a.checksum for a in prev_version.artifacts if a.type == "label"}
        
        dataset_removed = len(prev_dataset_checksums - current_dataset_checksums)
        label_removed = len(prev_label_checksums - current_label_checksums)
        unchanged = len(current_dataset_checksums & prev_dataset_checksums) + len(current_label_checksums & prev_label_checksums)
    else:
        dataset_removed = 0
        label_removed = 0
        unchanged = 0

    return {
        "dataset": {
            "count": len(current_dataset),
            "new": dataset_new,
            "reused": dataset_reused,
            "removed": dataset_removed,
        },
        "label": {
            "count": len(current_label),
            "new": label_new,
            "reused": label_reused,
            "removed": label_removed,
        },
        "unchanged": unchanged,
    }


@router.get(
    "/{factory_id}/algorithms/{algorithm_id}/models/{model_id}/versions/{version_id}/download"
)
def download_version(
    model_id: int,
    version_id: int,
    dataset: bool = Query(False),
    labels: bool = Query(False),
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
         selected_types.append("dataset")

    if labels:
         selected_types.append("label")

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

    # --------------------------------------------------
    # Query lineage to find origin version for each checksum
    # --------------------------------------------------
    checksums = [a.checksum for a in artifacts]
    origin_map = {}
    
    if checksums:
        # Find min version_number for each checksum for this model
        lin = (
            db.query(Artifact.checksum, func.min(ModelVersion.version_number))
            .join(ModelVersion, Artifact.version_id == ModelVersion.id)
            .filter(
                ModelVersion.model_id == model_id,
                Artifact.checksum.in_(checksums)
            )
            .group_by(Artifact.checksum)
            .all()
        )
        origin_map = {c: v for c, v in lin}

    # --------------------------------------------------
    # Stream ZIP directly to client
    # --------------------------------------------------
    import zipstream
    from fastapi.responses import StreamingResponse

    current_ver_num = version.version_number
    
    
    def stream_generator():
        zs = zipstream.ZipStream(compress_type=zipstream.ZIP_DEFLATED)

        for artifact in artifacts:
            file_path = Path(artifact.path)
            if not file_path.exists():
                continue

            origin_ver = origin_map.get(artifact.checksum, current_ver_num)

            # Define archive path
            if artifact.type == "dataset":
                if origin_ver < current_ver_num:
                    arcname = f"version_{origin_ver}_images/{artifact.name}"
                else:
                    arcname = f"dataset/{artifact.name}"
            
            elif artifact.type == "label":
                 if origin_ver < current_ver_num:
                    arcname = f"version_{origin_ver}_labels/{artifact.name}"
                 else:
                    arcname = f"labels/{artifact.name}"
            
            else:
                 arcname = f"{artifact.type}/{artifact.name}"

            zs.add_path(str(file_path), arcname=arcname)

        try:
            yield from zs
        except Exception as e:
            print(f"STREAMING ERROR: {e}")
            import traceback
            traceback.print_exc()
            raise e

    return StreamingResponse(
        stream_generator(),
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename=version_v{version.version_number}.zip"}
    )

@router.delete(
    "/{factory_id}/algorithms/{algorithm_id}/models/{model_id}/versions/{version_id}",
    status_code=204,
)
def delete_version(
    model_id: int,
    version_id: int,
    background_tasks: BackgroundTasks,
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

    was_active = version.is_active

    # Get artifact info for garbage collection
    artifacts_to_check = []
    for a in version.artifacts:
        if a.checksum and a.path:
            artifacts_to_check.append((a.checksum, a.path))

    db.delete(version)
    db.flush()  # Ensure deletion is reflected in session for subsequent query
    
    if was_active:
        # Find the next best version to activate (highest remaining version_number)
        next_best = (
            db.query(ModelVersion)
            .filter(
                ModelVersion.model_id == model_id,
                ModelVersion.id != version_id  # Explicitly exclude the one we're deleting
            )
            .order_by(ModelVersion.version_number.desc())
            .first()
        )
        if next_best:
            next_best.is_active = True

    db.commit()

    # Post-commit: Schedule heavy GC in background
    background_tasks.add_task(background_garbage_collection, artifacts_to_check)
    return

def background_garbage_collection(artifacts_to_check: list[tuple[str, str]]):
    """
    Runs in background to delete physical files that are no longer referenced.
    Re-creates a fresh DB session because the original one is closed.
    """
    from app.database import SessionLocal
    db = SessionLocal()
    try:
        for checksum, path in artifacts_to_check:
            # Check if any other version (of any model) is using this exact physical file
            is_still_referenced = db.query(Artifact).filter(Artifact.checksum == checksum).first()
            
            if not is_still_referenced:
                # The file is orphaned - delete from host PC
                p = Path(path)
                if p.exists():
                    try:
                        p.unlink()
                        print(f"Garbage Collection: Deleted orphaned artifact {checksum[:8]} at {path}")
                    except Exception as e:
                        print(f"Error deleting file {path}: {e}")
    finally:
        db.close()



@router.post(
    "/{factory_id}/algorithms/{algorithm_id}/models/{model_id}/versions/{version_id}/edit",
    status_code=200,
)
def edit_version(
    version_id: int,
    dataset_files: list[UploadFile] | None = File(None),
    label_files: list[UploadFile] | None = File(None),
    model_files: list[UploadFile] | None = File(None),
    code_files: list[UploadFile] | None = File(None),

    accuracy: float | None = Form(None),
    precision: float | None = Form(None),
    recall: float | None = Form(None),
    f1_score: float | None = Form(None),
    tp: int | None = Form(None),
    tn: int | None = Form(None),
    fp: int | None = Form(None),
    fn: int | None = Form(None),

    batch_size: int | None = Form(None),
    epochs: int | None = Form(None),
    learning_rate: float | None = Form(None),
    optimizer: str | None = Form(None),
    image_size: int | None = Form(None),
    custom_params: str | None = Form(None), # JSON string

    note: str = Form(""),
    dataset_mode: str = Form("replace"),  # "replace" or "append"
    label_mode: str = Form("replace"),    # "replace" or "append"
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
        "tp": tp,
        "tn": tn,
        "fp": fp,
        "fn": fn,
    }.items():
        if v is not None:
            setattr(version, k, v)

    if note:
        version.note = note

    if version.parameters is None:
        version.parameters = {}


    params = dict(version.parameters or {})

    # First, separate standard parameters from existing custom ones
    standard_keys = {"batch_size", "epochs", "learning_rate", "optimizer", "image_size"}
    new_params = {k: v for k, v in params.items() if k in standard_keys}

    # Update standard ones from explicit form fields
    if batch_size is not None: new_params["batch_size"] = batch_size
    if epochs is not None: new_params["epochs"] = epochs
    if learning_rate is not None: new_params["learning_rate"] = learning_rate
    if optimizer: new_params["optimizer"] = optimizer
    if image_size is not None: new_params["image_size"] = image_size

    # Update with new custom parameters (this effectively replaces old custom ones)
    if custom_params:
        try:
            custom = json.loads(custom_params)
            if isinstance(custom, dict):
                new_params.update(custom)
        except Exception as e:
            print(f"Error parsing custom_params: {e}")

    version.parameters = new_params  # 🔥 THIS LINE IS REQUIRED


    # -------------------------------
    # GLOBAL artifact index
    # -------------------------------
    global_artifacts = {
        a.checksum: a
        for a in db.query(Artifact)
        .filter(Artifact.type.in_(["dataset", "label"]))
        .distinct(Artifact.checksum)
    }
   
    new_files_on_disk = []

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
                new_files_on_disk.append(cache_path)

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
            new_files_on_disk.append(cache_path)

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

    try:
        if dataset_files is not None:
            if dataset_mode == "replace":
                db.query(Artifact).filter(
                    Artifact.version_id == version.id,
                    Artifact.type == "dataset",
                ).delete(synchronize_session=False)
            replace_files(dataset_files, "dataset")

        if label_files is not None:
            if label_mode == "replace":
                db.query(Artifact).filter(
                    Artifact.version_id == version.id,
                    Artifact.type == "label",
                ).delete(synchronize_session=False)
            replace_files(label_files, "label")

        if model_files:
            for f in model_files:
                save_single(f, "model")

        if code_files:
            db.query(Artifact).filter(
                Artifact.version_id == version.id,
                Artifact.type == "code"
            ).delete()
            for f in code_files:
                save_single(f, "code")

        db.commit()
    except Exception as e:
        db.rollback()
        # Clean up newly written files from disk
        for p in new_files_on_disk:
            if p.exists():
                try: p.unlink()
                except: pass
        print(f"FAILED ATOMIC VERSION EDIT: {e}")
        raise HTTPException(500, detail=str(e))

    return {"status": "ok"}

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


# ======================================================
# CHUNK UPLOAD (BACKGROUND STREAMING)
# ======================================================
@router.post(
    "/{factory_id}/algorithms/{algorithm_id}/models/{model_id}/versions/{version_id}/upload_chunk",
    status_code=status.HTTP_200_OK,
)
def upload_chunk(
    version_id: int,
    files: list[UploadFile] = File(...),
    artifact_type: str = Form(...), # "dataset" or "label"
    db: Session = Depends(get_db),
):
    version = db.query(ModelVersion).filter(ModelVersion.id == version_id).first()
    if not version:
        raise HTTPException(404, "Version not found")

    # Reuse the bulk logic (simplified inline version for chunks)
    # 1. Checksums
    file_map = {}
    
    def handle_single_file(file: UploadFile):
        hasher = hashlib.sha256()
        spooled_file = file.file
        spooled_file.seek(0)
        
        with tempfile.NamedTemporaryFile(dir=TEMP_ROOT, delete=False) as tmp:
            while chunk := spooled_file.read(1024 * 1024):
                hasher.update(chunk)
                tmp.write(chunk)
            tmp_path = tmp.name
            size = tmp.tell()

        checksum_hex = hasher.hexdigest()
        return (checksum_hex, {
            "name": file.filename,
            "tmp_path": tmp_path,
            "size": size
        })

    with ThreadPoolExecutor(max_workers=16) as executor:
        io_results = list(executor.map(handle_single_file, files))

    for checksum_str, info in io_results:
        file_map[checksum_str] = info

    # 2. Check existing
    unique_checksums = list(file_map.keys())
    existing_artifacts = {}
    
    # Batch query existing in chunks of 500
    chunk_size = 500
    for i in range(0, len(unique_checksums), chunk_size):
        batch = unique_checksums[i : i + chunk_size]
        results = (
            db.query(Artifact)
            .filter(Artifact.checksum.in_(batch))
            .filter(Artifact.type == artifact_type) 
            .all()
        )
        for art in results:
            existing_artifacts[art.checksum] = art

    # 3. Create objects
    artifacts_to_insert = []
    
    # Track incremental changes for delta
    new_files_count = 0
    reused_files_count = 0

    for checksum, info in io_results:
        tmp_path = info["tmp_path"]
        
        if checksum in existing_artifacts:
            old = existing_artifacts[checksum]
            artifacts_to_insert.append(
                Artifact(
                    version_id=version.id,
                    name=info["name"],
                    type=artifact_type,
                    path=old.path,
                    size=old.size,
                    checksum=old.checksum,
                )
            )
            reused_files_count += 1
            try: os.unlink(tmp_path)
            except: pass
        else:
            cache_dir = CACHE_ROOT / checksum[:2] / checksum[2:4]
            cache_dir.mkdir(parents=True, exist_ok=True)
            cache_path = cache_dir / checksum

            if not cache_path.exists():
                shutil.move(tmp_path, cache_path)
            else:
                try: os.unlink(tmp_path)
                except: pass

            artifacts_to_insert.append(
                Artifact(
                    version_id=version.id,
                    name=info["name"],
                    type=artifact_type,
                    path=str(cache_path),
                    size=info["size"],
                    checksum=checksum,
                )
            )
            new_files_count += 1
            
            # Update existing_artifacts so subsequent duplicates in this batch use the new cache path
            # effectively treating it as "existing" for the rest of the loop
            existing_artifacts[checksum] = artifacts_to_insert[-1]

    if artifacts_to_insert:
        db.bulk_save_objects(artifacts_to_insert)
        
        # 4. Update Delta
        # Doing this inside the same transaction is safer
        delta = db.query(VersionDelta).filter(VersionDelta.version_id == version_id).first()
        if delta:
            if artifact_type == "dataset":
                delta.dataset_count += len(artifacts_to_insert)
                delta.dataset_new += new_files_count
                delta.dataset_reused += reused_files_count
                delta.new_count += new_files_count
                delta.reused_count += reused_files_count
            elif artifact_type == "label":
                delta.label_count += len(artifacts_to_insert)
                delta.label_new += new_files_count
                delta.label_reused += reused_files_count
                delta.new_count += new_files_count
                delta.reused_count += reused_files_count
        else:
            # If no delta exists (maybe created without any files initially), create one?
            # Or assume create_version always creates a delta.
            # create_version DOES create a delta.
            pass

    db.commit()
    return {"uploaded": len(artifacts_to_insert)}

