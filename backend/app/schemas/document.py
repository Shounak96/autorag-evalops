from datetime import datetime

from pydantic import BaseModel


class DocumentResponse(BaseModel):
    id: str
    file_name: str
    file_type: str
    file_size: int | None
    status: str
    total_chunks: int
    source_path: str | None
    created_at: datetime

    model_config = {
        "from_attributes": True
    }


class DocumentListResponse(BaseModel):
    documents: list[DocumentResponse]
    count: int


class DocumentChunkResponse(BaseModel):
    id: str
    document_id: str
    chunk_index: int
    page_number: int | None
    content: str
    created_at: datetime

    model_config = {
        "from_attributes": True
    }


class DocumentChunkListResponse(BaseModel):
    chunks: list[DocumentChunkResponse]
    count: int


class ProcessDocumentResponse(BaseModel):
    document_id: str
    status: str
    total_chunks: int
    message: str


class SearchResultResponse(BaseModel):
    chunk_id: str
    document_id: str
    file_name: str
    chunk_index: int
    page_number: int | None
    content: str
    similarity_score: float


class SearchResponse(BaseModel):
    query: str
    results: list[SearchResultResponse]
    count: int