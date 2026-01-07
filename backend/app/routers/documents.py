from fastapi import APIRouter, HTTPException, UploadFile, File
from typing import List
from pydantic import BaseModel

from app.models import Document
from app.services.document_service import get_document_service

router = APIRouter(prefix="/api/documents", tags=["documents"])

# Allowed file types
ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "text/plain",
    "text/markdown",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}

ALLOWED_EXTENSIONS = {".pdf", ".txt", ".md", ".docx"}


class SearchRequest(BaseModel):
    """Request model for document search."""
    query: str
    top_k: int = 5
    document_ids: List[str] = None


class SearchResult(BaseModel):
    """Search result model."""
    id: str
    score: float
    content: str
    filename: str


@router.post("/upload", response_model=Document)
async def upload_document(file: UploadFile = File(...)):
    """
    Upload and process a document.

    The document will be chunked, embedded, and stored in Pinecone.
    """
    # Validate file type
    filename = file.filename or "unknown"
    extension = "." + filename.split(".")[-1].lower() if "." in filename else ""

    if file.content_type not in ALLOWED_CONTENT_TYPES and extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type. Allowed types: {ALLOWED_EXTENSIONS}"
        )

    # Read file content
    content = await file.read()

    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Empty file")

    if len(content) > 10 * 1024 * 1024:  # 10MB limit
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 10MB")

    # Process document
    doc_service = get_document_service()

    try:
        document = await doc_service.process_document(
            filename=filename,
            content=content,
            content_type=file.content_type or "application/octet-stream"
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process document: {str(e)}")

    return document


@router.get("", response_model=List[Document])
async def list_documents():
    """List all uploaded documents."""
    doc_service = get_document_service()
    return doc_service.list_documents()


@router.get("/{document_id}", response_model=Document)
async def get_document(document_id: str):
    """Get a document by ID."""
    doc_service = get_document_service()
    document = doc_service.get_document(document_id)

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    return document


@router.delete("/{document_id}")
async def delete_document(document_id: str):
    """Delete a document and its vectors."""
    doc_service = get_document_service()
    deleted = await doc_service.delete_document(document_id)

    if not deleted:
        raise HTTPException(status_code=404, detail="Document not found")

    return {"status": "deleted", "id": document_id}


@router.post("/search", response_model=List[SearchResult])
async def search_documents(request: SearchRequest):
    """Search documents by semantic similarity."""
    doc_service = get_document_service()

    results = await doc_service.pinecone.search_documents(
        query=request.query,
        top_k=request.top_k,
        document_ids=request.document_ids
    )

    return [
        SearchResult(
            id=r["id"],
            score=r["score"],
            content=r["metadata"].get("content", "") if r.get("metadata") else "",
            filename=r["metadata"].get("filename", "") if r.get("metadata") else ""
        )
        for r in results
    ]
