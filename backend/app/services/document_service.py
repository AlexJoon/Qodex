from typing import List, Optional, Dict, Any
import tiktoken
import uuid
from pypdf import PdfReader
from docx import Document as DocxDocument
import io

from app.models.document import Document, DocumentChunk
from app.services.pinecone_service import get_pinecone_service


class DocumentService:
    """Service for processing and managing documents."""

    def __init__(self):
        self.pinecone = get_pinecone_service()
        self.tokenizer = tiktoken.get_encoding("cl100k_base")
        self.max_chunk_tokens = 500
        self.chunk_overlap = 50
        # In-memory document store (replace with DB in production)
        self._documents: Dict[str, Document] = {}

    def _count_tokens(self, text: str) -> int:
        """Count tokens in text."""
        return len(self.tokenizer.encode(text))

    def _chunk_text(self, text: str) -> List[str]:
        """Split text into chunks based on token count."""
        sentences = text.replace('\n', ' ').split('. ')
        chunks = []
        current_chunk = []
        current_tokens = 0

        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue

            sentence_tokens = self._count_tokens(sentence)

            if current_tokens + sentence_tokens > self.max_chunk_tokens:
                if current_chunk:
                    chunks.append('. '.join(current_chunk) + '.')
                current_chunk = [sentence]
                current_tokens = sentence_tokens
            else:
                current_chunk.append(sentence)
                current_tokens += sentence_tokens

        if current_chunk:
            chunks.append('. '.join(current_chunk) + '.')

        return chunks

    def _extract_text_from_pdf(self, content: bytes) -> str:
        """Extract text from PDF content."""
        reader = PdfReader(io.BytesIO(content))
        text = ""
        for page in reader.pages:
            text += page.extract_text() + "\n"
        return text

    def _extract_text_from_docx(self, content: bytes) -> str:
        """Extract text from DOCX content."""
        doc = DocxDocument(io.BytesIO(content))
        text = ""
        for paragraph in doc.paragraphs:
            text += paragraph.text + "\n"
        return text

    def _extract_text(self, content: bytes, content_type: str, filename: str) -> str:
        """Extract text from document based on type."""
        if content_type == "application/pdf" or filename.endswith(".pdf"):
            return self._extract_text_from_pdf(content)
        elif content_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document" or filename.endswith(".docx"):
            return self._extract_text_from_docx(content)
        elif content_type.startswith("text/") or filename.endswith((".txt", ".md")):
            return content.decode("utf-8")
        else:
            raise ValueError(f"Unsupported content type: {content_type}")

    async def process_document(
        self,
        filename: str,
        content: bytes,
        content_type: str
    ) -> Document:
        """
        Process and embed a document.

        Args:
            filename: Name of the file
            content: Raw file content
            content_type: MIME type of the file

        Returns:
            Document object with metadata
        """
        # Create document record
        doc_id = str(uuid.uuid4())
        document = Document(
            id=doc_id,
            filename=filename,
            content_type=content_type,
            file_size=len(content)
        )

        # Extract text
        text = self._extract_text(content, content_type, filename)

        # Chunk the text
        chunks = self._chunk_text(text)
        document.chunk_count = len(chunks)

        # Create embeddings for all chunks
        embeddings = await self.pinecone.create_embeddings_batch(chunks)

        # Prepare vectors for Pinecone
        vectors = []
        chunk_ids = []
        for i, (chunk_text, embedding) in enumerate(zip(chunks, embeddings)):
            chunk_id = f"{doc_id}_{i}"
            chunk_ids.append(chunk_id)
            vectors.append({
                "id": chunk_id,
                "values": embedding,
                "metadata": {
                    "document_id": doc_id,
                    "filename": filename,
                    "chunk_index": i,
                    "content": chunk_text
                }
            })

        # Upsert to Pinecone
        await self.pinecone.upsert_vectors(vectors)

        # Update document record
        document.chunk_ids = chunk_ids
        document.is_embedded = True

        # Store document
        self._documents[doc_id] = document

        return document

    async def delete_document(self, document_id: str) -> bool:
        """
        Delete a document and its vectors.

        Args:
            document_id: ID of the document to delete

        Returns:
            True if deleted, False if not found
        """
        document = self._documents.get(document_id)
        if not document:
            return False

        # Delete vectors from Pinecone
        await self.pinecone.delete_vectors(ids=document.chunk_ids)

        # Remove from store
        del self._documents[document_id]
        return True

    def get_document(self, document_id: str) -> Optional[Document]:
        """Get a document by ID."""
        return self._documents.get(document_id)

    def list_documents(self) -> List[Document]:
        """List all documents."""
        return list(self._documents.values())

    async def search_documents(
        self,
        query: str,
        top_k: int = 5,
        document_ids: Optional[List[str]] = None
    ) -> str:
        """
        Search documents and return formatted context.

        Args:
            query: Search query
            top_k: Number of chunks to retrieve
            document_ids: Optional filter by document IDs

        Returns:
            Formatted context string for the AI
        """
        results = await self.pinecone.search_documents(
            query=query,
            top_k=top_k,
            document_ids=document_ids
        )

        if not results:
            return ""

        context_parts = []
        for result in results:
            if result.get("metadata"):
                filename = result["metadata"].get("filename", "Unknown")
                content = result["metadata"].get("content", "")
                context_parts.append(f"[From {filename}]:\n{content}")

        return "\n\n---\n\n".join(context_parts)


# Singleton instance
_document_service: Optional[DocumentService] = None


def get_document_service() -> DocumentService:
    """Get the singleton DocumentService instance."""
    global _document_service
    if _document_service is None:
        _document_service = DocumentService()
    return _document_service
