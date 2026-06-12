from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.services.embedding_service import warm_up_embedding_model
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.FRONTEND_URL,
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
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


app.include_router(api_router)