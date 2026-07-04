from datetime import datetime, timezone
from sqlalchemy import text
from sqlalchemy.orm import Session
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.router import api_router
from app.core.config import settings
from app.db import engine
from app.services.embedding_service import warm_up_embedding_model, get_embedding_model
import logging

logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Loads the local embedding model before the API begins serving requests.

    This prevents the first recruiter-facing RAG request from paying
    the SentenceTransformer cold-start cost.
    """
    
    logger.info("Starting embedding-model warm-up")

    warm_up_embedding_model()

    logger.info("Embedding-model warm-up complete")

    yield


app = FastAPI(
    title=f"{settings.PROJECT_NAME} API",
    description="Backend API for Agentic RAG Testing and Monitoring Platform",
    version=settings.API_VERSION,
    lifespan=lifespan,
)

allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

if settings.FRONTEND_URL:
    allowed_origins.extend(
        origin.strip()
        for origin in settings.FRONTEND_URL.split(",")
        if origin.strip()
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {
        "message": "AutoRAG EvalOps API is running",
        "docs": "/docs",
        "health": "/health",
    }

@app.get("/health")
def health_check():
    """
    Returns API, database, and embedding-model readiness.

    The frontend uses this endpoint for its live connection badge.
    """
    database_connected = False
    embedding_model_ready = False

    try:
        with Session(engine) as db:
            db.execute(text("select 1"))

        database_connected = True

    except Exception:
        database_connected = False

    try:
        get_embedding_model()
        embedding_model_ready = True

    except Exception:
        embedding_model_ready = False

    healthy = (
        database_connected
        and embedding_model_ready
    )

    return {
        "status": "healthy" if healthy else "degraded",
        "service": "AutoRAG EvalOps API",
        "database_connected": database_connected,
        "embedding_model_ready": embedding_model_ready,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

app.include_router(api_router)

