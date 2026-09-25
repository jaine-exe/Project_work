import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Added returns router to the imports
from app.api.routes import auth, chat, compliance, gst, invoices, returns
from app.core.config import settings
from app.db import models  # noqa: F401 — ensures models are registered before create_all
from app.db.database import Base, engine

os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.APP_NAME,
    description="Backend for GST Lite — invoice upload, OCR, AI compliance checking, "
    "risk scoring, and GST return generation.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(invoices.router)
app.include_router(compliance.router)
app.include_router(gst.router)
app.include_router(chat.router)
app.include_router(returns.router)  # Registered Phase 2 return router


@app.get("/api/health", tags=["health"])
def health_check():
    return {"status": "ok", "env": settings.ENV, "ocr_provider": settings.OCR_PROVIDER}