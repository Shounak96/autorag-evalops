from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas.document import (
    DocumentChunkListResponse,
    DocumentListResponse,
    DocumentResponse,
    ProcessDocumentResponse,
    SearchResponse,
)
from app.services.document_service import (
    create_document_record,
    get_chunks_by_document_id,
    get_document_by_id,
    get_documents,
    process_document,
    save_uploaded_file,
    semantic_search_chunks,
    validate_file,
)

router = APIRouter(prefix="/documents", tags=["Documents"])


@router.post("/upload", response_model=DocumentResponse)
def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    try:
        file_type = validate_file(file)
        source_path, file_size = save_uploaded_file(file)

        document = create_document_record(
            db=db,
            file_name=file.filename or "uploaded_file",
            file_type=file_type,
            file_size=file_size,
            source_path=source_path,
        )

        return document

    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        )

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Document upload failed: {str(error)}",
        )


@router.get("", response_model=DocumentListResponse)
def list_documents(db: Session = Depends(get_db)):
    documents = get_documents(db)

    return {
        "documents": documents,
        "count": len(documents),
    }


@router.get("/search", response_model=SearchResponse)
def search_documents(
    query: str = Query(..., min_length=2),
    limit: int = Query(default=5, ge=1, le=10),
    db: Session = Depends(get_db),
):
    try:
        results = semantic_search_chunks(
            db=db,
            query=query,
            limit=limit,
        )

        return {
            "query": query,
            "results": results,
            "count": len(results),
        }

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Semantic search failed: {str(error)}",
        )


@router.get("/{document_id}", response_model=DocumentResponse)
def get_document(
    document_id: str,
    db: Session = Depends(get_db),
):
    document = get_document_by_id(db, document_id)

    if not document:
        raise HTTPException(
            status_code=404,
            detail="Document not found",
        )

    return document


@router.post("/{document_id}/process", response_model=ProcessDocumentResponse)
def process_uploaded_document(
    document_id: str,
    db: Session = Depends(get_db),
):
    document = get_document_by_id(db, document_id)

    if not document:
        raise HTTPException(
            status_code=404,
            detail="Document not found",
        )

    try:
        processed_document = process_document(
            db=db,
            document=document,
        )

        return {
            "document_id": processed_document.id,
            "status": processed_document.status,
            "total_chunks": processed_document.total_chunks,
            "message": "Document processed successfully with embeddings",
        }

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Document processing failed: {str(error)}",
        )


@router.get("/{document_id}/chunks", response_model=DocumentChunkListResponse)
def list_document_chunks(
    document_id: str,
    db: Session = Depends(get_db),
):
    document = get_document_by_id(db, document_id)

    if not document:
        raise HTTPException(
            status_code=404,
            detail="Document not found",
        )

    chunks = get_chunks_by_document_id(
        db=db,
        document_id=document_id,
    )

    return {
        "chunks": chunks,
        "count": len(chunks),
    }