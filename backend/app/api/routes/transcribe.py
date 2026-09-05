from typing import Optional
from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status

from app.services.stt_service import stt_service

router = APIRouter(prefix="/api/transcribe", tags=["transcribe"])


@router.post("")
async def transcribe_audio(
    file: UploadFile = File(...),
    language: Optional[str] = Form(None),
):
    content_type = file.content_type or ""
    filename = (file.filename or "").lower()
    
    is_valid_audio = (
        content_type.startswith("audio/")
        or content_type in ["video/webm", "application/octet-stream"]
        or any(filename.endswith(ext) for ext in [".webm", ".wav", ".mp3", ".ogg", ".m4a", ".flac"])
    )

    if not is_valid_audio:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be an audio file",
        )

    try:
        transcript = await stt_service.transcribe(
            file.file,
            filename=file.filename or "audio.webm",
            language=language,
        )
        return {"text": transcript}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Transcription failed: {str(e)}",
        ) from e

