import pytest
from app.services.conversation_service import get_conversation_service
from app.schemas.conversation import MessageCreate
from app.models.conversation import MessageRole


@pytest.mark.asyncio
async def test_conversation_summarization(db_session):
    service = get_conversation_service(db_session)
    conv = service.create_conversation()

    # Add messages
    service.add_message(conv.id, MessageCreate(role=MessageRole.user, content="What is quantum computing?"))
    service.add_message(conv.id, MessageCreate(role=MessageRole.assistant, content="Quantum computing uses qubits and superposition to process information."))

    summary = await service.summarize_conversation(conv.id)
    assert "summary" in summary
    assert summary["message_count"] == 2
