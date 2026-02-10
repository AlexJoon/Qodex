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

from app.core.config import get_settings
from app.core.research_modes import (
    ResearchMode,
    get_research_mode_config,
    list_research_modes as get_all_research_modes,
    DEFAULT_RESEARCH_MODE,
)
from app.models import Message, MessageRole, DocumentSource
from app.providers import ProviderRegistry
from app.services.document_service import get_document_service
from app.services.attachment_service import get_attachment_service
from app.utils.streaming import create_sse_response, format_sse_event
from app.services.intent_classifier import classify_intent
from app.api.routes.discussions import get_discussions_storage

router = APIRouter(prefix="/api/chat", tags=["chat"])
logger = logging.getLogger(__name__)


class ChatRequest(BaseModel):
    """Request model for chat endpoint."""
    discussion_id: str
    message: str
    provider: str  # openai, mistral, claude, cohere
    document_ids: Optional[List[str]] = None
    attachment_ids: Optional[List[str]] = None  # conversation-scoped attachments
    temperature: float = 0.7
    max_tokens: int = 4096
    research_mode: ResearchMode = DEFAULT_RESEARCH_MODE


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
    title_updated = False
    if discussion.title == "New Chat":
        discussion.title = request.message[:50] + ("..." if len(request.message) > 50 else "")
        title_updated = True

    # Check if the discussion has attachments (needed for intent routing)
    attachment_service = get_attachment_service()
    has_attachments = len(attachment_service.list_attachments(request.discussion_id)) > 0

    # Classify user intent for structured output (zero-latency regex matching)
    # When attachments exist, also determines if Pinecone should be queried
    intent_result = classify_intent(request.message, has_attachments=has_attachments)

    # Get research mode configuration
    research_config = get_research_mode_config(request.research_mode)

    # Start RAG search in parallel with provider setup — but only when the
    # intent classifier says the knowledge base is needed.
    doc_service = get_document_service()
    rag_task = None
    if intent_result.use_knowledge_base:
        rag_task = asyncio.create_task(
            doc_service.pinecone.search_documents(
                query=request.message,
                top_k=research_config.top_k,
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
        if rag_task is not None:
            rag_task.cancel()  # Cancel pending RAG if provider fails
        raise HTTPException(status_code=400, detail=str(e))

    # Get conversation context (last N messages)
    context_messages = discussion.get_context_messages(limit=20)

    # Now await the RAG results (if Pinecone was queried)
    context = None
    sources: List[DocumentSource] = []
    if rag_task is not None:
        try:
            search_results = await rag_task

            # Deduplicate by document: group chunks, assign ONE citation per document.
            # All chunks still go into context (for AI thoroughness), but share a citation number.
            # The source entry uses the highest score and best chunk from each document.
            doc_groups: dict = {}  # doc_id -> { chunks: [...], best_score, best_chunk_id, best_preview, filename }

            for result in search_results:
                metadata = result.get("metadata")
                score = result.get("score", 0)

                if metadata and score > 0.3:
                    doc_id = metadata.get("document_id", result["id"])
                    chunk_id = result.get("id")
                    filename = metadata.get("filename", "Unknown")
                    content = metadata.get("content", "")

                    if doc_id not in doc_groups:
                        doc_groups[doc_id] = {
                            "filename": filename,
                            "chunks": [],
                            "best_score": score,
                            "best_chunk_id": chunk_id,
                            "best_preview": content[:150] + "..." if len(content) > 150 else content,
                        }

                    group = doc_groups[doc_id]
                    group["chunks"].append(content)
                    if score > group["best_score"]:
                        group["best_score"] = score
                        group["best_chunk_id"] = chunk_id
                        group["best_preview"] = content[:150] + "..." if len(content) > 150 else content

            # Build context and sources from deduplicated groups
            context_parts = []
            citation_number = 1

            for doc_id, group in doc_groups.items():
                combined_content = "\n\n".join(group["chunks"])
                context_parts.append(f"[Source {citation_number} - {group['filename']}]:\n{combined_content}")

                sources.append(DocumentSource(
                    id=doc_id,
                    filename=group["filename"],
                    score=round(group["best_score"], 3),
                    chunk_preview=group["best_preview"],
                    citation_number=citation_number,
                    chunk_id=group["best_chunk_id"],
                ))
                citation_number += 1

            if context_parts:
                context = "\n\n---\n\n".join(context_parts)
        except asyncio.CancelledError:
            pass  # RAG was cancelled
        except Exception as e:
            logger.warning(f"Pinecone search failed: {e}")

    # Inject conversation-scoped attachment context (never touches Pinecone)
    attachment_context = attachment_service.get_context_for_chat(
        discussion_id=request.discussion_id,
        attachment_ids=request.attachment_ids,
    )
    if attachment_context:
        if context:
            context = (
                attachment_context
                + "\n\n===\n\n"
                + context
            )
        else:
            context = attachment_context

    # Create streaming response
    async def generate():
        """Generate SSE events from provider stream."""
        full_response = []
        start_time = time.time()

        # Emit title update event first if title was updated
        if title_updated:
            title_data = {
                "type": "discussion_title",
                "discussion_id": request.discussion_id,
                "title": discussion.title
            }
            yield f"data: {json.dumps(title_data)}\n\n"

        # Emit sources event (if any)
        if sources:
            sources_data = {
                "type": "sources",
                "sources": [s.model_dump() for s in sources],
                "provider": request.provider
            }
            yield f"data: {json.dumps(sources_data)}\n\n"

        # Emit intent event
        intent_data = {
            "type": "intent",
            "intent": intent_result.intent,
            "label": intent_result.label
        }
        yield f"data: {json.dumps(intent_data)}\n\n"

        # Wrap the provider stream to collect raw chunks before SSE serialization,
        # avoiding the cost of re-parsing our own JSON output.
        async def _collect_and_stream():
            async for chunk in provider.stream_completion(
                messages=context_messages,
                context=context,
                temperature=request.temperature,
                max_tokens=request.max_tokens,
                intent_prompt=intent_result.prompt_suffix,
                research_prompt=research_config.prompt_enhancement,
            ):
                full_response.append(chunk)
                yield chunk

        async for sse_event in create_sse_response(
            _collect_and_stream(),
            provider=request.provider,
            send_done=False,
        ):
            yield sse_event

        # Save assistant response to discussion after streaming completes
        response_time = int((time.time() - start_time) * 1000)
        full_response_text = "".join(full_response)

        assistant_message = Message(
            id=str(uuid.uuid4()),
            content=full_response_text,
            role=MessageRole.ASSISTANT,
            provider=request.provider,
            timestamp=datetime.utcnow(),
            response_time_ms=response_time,
            sources=sources if sources else None,
            intent=intent_result.intent,
        )

        # Generate suggested questions
        try:
            # Build conversation history for context
            conversation_history = [
                {"role": msg.role.value, "content": msg.content}
                for msg in context_messages
            ]

            # Generate questions using the provider
            suggested_questions = await provider.generate_suggested_questions(
                conversation_history=conversation_history,
                last_response=full_response_text,
                count=5
            )

            # Send suggested questions event if any generated
            if suggested_questions:
                yield format_sse_event(
                    "suggested_questions",
                    {"questions": suggested_questions}
                )

                # Store in message object
                assistant_message.suggested_questions = suggested_questions

        except Exception as e:
            logger.warning(f"Failed to generate suggested questions: {e}")
            # Don't fail the whole request if question generation fails

        # Send done event after suggested questions
        yield format_sse_event("done", {"provider": request.provider})

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


@router.get("/research-modes")
async def list_research_modes():
    """List available research modes and their configurations."""
    return {
        "modes": get_all_research_modes(),
        "default": DEFAULT_RESEARCH_MODE.value
    }
