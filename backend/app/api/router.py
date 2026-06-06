from fastapi import APIRouter

from app.api.routes import documents, eval, health, prompts, rag

api_router = APIRouter()

api_router.include_router(health.router)
api_router.include_router(documents.router)
api_router.include_router(rag.router)
api_router.include_router(eval.router)
api_router.include_router(prompts.router)