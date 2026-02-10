"""API route definitions."""

from .chat import router as chat_router
from .discussions import router as discussions_router
from .documents import router as documents_router
from .attachments import router as attachments_router

__all__ = ["chat_router", "discussions_router", "documents_router", "attachments_router"]
