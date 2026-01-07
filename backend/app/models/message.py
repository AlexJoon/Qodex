from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum
from datetime import datetime
import uuid


class MessageRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class DocumentSource(BaseModel):
    """Source document used in RAG response."""
    id: str
    filename: str
    score: float
    chunk_preview: Optional[str] = None


class MessageBase(BaseModel):
    """Base message model."""
    content: str
    role: MessageRole = MessageRole.USER


class MessageCreate(MessageBase):
    """Model for creating a new message."""
    provider: Optional[str] = None


class Message(MessageBase):
    """Full message model with all fields."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    provider: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    tokens_used: Optional[int] = None
    response_time_ms: Optional[int] = None
    sources: Optional[List[DocumentSource]] = None

    class Config:
        from_attributes = True
