from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional, Tuple
from datetime import datetime
import uuid
import time
import json
import asyncio
import logging
import re

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
from app.services.discussion_service import get_discussion_service
from app.utils.streaming import create_sse_response, format_sse_event
from app.services.intent_classifier import classify_intent
from app.auth import get_current_user_id

router = APIRouter(prefix="/api/chat", tags=["chat"])
logger = logging.getLogger(__name__)

_CITATION_RE = re.compile(r'\[\d+\]')

# Fallback minimum cosine similarity (used only if research config lacks min_score)
_MIN_SCORE = 0.40


def _match_documents_by_filename(query: str, documents) -> Optional[List[str]]:
    """Pre-filter documents by matching query terms against filenames.

    If the query contains words that closely match a filename, restrict the
    Pinecone search to those documents. This prevents structurally similar
    but content-irrelevant documents from polluting the results.

    Returns a list of document_ids if matches are found, otherwise None
    (meaning: search across all documents).
    """
    if not documents:
        return None

    query_lower = query.lower()
    # Tokenize query into meaningful words (3+ chars, skip stop words)
    stop_words = {
        "the", "and", "for", "are", "but", "not", "you", "all", "can",
        "had", "her", "was", "one", "our", "out", "has", "his", "how",
        "its", "may", "new", "now", "old", "see", "way", "who", "did",
        "get", "let", "say", "she", "too", "use", "what", "when", "where",
        "which", "while", "with", "this", "that", "from", "about", "some",
        "them", "then", "than", "into", "over", "such", "list", "give",
        "tell", "show", "find", "readings", "documents", "document",
        "syllabus", "syllabi", "course", "class", "what", "does",
    }
    query_words = [
        w for w in re.findall(r'[a-z]+', query_lower)
        if len(w) >= 3 and w not in stop_words
    ]

    if not query_words:
        return None

    matched_ids = []
    for doc in documents:
        fname_lower = doc.filename.lower()
        # Strip extension and split filename into tokens
        fname_base = re.sub(r'\.[^.]+$', '', fname_lower)
        fname_tokens = set(re.findall(r'[a-z]+', fname_base))

        for qw in query_words:
            # Match if query word appears as a substring in the filename
            if qw in fname_lower or any(qw in ft for ft in fname_tokens):
                matched_ids.append(doc.id)
                break

    return matched_ids if matched_ids else None


def _extract_query_terms(query: str) -> List[str]:
    """Extract meaningful terms from a query for filename post-filtering."""
    stop_words = {
        "the", "and", "for", "are", "but", "not", "you", "all", "can",
        "had", "her", "was", "one", "our", "out", "has", "his", "how",
        "its", "may", "new", "now", "old", "see", "way", "who", "did",
        "get", "let", "say", "she", "too", "use", "what", "when", "where",
        "which", "while", "with", "this", "that", "from", "about", "some",
        "them", "then", "than", "into", "over", "such", "list", "give",
        "tell", "show", "find", "readings", "documents", "document",
        "syllabus", "syllabi", "course", "class", "does", "teach",
    }
    return [
        w for w in re.findall(r'[a-z]+', query.lower())
        if len(w) >= 3 and w not in stop_words
    ]


