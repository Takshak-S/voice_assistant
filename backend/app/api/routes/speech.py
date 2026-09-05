from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.services.tts_service import tts_service

router = APIRouter(prefix="/api/speech", tags=["speech"])


class SpeechRequest(BaseModel):
    text: str
    voice: str | None = None


@router.post("", response_class=StreamingResponse)
async def generate_speech(request: SpeechRequest):
    if not request.text or not request.text.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Text is required",
        )

    try:
        audio_data = await tts_service.synthesize(request.text)
        return StreamingResponse(
            iter([audio_data]),
            media_type="audio/mpeg",
            headers={"Content-Disposition": "attachment; filename=speech.mp3"},
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Speech generation failed: {str(e)}",
        ) from e
