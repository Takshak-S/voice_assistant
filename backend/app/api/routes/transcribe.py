from fastapi import APIRouter, File, HTTPException, UploadFile, status

from app.services.stt_service import stt_service

router = APIRouter(prefix="/api/transcribe", tags=["transcribe"])


@router.post("", response_model=str)
async def transcribe_audio(
    file: UploadFile = File(...),
):
    if not file.content_type or not file.content_type.startswith("audio/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be an audio file",
        )

    try:
        transcript = await stt_service.transcribe(file.file, file.filename or "audio.webm")
        return transcript
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Transcription failed: {str(e)}",
        ) from e
