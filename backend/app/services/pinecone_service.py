from typing import List, Optional, Dict, Any
from pinecone import Pinecone, ServerlessSpec
from openai import AsyncOpenAI
import asyncio

from app.core.config import get_settings


class PineconeService:
    """Service for interacting with Pinecone vector database."""

    def __init__(self):
        self.settings = get_settings()
        self._pc: Optional[Pinecone] = None
        self._index = None
        self._openai_client: Optional[AsyncOpenAI] = None

    def _get_pinecone(self) -> Pinecone:
        """Lazy initialization of Pinecone client."""
        if self._pc is None:
            self._pc = Pinecone(api_key=self.settings.pinecone_api_key)
        return self._pc

    def _get_index(self):
        """Get or create the Pinecone index."""
        if self._index is None:
            pc = self._get_pinecone()
            index_name = self.settings.pinecone_index_name

            # Check if index exists
            existing_indexes = pc.list_indexes()
            index_names = [idx.name for idx in existing_indexes]

            if index_name not in index_names:
                # Create the index
                pc.create_index(
                    name=index_name,
                    dimension=1536,  # OpenAI embedding dimension
                    metric="cosine",
                    spec=ServerlessSpec(
                        cloud="aws",
                        region="us-east-1"
                    )
                )

            # Use host if provided, otherwise use index name
            if self.settings.pinecone_host:
                self._index = pc.Index(host=self.settings.pinecone_host)
            else:
                self._index = pc.Index(index_name)

        return self._index

    def _get_openai(self) -> AsyncOpenAI:
        """Get OpenAI client for embeddings."""
        if self._openai_client is None:
            self._openai_client = AsyncOpenAI(api_key=self.settings.openai_api_key)
        return self._openai_client

    async def create_embedding(self, text: str) -> List[float]:
        """Create an embedding for the given text."""
        client = self._get_openai()
        response = await client.embeddings.create(
            model="text-embedding-3-small",
            input=text
        )
        return response.data[0].embedding

    async def create_embeddings_batch(self, texts: List[str]) -> List[List[float]]:
        """Create embeddings for multiple texts."""
        client = self._get_openai()
        response = await client.embeddings.create(
            model="text-embedding-3-small",
            input=texts
        )
        return [item.embedding for item in response.data]

    async def upsert_vectors(
        self,
        vectors: List[Dict[str, Any]],
        namespace: str = ""
    ) -> None:
        """
        Upsert vectors to Pinecone.

        Args:
            vectors: List of dicts with 'id', 'values', and optional 'metadata'
            namespace: Optional namespace for the vectors
        """
        index = self._get_index()
        # Run in thread pool since Pinecone client is synchronous
        await asyncio.to_thread(
            index.upsert,
            vectors=vectors,
            namespace=namespace
        )

    async def query_vectors(
        self,
        query_embedding: List[float],
        top_k: int = 5,
        namespace: str = "",
        filter: Optional[Dict[str, Any]] = None,
        include_metadata: bool = True
    ) -> List[Dict[str, Any]]:
        """
        Query similar vectors from Pinecone.

        Args:
            query_embedding: The query vector
            top_k: Number of results to return
            namespace: Optional namespace to search in
            filter: Optional metadata filter
            include_metadata: Whether to include metadata in results

        Returns:
            List of matching vectors with scores and metadata
        """
        index = self._get_index()
        results = await asyncio.to_thread(
            index.query,
            vector=query_embedding,
            top_k=top_k,
            namespace=namespace,
            filter=filter,
            include_metadata=include_metadata
        )

        return [
            {
                "id": match.id,
                "score": match.score,
                "metadata": match.metadata if include_metadata else None
            }
            for match in results.matches
        ]

    async def delete_vectors(
        self,
        ids: Optional[List[str]] = None,
        namespace: str = "",
        filter: Optional[Dict[str, Any]] = None,
        delete_all: bool = False
    ) -> None:
        """
        Delete vectors from Pinecone.

        Args:
            ids: List of vector IDs to delete
            namespace: Optional namespace
            filter: Optional metadata filter for deletion
            delete_all: If True, delete all vectors in namespace
        """
        index = self._get_index()
        await asyncio.to_thread(
            index.delete,
            ids=ids,
            namespace=namespace,
            filter=filter,
            delete_all=delete_all
        )

    async def search_documents(
        self,
        query: str,
        top_k: int = 5,
        document_ids: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """
        Search for relevant document chunks.

        Args:
            query: The search query
            top_k: Number of results to return
            document_ids: Optional list of document IDs to filter by

        Returns:
            List of relevant chunks with content and metadata
        """
        # Create embedding for the query
        query_embedding = await self.create_embedding(query)

        # Build filter if document_ids provided
        filter_dict = None
        if document_ids:
            filter_dict = {"document_id": {"$in": document_ids}}

        # Query Pinecone
        results = await self.query_vectors(
            query_embedding=query_embedding,
            top_k=top_k,
            filter=filter_dict
        )

        return results

    async def get_chunks_by_document(self, document_id: str) -> List[Dict[str, Any]]:
        """
        Get all chunks for a specific document.
        
        Args:
            document_id: ID of the document
            
        Returns:
            List of chunks with their metadata
        """
        print(f"DEBUG: get_chunks_by_document called with document_id: {document_id}")
        
        # Query Pinecone for all chunks of this document
        # Using a dummy embedding vector to retrieve all matching documents
        dummy_embedding = [0.0] * 1536  # OpenAI embedding dimension
        
        results = await self.query_vectors(
            query_embedding=dummy_embedding,
            top_k=1000,  # Large number to get all chunks
            filter={"document_id": document_id}
        )
        
        print(f"DEBUG: Found {len(results)} chunks for document {document_id}")
        return results


# Singleton instance
_pinecone_service: Optional[PineconeService] = None


def get_pinecone_service() -> PineconeService:
    """Get the singleton PineconeService instance."""
    global _pinecone_service
    if _pinecone_service is None:
        _pinecone_service = PineconeService()
    return _pinecone_service
