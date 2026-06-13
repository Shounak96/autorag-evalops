import hashlib
import os
import uuid
from pathlib import Path

from fastapi import UploadFile
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.document import Document
from app.models.document_chunk import DocumentChunk
from app.services.chunking_service import create_chunks_from_pages
from app.services.embedding_service import generate_embedding, generate_embeddings
from app.services.text_extraction_service import extract_text

class DuplicateDocumentError(ValueError):
    """
    Raised when uploaded file contents already exist in the platform.
    """

UPLOAD_DIR = Path("uploads")

ALLOWED_EXTENSIONS = {
    ".pdf",
    ".txt",
    ".md",
    ".csv",
}


def validate_file(file: UploadFile) -> str:
    file_name = file.filename or ""

    extension = Path(file_name).suffix.lower()

    if extension not in ALLOWED_EXTENSIONS:
        allowed = ", ".join(sorted(ALLOWED_EXTENSIONS))
        raise ValueError(f"Unsupported file type. Allowed types: {allowed}")

    return extension.replace(".", "")


def save_uploaded_file(
    file: UploadFile,
) -> tuple[str, int, str]:
    """
    Saves the uploaded file and calculates its SHA-256 content hash
    during the same streaming operation.

    Returns:
    - source_path
    - file_size
    - content_hash
    """
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

    original_name = file.filename or "uploaded_file"
    extension = Path(original_name).suffix.lower()

    safe_file_name = f"{uuid.uuid4()}{extension}"
    destination_path = UPLOAD_DIR / safe_file_name

    sha256 = hashlib.sha256()

    with destination_path.open("wb") as buffer:
        while True:
            chunk = file.file.read(1024 * 1024)

            if not chunk:
                break

            buffer.write(chunk)
            sha256.update(chunk)

    file_size = os.path.getsize(destination_path)
    content_hash = sha256.hexdigest()

    return str(destination_path), file_size, content_hash

def delete_saved_file(source_path: str | None) -> None:
    """
    Removes a saved upload when database validation fails.
    """
    if not source_path:
        return

    path = Path(source_path)

    if path.exists():
        path.unlink()


def get_document_by_content_hash(
    db: Session,
    content_hash: str,
) -> Document | None:
    """
    Finds an existing document with identical file contents.
    """
    return (
        db.query(Document)
        .filter(Document.content_hash == content_hash)
        .first()
    )


def create_document_record(
    db: Session,
    file_name: str,
    file_type: str,
    file_size: int,
    source_path: str,
    content_hash: str,
) -> Document:
    """
    Creates a document record after content-hash validation.

    PostgreSQL uniqueness protection is handled as an additional
    defense against concurrent duplicate uploads.
    """
    document = Document(
        file_name=file_name,
        file_type=file_type,
        file_size=file_size,
        content_hash=content_hash,
        status="uploaded",
        total_chunks=0,
        source_path=source_path,
    )

    try:
        db.add(document)
        db.commit()
        db.refresh(document)

        return document

    except IntegrityError as error:
        db.rollback()

        raise DuplicateDocumentError(
            "A document with identical content already exists."
        ) from error


def get_documents(db: Session) -> list[Document]:
    return (
        db.query(Document)
        .order_by(Document.created_at.desc())
        .all()
    )


def get_document_by_id(db: Session, document_id: str) -> Document | None:
    return (
        db.query(Document)
        .filter(Document.id == document_id)
        .first()
    )

def delete_document(
    db: Session,
    document: Document,
) -> None:
    """
    Deletes a document, its related chunks, and its saved upload file.
    """
    source_path = document.source_path

    db.delete(document)
    db.commit()

    delete_saved_file(source_path)


def get_chunks_by_document_id(
    db: Session,
    document_id: str,
) -> list[DocumentChunk]:
    return (
        db.query(DocumentChunk)
        .filter(DocumentChunk.document_id == document_id)
        .order_by(DocumentChunk.chunk_index.asc())
        .all()
    )


def process_document(
    db: Session,
    document: Document,
) -> Document:
    if not document.source_path:
        raise ValueError("Document has no source path")

    if not os.path.exists(document.source_path):
        raise FileNotFoundError("Uploaded source file was not found")

    existing_chunks = get_chunks_by_document_id(db, document.id)

    if existing_chunks:
        for chunk in existing_chunks:
            db.delete(chunk)

        db.commit()

    pages = extract_text(
        file_path=document.source_path,
        file_type=document.file_type,
    )

    chunks = create_chunks_from_pages(
        pages=pages,
        chunk_size=1000,
        overlap=200,
    )

    chunk_texts = [chunk.content for chunk in chunks]
    embeddings = generate_embeddings(chunk_texts) if chunk_texts else []

    for chunk, embedding in zip(chunks, embeddings):
        db_chunk = DocumentChunk(
            document_id=document.id,
            chunk_index=chunk.chunk_index,
            page_number=chunk.page_number,
            content=chunk.content,
            embedding=embedding,
        )
        db.add(db_chunk)

    document.total_chunks = len(chunks)
    document.status = "processed" if chunks else "processed_empty"

    db.add(document)
    db.commit()
    db.refresh(document)

    return document


def semantic_search_chunks(
    db: Session,
    query: str,
    limit: int = 5,
) -> list[dict]:
    query_embedding = generate_embedding(query)

    sql = text(
        """
        select
            document_chunks.id as chunk_id,
            document_chunks.document_id as document_id,
            documents.file_name as file_name,
            document_chunks.chunk_index as chunk_index,
            document_chunks.page_number as page_number,
            document_chunks.content as content,
            1 - (document_chunks.embedding <=> CAST(:query_embedding AS vector)) as similarity_score
        from document_chunks
        join documents on documents.id = document_chunks.document_id
        where document_chunks.embedding is not null
        order by document_chunks.embedding <=> CAST(:query_embedding AS vector)
        limit :limit
        """
    )

    result = db.execute(
        sql,
        {
            "query_embedding": query_embedding,
            "limit": limit,
        },
    )

    rows = result.mappings().all()

    return [dict(row) for row in rows]