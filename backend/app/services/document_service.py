from typing import List, Optional, Dict, Any
import tiktoken
import uuid
import os
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
        # Path to placeholder PDF
        self.placeholder_pdf_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "..", "..", "Financing-the-Clean-Energy-Economy.pdf")

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

    async def get_document(self, document_id: str) -> Optional[Document]:
        """Get a document by ID."""
        document = self._documents.get(document_id)
        
        if document:
            return document
        
        # If not in memory, get chunks from Pinecone and reconstruct
        try:
            chunks = await self.pinecone.get_chunks_by_document(document_id)
            if chunks:
                # Extract metadata from first chunk
                first_chunk = chunks[0]
                metadata = first_chunk.get("metadata", {})
                
                # Use actual chunk IDs from Pinecone instead of trying to match
                actual_chunk_ids = [chunk["id"] for chunk in chunks]
                
                # Reconstruct document
                return Document(
                    id=document_id,
                    filename=metadata.get("filename", "Unknown Document"),
                    content_type=metadata.get("content_type", "application/pdf"),
                    file_size=metadata.get("file_size", 0),
                    chunk_count=len(chunks),
                    chunk_ids=actual_chunk_ids
                )
        except Exception as e:
            print(f"Error reconstructing document from Pinecone: {e}")
        
        return None

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

    async def get_document_content(self, document_id: str) -> Dict[str, Any]:
        """
        Get full document content for preview.
        
        Args:
            document_id: ID of document
            
        Returns:
            Dictionary with document metadata and full content
        """
        document = self._documents.get(document_id)
        
        if not document:
            # Try to reconstruct from Pinecone
            try:
                chunks = await self.pinecone.get_chunks_by_document(document_id)
                if chunks:
                    # Extract metadata from first chunk
                    first_chunk = chunks[0]
                    metadata = first_chunk.get("metadata", {})
                    
                    # Reconstruct document
                    document = Document(
                        id=document_id,
                        filename=metadata.get("filename", "Unknown Document"),
                        content_type=metadata.get("content_type", "application/pdf"),
                        file_size=metadata.get("file_size", 0),
                        chunk_count=len(chunks),
                        chunk_ids=[chunk.get("id") for chunk in chunks]
                    )
            except Exception as e:
                raise ValueError(f"Document not found: {document_id}")
        
        # Get all chunks from Pinecone
        chunks = await self.pinecone.get_chunks_by_document(document_id)
        
        # Reconstruct full content by concatenating chunks in order
        full_content = ""
        chunk_contents = []
        
        for chunk_id in document.chunk_ids:
            chunk = next((c for c in chunks if c.get("id") == chunk_id), None)
            if chunk and chunk.get("metadata", {}).get("content"):
                content = chunk["metadata"]["content"]
                chunk_contents.append({
                    "id": chunk_id,
                    "content": content,
                    "chunk_index": chunk["metadata"].get("chunk_index", 0)
                })
                full_content += content + "\n\n"
        
        return {
            "id": document.id,
            "filename": document.filename,
            "content_type": document.content_type,
            "file_size": document.file_size,
            "chunk_count": document.chunk_count,
            "full_content": full_content.strip(),
            "chunks": chunk_contents
        }
    
    async def get_document_chunks(self, document_id: str) -> List[Dict[str, Any]]:
        """
        Get document chunks for preview.
        
        Args:
            document_id: ID of the document
            
        Returns:
            List of chunk data with content and metadata
        """
        print(f"DEBUG: get_document_chunks called with document_id: {document_id}")
        document = self._documents.get(document_id)
        if not document:
            raise ValueError(f"Document not found: {document_id}")
        
        # Get all chunks from Pinecone
        chunks = await self.pinecone.get_chunks_by_document(document_id)
        print(f"DEBUG: Found {len(chunks)} chunks from Pinecone")
        
        # Sort chunks by chunk_index and return directly
        sorted_chunks = []
        for chunk in chunks:
            if chunk.get("metadata"):
                sorted_chunks.append({
                    "id": chunk["id"],
                    "chunk_index": chunk["metadata"].get("chunk_index", 0),
                    "filename": chunk["metadata"].get("filename", document.filename)
                })
        
        print(f"DEBUG: Returning {len(sorted_chunks)} sorted chunks")
        return sorted_chunks


# Singleton instance
_document_service: Optional[DocumentService] = None

def get_document_service() -> DocumentService:
    """Get the singleton DocumentService instance."""
    global _document_service
    if _document_service is None:
        _document_service = DocumentService()
    return _document_service
