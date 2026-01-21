from fastapi import APIRouter, HTTPException
from typing import List, Dict, Optional
from datetime import datetime
import uuid

from app.models import Discussion, DiscussionCreate, DiscussionUpdate, Message, MessageCreate

router = APIRouter(prefix="/api/discussions", tags=["discussions"])

# In-memory storage (replace with database in production)
_discussions: Dict[str, Discussion] = {}


def _get_discussion(discussion_id: str) -> Discussion:
    """Get discussion or raise 404."""
    discussion = _discussions.get(discussion_id)
    if not discussion:
        raise HTTPException(status_code=404, detail="Discussion not found")
    return discussion


@router.get("", response_model=List[Discussion])
async def list_discussions():
    """List all discussions, sorted by updated_at descending."""
    discussions = list(_discussions.values())
    discussions.sort(key=lambda d: d.updated_at, reverse=True)
    return discussions


@router.post("", response_model=Discussion)
async def create_discussion(data: Optional[DiscussionCreate] = None):
    """Create a new discussion."""
    discussion = Discussion(
        id=str(uuid.uuid4()),
        title=data.title if data else "New Chat",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    _discussions[discussion.id] = discussion
    return discussion


@router.get("/{discussion_id}", response_model=Discussion)
async def get_discussion(discussion_id: str):
    """Get a discussion by ID."""
    return _get_discussion(discussion_id)


@router.put("/{discussion_id}", response_model=Discussion)
async def update_discussion(discussion_id: str, data: DiscussionUpdate):
    """Update a discussion."""
    discussion = _get_discussion(discussion_id)

    if data.title is not None:
        discussion.title = data.title
    if data.is_active is not None:
        # Deactivate all other discussions if setting this one active
        if data.is_active:
            for d in _discussions.values():
                d.is_active = False
        discussion.is_active = data.is_active

    discussion.updated_at = datetime.utcnow()
    return discussion


@router.delete("/{discussion_id}")
async def delete_discussion(discussion_id: str):
    """Delete a discussion."""
    if discussion_id not in _discussions:
        raise HTTPException(status_code=404, detail="Discussion not found")
    del _discussions[discussion_id]
    return {"status": "deleted", "id": discussion_id}


@router.post("/{discussion_id}/messages", response_model=Message)
async def add_message(discussion_id: str, data: MessageCreate):
    """Add a message to a discussion."""
    discussion = _get_discussion(discussion_id)

    message = Message(
        id=str(uuid.uuid4()),
        content=data.content,
        role=data.role,
        provider=data.provider,
        timestamp=datetime.utcnow()
    )

    discussion.add_message(message)

    # Auto-generate title from first user message if still default
    if discussion.title == "New Chat" and data.role.value == "user":
        # Use first 50 chars of message as title
        discussion.title = data.content[:50] + ("..." if len(data.content) > 50 else "")

    return message


@router.post("/{discussion_id}/activate", response_model=Discussion)
async def activate_discussion(discussion_id: str):
    """Set a discussion as active."""
    discussion = _get_discussion(discussion_id)

    # Deactivate all discussions
    for d in _discussions.values():
        d.is_active = False

    # Activate this one
    discussion.is_active = True
    discussion.updated_at = datetime.utcnow()

    return discussion


# Export storage for use in other routers
def get_discussions_storage() -> Dict[str, Discussion]:
    """Get the discussions storage."""
    return _discussions
