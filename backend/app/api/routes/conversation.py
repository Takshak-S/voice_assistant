
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.conversation import (
    ConversationCreate,
    ConversationListResponse,
    ConversationResponse,
)
from app.services.conversation_service import get_conversation_service

router = APIRouter(prefix="/api/conversation", tags=["conversation"])


@router.post("/new", response_model=ConversationResponse, status_code=status.HTTP_201_CREATED)
def create_conversation(
    conversation_data: ConversationCreate,
    db: Session = Depends(get_db),
):
    service = get_conversation_service(db)
    conversation = service.create_conversation(conversation_data.title)
    return conversation


@router.get("/{conversation_id}", response_model=ConversationResponse)
def get_conversation(
    conversation_id: int,
    db: Session = Depends(get_db),
):
    service = get_conversation_service(db)
    conversation = service.get_conversation(conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation


@router.get("", response_model=list[ConversationListResponse])
def list_conversations(
    limit: int = 20,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    service = get_conversation_service(db)
    conversations = service.get_conversations(limit=limit, offset=offset)
    return [
        ConversationListResponse(
            id=c.id,  # type: ignore[arg-type]
            title=c.title,  # type: ignore[arg-type]
            created_at=c.created_at,  # type: ignore[arg-type]
            updated_at=c.updated_at,  # type: ignore[arg-type]
            message_count=len(c.messages),
        )
        for c in conversations
    ]
