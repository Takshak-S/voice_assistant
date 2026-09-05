from sqlalchemy.orm import Session
from sqlalchemy.sql import func

from app.models.conversation import Conversation, Message, MessageRole
from app.schemas.conversation import MessageCreate
from app.schemas.tools import ToolResult
from app.services.llm_service import llm_service
from app.services.tool_service import tool_service


class ConversationService:
    def __init__(self, db: Session):
        self.db = db

    def create_conversation(self, title: str | None = None) -> Conversation:
        conversation = Conversation(title=title)
        self.db.add(conversation)
        self.db.commit()
        self.db.refresh(conversation)

        system_message = Message(
            conversation_id=conversation.id,
            role=MessageRole.system,
            content=llm_service.system_prompt,
        )
        self.db.add(system_message)
        self.db.commit()

        return conversation

    def get_conversation(self, conversation_id: int) -> Conversation | None:
        return self.db.query(Conversation).filter(Conversation.id == conversation_id).first()

    def get_conversations(self, limit: int = 50, offset: int = 0) -> list[Conversation]:
        return (
            self.db.query(Conversation)
            .order_by(Conversation.updated_at.desc())
            .limit(limit)
            .offset(offset)
            .all()
        )

    def add_message(self, conversation_id: int, message: MessageCreate) -> Message:
        db_message = Message(
            conversation_id=conversation_id,
            role=message.role,
            content=message.content,
            tool_name=message.tool_name,
            tool_call_id=message.tool_call_id,
        )
        self.db.add(db_message)

        conversation = self.get_conversation(conversation_id)
        if conversation:
            conversation.updated_at = func.now()  # type: ignore[assignment]

        self.db.commit()
        self.db.refresh(db_message)
        return db_message

    def get_messages(self, conversation_id: int, limit: int = 50) -> list[Message]:
        return (
            self.db.query(Message)
            .filter(Message.conversation_id == conversation_id)
            .order_by(Message.created_at.asc())
            .limit(limit)
            .all()
        )

    def get_messages_for_llm(self, conversation_id: int, max_messages: int = 20) -> list[dict]:
        messages = self.get_messages(conversation_id, limit=max_messages)
        return [
            {
                "role": msg.role.value,
                "content": msg.content,
                **({"tool_call_id": msg.tool_call_id, "name": msg.tool_name} if msg.tool_call_id else {}),
            }
            for msg in messages
        ]

    async def process_user_message(
        self,
        conversation_id: int,
        user_content: str,
    ) -> tuple[str, list[dict]]:
        self.add_message(conversation_id, MessageCreate(role=MessageRole.user, content=user_content))

        messages = self.get_messages_for_llm(conversation_id)
        response = await llm_service.generate(messages)

        tool_results = []
        if response.get("tool_calls"):
            for tool_call in response["tool_calls"]:
                tool_name = tool_call.function.name
                tool_args = tool_call.function.arguments

                import json
                try:
                    args = json.loads(tool_args)
                except json.JSONDecodeError:
                    args = {}

                result: ToolResult = await tool_service.execute(tool_name, **args)

                tool_results.append({
                    "tool_name": tool_name,
                    "args": args,
                    "result": result.result if result.success else None,
                    "error": result.error if not result.success else None,
                })

                tool_content = result.error if not result.success else str(result.result)
                self.add_message(
                    conversation_id,
                    MessageCreate(
                        role=MessageRole.tool,
                        content=tool_content or "",
                        tool_name=tool_name,
                        tool_call_id=tool_call.id,
                    )
                )

                if result.success:
                    messages.append({
                        "role": "tool",
                        "content": str(result.result),
                        "tool_call_id": tool_call.id,
                        "name": tool_name,
                    })
                else:
                    messages.append({
                        "role": "tool",
                        "content": f"Error: {result.error}",
                        "tool_call_id": tool_call.id,
                        "name": tool_name,
                    })

            response = await llm_service.generate(messages)

        assistant_content = response.get("content", "")
        self.add_message(
            conversation_id,
            MessageCreate(role=MessageRole.assistant, content=assistant_content)
        )

        return assistant_content, tool_results

    async def process_user_message_stream(
        self,
        conversation_id: int,
        user_content: str,
    ):
        self.add_message(conversation_id, MessageCreate(role=MessageRole.user, content=user_content))

        messages = self.get_messages_for_llm(conversation_id)

        full_response = ""
        async for chunk in llm_service.stream(messages):
            if chunk.content:
                full_response += chunk.content
            yield chunk.content or "", None

        if full_response:
            self.add_message(
                conversation_id,
                MessageCreate(role=MessageRole.assistant, content=full_response)
            )

    async def process_user_message_stream_with_tools(
        self,
        conversation_id: int,
        user_content: str,
    ):
        """
        Process user message with streaming and tool execution.
        Yields tuples of (content_chunk, tool_results).
        tool_results is None for text chunks, list of tool results when tools executed.
        """
        self.add_message(conversation_id, MessageCreate(role=MessageRole.user, content=user_content))

        messages = self.get_messages_for_llm(conversation_id)

        full_response = ""
        async for content_chunk, tool_results in llm_service.stream_with_tools(messages):
            if content_chunk:
                full_response += content_chunk
            yield content_chunk, tool_results

            # Persist tool results if any
            if tool_results:
                for tool_result in tool_results:
                    tool_name = tool_result["tool_name"]
                    # We need to add the tool message to the conversation
                    # The tool_call_id would come from the tool call, but we don't have it here
                    # This is a simplified version - in practice we'd track tool_call_ids
                    self.add_message(
                        conversation_id,
                        MessageCreate(
                            role=MessageRole.tool,
                            content=str(tool_result.get("result") or tool_result.get("error") or ""),
                            tool_name=tool_name,
                        )
                    )

        if full_response:
            self.add_message(
                conversation_id,
                MessageCreate(role=MessageRole.assistant, content=full_response)
            )


def get_conversation_service(db: Session) -> ConversationService:
    return ConversationService(db)
