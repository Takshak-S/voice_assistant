from typing import Any
from app.core.database import SessionLocal
from app.models.note import Note
from app.schemas.tools import ToolParameter, ToolResult
from app.tools.base import BaseTool


class NotesTool(BaseTool):
    @property
    def name(self) -> str:
        return "manage_notes"

    @property
    def description(self) -> str:
        return "Save, list, or delete notes and reminders for the user."

    @property
    def parameters(self) -> dict[str, ToolParameter]:
        return {
            "action": ToolParameter(
                type="string",
                description="Action to perform: 'save' to save a new note/reminder, 'list' to view all notes, 'delete' to remove a note by ID.",
                enum=["save", "list", "delete"],
            ),
            "content": ToolParameter(
                type="string",
                description="The note text or reminder content (required for 'save').",
            ),
            "title": ToolParameter(
                type="string",
                description="Optional title or category for the note.",
            ),
            "note_id": ToolParameter(
                type="integer",
                description="The ID of the note to delete (required for 'delete').",
            ),
        }

    @property
    def required(self) -> list[str]:
        return ["action"]

    async def execute(self, action: str, content: str | None = None, title: str | None = None, note_id: int | None = None, **kwargs: Any) -> ToolResult:
        db = SessionLocal()
        try:
            if action == "save":
                if not content or not content.strip():
                    return ToolResult(success=False, error="Content is required to save a note.")
                note = Note(
                    title=(title or "Untitled Note").strip(),
                    content=content.strip(),
                )
                db.add(note)
                db.commit()
                db.refresh(note)
                return ToolResult(
                    success=True,
                    result=f"Successfully saved note #{note.id} ('{note.title}'): {note.content}",
                )

            elif action == "list":
                notes = db.query(Note).order_by(Note.created_at.desc()).limit(20).all()
                if not notes:
                    return ToolResult(success=True, result="You currently have no saved notes.")
                formatted = [
                    f"#{n.id} [{n.title}]: {n.content} (Created: {n.created_at.strftime('%Y-%m-%d %H:%M')})"
                    for n in notes
                ]
                return ToolResult(
                    success=True,
                    result=f"Found {len(notes)} note(s):\n" + "\n".join(formatted),
                )

            elif action == "delete":
                if note_id is None:
                    return ToolResult(success=False, error="note_id is required to delete a note.")
                note = db.query(Note).filter(Note.id == note_id).first()
                if not note:
                    return ToolResult(success=False, error=f"Note #{note_id} not found.")
                db.delete(note)
                db.commit()
                return ToolResult(success=True, result=f"Deleted note #{note_id} ('{note.title}').")

            else:
                return ToolResult(success=False, error=f"Unknown action: {action}")
        except Exception as e:
            db.rollback()
            return ToolResult(success=False, error=f"Failed to manage notes: {str(e)}")
        finally:
            db.close()