def _sanitize_history_messages(messages: List[Message]) -> List[Message]:
    """Strip stale source facts from old assistant messages.

    Each turn gets its own Pinecone results with fresh citation numbers.
    If we send full old assistant responses into the context window, the AI
    conflates facts from previous sources with the current ones — causing
    hallucinations (e.g. wrong affiliations, misattributed claims).

    This function truncates assistant messages so the AI sees enough for
    conversational continuity but not enough to carry stale facts forward.
    User messages are kept intact.
    """
    MAX_CHARS = 300
    sanitized = []
    for msg in messages:
        if msg.role == MessageRole.ASSISTANT:
            # Strip old citation markers — they reference different sources
            content = _CITATION_RE.sub('', msg.content).strip()
            # Collapse runs of whitespace left by stripped citations
            content = re.sub(r'  +', ' ', content)
            if len(content) > MAX_CHARS:
                content = content[:MAX_CHARS].rsplit(' ', 1)[0] + " [earlier response truncated]"
            sanitized.append(Message(
                id=msg.id,
                content=content,
                role=msg.role,
                timestamp=msg.timestamp,
            ))
        else:
            sanitized.append(msg)
    return sanitized


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
async def stream_chat(
    request: ChatRequest,
    user_id: str = Depends(get_current_user_id),
):
    """
    Stream a chat response using SSE.

    This endpoint streams the AI response in chunks, formatted as SSE events.
    """
    settings = get_settings()
    disc_service = get_discussion_service()

    # Validate discussion exists and belongs to user
    discussion = disc_service.get_discussion(request.discussion_id, user_id)
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
    disc_service.add_message(request.discussion_id, user_message)

    # Auto-generate title from first user message if still default
    title_updated = False
    if discussion.title == "New Chat":
        new_title = request.message[:50] + ("..." if len(request.message) > 50 else "")
        disc_service.update_discussion(request.discussion_id, user_id, title=new_title)
        discussion.title = new_title
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
    search_doc_ids = None
    if intent_result.use_knowledge_base:
        # Determine which documents to search.
        # If the caller passed explicit document_ids, use those.
        # Otherwise, try to narrow by matching query terms against filenames.
        search_doc_ids = request.document_ids if request.document_ids else None
        if not search_doc_ids:
            all_docs = doc_service.list_documents()
            search_doc_ids = _match_documents_by_filename(request.message, all_docs)

        # Over-fetch from Pinecone so keyword post-filtering has enough
        # candidates.  Entity-name queries ("gernot wagner") score low
        # semantically; retrieving more chunks increases the chance the
        # relevant ones appear at all.  The threshold logic below trims
        # the set back down before building context.
        pinecone_top_k = max(research_config.top_k * 3, 20)

        rag_task = asyncio.create_task(
            doc_service.pinecone.search_documents(
                query=request.message,
                top_k=pinecone_top_k,
                document_ids=search_doc_ids,
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

    # Get conversation context (last N messages), sanitized to prevent
    # stale source facts from bleeding into the current RAG turn.
    raw_messages = disc_service.get_context_messages(request.discussion_id, limit=20)
    context_messages = _sanitize_history_messages(raw_messages)

    # Now await the RAG results (if Pinecone was queried)
    context = None
    sources: List[DocumentSource] = []
    pre_filtered = search_doc_ids is not None
    if rag_task is not None:
        try:
            search_results = await rag_task

            # Build query terms for post-filter filename matching
            query_terms = _extract_query_terms(request.message)

            # Deduplicate by document: group chunks, assign ONE citation per document.
            # All chunks still go into context (for AI thoroughness), but share a citation number.
            # The source entry uses the highest score and best chunk from each document.
            doc_groups: dict = {}  # doc_id -> { chunks: [...], best_score, best_chunk_id, best_preview, filename }

            for result in search_results:
                metadata = result.get("metadata")
                score = result.get("score", 0)

                if not metadata:
                    continue

                # Tiered threshold — decides whether to include this chunk:
                # 1. Pre-filtered (filename already matched): accept all
                # 2. ALL query terms found in chunk content: accept (strong
                #    keyword hit — works for entity names like "gernot wagner"
                #    without being tripped by generic topic words like "climate")
                # 3. Query terms found in FILENAME: low threshold (0.20)
                # 4. No keyword hit: standard semantic threshold (0.45)
                if pre_filtered:
                    threshold = 0.0
                else:
                    content_lower = metadata.get("content", "").lower()
                    fname_lower = metadata.get("filename", "").lower()
                    # Require ALL query terms in content for a strong match.
                    # "gernot" + "wagner" both in text → strong signal.
                    # "climate" alone in text → too generic to bypass threshold.
                    content_hit = (
                        len(query_terms) >= 2
                        and all(t in content_lower for t in query_terms)
                    )
                    fname_hit = any(t in fname_lower for t in query_terms)

                    min_score = getattr(research_config, 'min_score', _MIN_SCORE)
                    if content_hit:
                        threshold = 0.0   # all keywords in text → accept
                    elif fname_hit:
                        threshold = 0.20  # keyword in filename → lenient
                    else:
                        threshold = min_score  # per-mode semantic threshold

                if score > threshold:
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

            # Cap to research_config.top_k documents (over-fetch was for
            # casting a wider net; now trim back to the requested depth).
            sorted_groups = sorted(
                doc_groups.items(),
                key=lambda item: item[1]["best_score"],
                reverse=True,
            )[:research_config.top_k]

            # Build context and sources from deduplicated groups
            context_parts = []
            citation_number = 1

            for doc_id, group in sorted_groups:
                combined_content = "\n\n".join(group["chunks"])
                # Strip bracketed reference numbers from source text (e.g. [48], [52])
                # so the AI doesn't confuse them with our [Source N] citation numbers
                combined_content = _CITATION_RE.sub('', combined_content)
                combined_content = re.sub(r'  +', ' ', combined_content).strip()
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
            else:
                # Knowledge base was queried but nothing scored high enough.
                # Tell the AI explicitly so it doesn't fabricate from thin air.
                context = (
                    "[No relevant sources found in the knowledge base for this query.]\n\n"
                    "Guidelines:\n"
                    "- Do NOT fabricate or guess content that might be in the documents\n"
                    "- Let the user know that no matching documents were found\n"
                    "- Suggest they rephrase their question or check which documents are uploaded\n"
                    "- You may still answer from general knowledge, but clearly state you are doing so"
                )
        except asyncio.CancelledError:
            pass  # RAG was cancelled
        except Exception as e:
            logger.warning(f"Pinecone search failed: {e}")
            # If the knowledge base is unavailable (e.g. embedding quota
            # exceeded), abort with a user-facing message instead of
            # silently returning an answer without sources.
            error_msg = (
                "The knowledge base is temporarily unavailable. "
                "Please try again later or contact "
                "openclimatecurriculum@gsb.columbia.edu for assistance."
            )
            async def _error_stream():
                yield f"data: {json.dumps({'type': 'error', 'error': error_msg, 'provider': request.provider})}\n\n"
            return StreamingResponse(
                _error_stream(),
                media_type="text/event-stream",
                headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
            )

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
                count=4
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

        disc_service.add_message(request.discussion_id, assistant_message)

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
            "name": "mistral",
            "display_name": "Mistral",
            "model": settings.mistral_model,
            "configured": bool(settings.mistral_api_key),
        },
        {
            "name": "openai",
            "display_name": "OpenAI",
            "model": settings.openai_model,
            "configured": bool(settings.openai_api_key),
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
