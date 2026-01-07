from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional, Tuple
from datetime import datetime
import uuid
import time
import json
import asyncio
import logging

from app.config import get_settings
from app.models import Message, MessageRole, DocumentSource
from app.services.ai_providers import ProviderRegistry
from app.services.document_service import get_document_service
from app.utils.streaming import create_sse_response, format_sse_event
from app.routers.discussions import get_discussions_storage

router = APIRouter(prefix="/api/chat", tags=["chat"])
logger = logging.getLogger(__name__)


class ChatRequest(BaseModel):
    """Request model for chat endpoint."""
    discussion_id: str
    message: str
    provider: str  # openai, mistral, claude, cohere
    document_ids: Optional[List[str]] = None
    temperature: float = 0.7
    max_tokens: int = 4096


class ChatResponse(BaseModel):
    """Response model for non-streaming chat."""
    content: str
    provider: str
    response_time_ms: int


@router.post("/stream")
async def stream_chat(request: ChatRequest):
    """
    Stream a chat response using SSE.

    This endpoint streams the AI response in chunks, formatted as SSE events.
    """
    settings = get_settings()
    discussions = get_discussions_storage()

    # Validate discussion exists
    discussion = discussions.get(request.discussion_id)
    if not discussion:
        raise HTTPException(status_code=404, detail="Discussion not found")

    # Get provider configuration
    provider_configs = {
        "openai": (settings.openai_api_key, settings.openai_model),
        "mistral": (settings.mistral_api_key, settings.mistral_model),
        "claude": (settings.anthropic_api_key, settings.anthropic_model),
        "cohere": (settings.cohere_api_key, settings.cohere_model),
    }

    if request.provider not in provider_configs:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid provider: {request.provider}. Valid providers: {list(provider_configs.keys())}"
        )

    api_key, model = provider_configs[request.provider]
    if not api_key:
        raise HTTPException(
            status_code=400,
            detail=f"API key not configured for provider: {request.provider}"
        )

    # Add user message to discussion
    user_message = Message(
        id=str(uuid.uuid4()),
        content=request.message,
        role=MessageRole.USER,
        timestamp=datetime.utcnow()
    )
    discussion.add_message(user_message)

    # Auto-generate title from first user message if still default
    if discussion.title == "New Chat":
        discussion.title = request.message[:50] + ("..." if len(request.message) > 50 else "")

    # Start RAG search in parallel with provider setup (non-blocking)
    doc_service = get_document_service()
    rag_task = asyncio.create_task(
        doc_service.pinecone.search_documents(
            query=request.message,
            top_k=5,
            document_ids=request.document_ids if request.document_ids else None
        )
    )

    # Get the provider (runs in parallel with RAG search)
    try:
        provider = ProviderRegistry.get_provider(
            name=request.provider,
            api_key=api_key,
            model=model
        )
    except ValueError as e:
        rag_task.cancel()  # Cancel pending RAG if provider fails
        raise HTTPException(status_code=400, detail=str(e))

    # Get conversation context (last N messages)
    context_messages = discussion.get_context_messages(limit=20)

    # Now await the RAG results (should be mostly complete by now)
    context = None
    sources: List[DocumentSource] = []
    try:
        search_results = await rag_task

        # Single-pass processing: build sources and context together
        seen_docs = set()
        context_parts = []
        for result in search_results:
            metadata = result.get("metadata")
            score = result.get("score", 0)

            if metadata and score > 0.3:
                doc_id = metadata.get("document_id", result["id"])
                filename = metadata.get("filename", "Unknown")
                content = metadata.get("content", "")

                # Add to context
                context_parts.append(f"[From {filename}]:\n{content}")

                # Add to sources (dedupe by document)
                if doc_id not in seen_docs:
                    seen_docs.add(doc_id)
                    sources.append(DocumentSource(
                        id=doc_id,
                        filename=filename,
                        score=round(score, 3),
                        chunk_preview=content[:150] + "..." if len(content) > 150 else content
                    ))

        if context_parts:
            context = "\n\n---\n\n".join(context_parts)
    except asyncio.CancelledError:
        pass  # RAG was cancelled
    except Exception as e:
        logger.warning(f"Pinecone search failed: {e}")

    # Create streaming response
    async def generate():
        """Generate SSE events from provider stream."""
        full_response = []
        start_time = time.time()

        # Emit sources event first (if any)
        if sources:
            sources_data = {
                "type": "sources",
                "sources": [s.model_dump() for s in sources],
                "provider": request.provider
            }
            yield f"data: {json.dumps(sources_data)}\n\n"

        async for chunk in create_sse_response(
            provider.stream_completion(
                messages=context_messages,
                context=context,
                temperature=request.temperature,
                max_tokens=request.max_tokens
            ),
            provider=request.provider
        ):
            # Collect response for saving
            if '"type": "chunk"' in chunk:
                try:
                    data = json.loads(chunk.replace("data: ", "").strip())
                    if data.get("content"):
                        full_response.append(data["content"])
                except:
                    pass
            yield chunk

        # Save assistant response to discussion after streaming completes
        response_time = int((time.time() - start_time) * 1000)
        assistant_message = Message(
            id=str(uuid.uuid4()),
            content="".join(full_response),
            role=MessageRole.ASSISTANT,
            provider=request.provider,
            timestamp=datetime.utcnow(),
            response_time_ms=response_time,
            sources=sources if sources else None
        )
        discussion.add_message(assistant_message)

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


@router.get("/providers")
async def list_providers():
    """List available AI providers and their status."""
    settings = get_settings()

    providers = [
        {
            "name": "openai",
            "display_name": "OpenAI",
            "model": settings.openai_model,
            "configured": bool(settings.openai_api_key),
        },
        {
            "name": "mistral",
            "display_name": "Mistral",
            "model": settings.mistral_model,
            "configured": bool(settings.mistral_api_key),
        },
        {
            "name": "claude",
            "display_name": "Claude",
            "model": settings.anthropic_model,
            "configured": bool(settings.anthropic_api_key),
        },
        {
            "name": "cohere",
            "display_name": "Cohere",
            "model": settings.cohere_model,
            "configured": bool(settings.cohere_api_key),
        },
    ]

    return {"providers": providers}
