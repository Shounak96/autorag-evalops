from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas.rag import RagAskRequest, RagAskResponse
from app.services.rag_service import run_advanced_rag

router = APIRouter(prefix="/rag", tags=["Advanced RAG"])


@router.post("/ask", response_model=RagAskResponse)
def ask_rag(
    request: RagAskRequest,
    db: Session = Depends(get_db),
):
    try:
        return run_advanced_rag(
            db=db,
            question=request.question,
            top_k=request.top_k,
            vector_weight=request.vector_weight,
            keyword_weight=request.keyword_weight,
            use_query_rewrite=request.use_query_rewrite,
            max_rewritten_queries=request.max_rewritten_queries,
            prompt_version_id=request.prompt_version_id,
        )

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Advanced RAG pipeline failed: {str(error)}",
        )