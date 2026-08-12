import os
import uuid

from fastapi import UploadFile

from app.core.config import settings

ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png", ".xml"}


def save_upload(file: UploadFile, business_id: str) -> str:
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError(f"Unsupported file type '{ext}'. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}")

    business_dir = os.path.join(settings.UPLOAD_DIR, business_id)
    os.makedirs(business_dir, exist_ok=True)

    safe_name = f"{uuid.uuid4().hex}{ext}"
    dest_path = os.path.join(business_dir, safe_name)

    with open(dest_path, "wb") as out:
        content = file.file.read()
        max_bytes = settings.MAX_UPLOAD_MB * 1024 * 1024
        if len(content) > max_bytes:
            raise ValueError(f"File exceeds the {settings.MAX_UPLOAD_MB}MB upload limit")
        out.write(content)

    return dest_path
