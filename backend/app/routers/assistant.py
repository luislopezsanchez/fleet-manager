"""Assistant router: conversational AI chat endpoints."""
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.istarmap_client import IstarmapClient, get_authenticated_istarmap_client
from app.models import User
from app.services.ai_assistant import (
    get_ai_assistant,
    get_history as get_conversation_history,
    save_conversation,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/assistant", tags=["assistant"])


# ── Schemas ───────────────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    response: str
    actions: list = []
    data: object = None


class HistoryItem(BaseModel):
    role: str
    content: str
    timestamp: str
    actions: list = []
    data: object = None


class HistoryResponse(BaseModel):
    total: int
    conversations: list[HistoryItem]


# ── Endpoints ─────────────────────────────────────────────────────────────
@router.post("/chat", response_model=ChatResponse)
async def chat(
    body: ChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    istarmap_client: IstarmapClient = Depends(get_authenticated_istarmap_client),
):
    """Send a message to the AI assistant and get a response."""
    if not body.message.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El mensaje no puede estar vacío",
        )

    # Save user message
    save_conversation(str(current_user.id), "user", body.message)

    assistant = await get_ai_assistant(db)
    try:
        from app.config import settings
        result = await assistant.chat(
            user_message=body.message,
            db=db,
            istarmap_client=istarmap_client,
            org_id=settings.ISTARMAP_ORG_ID,
        )
    except Exception as exc:
        logger.exception("Assistant chat failed: %s", exc)
        result = {
            "response": f"Error: {exc}",
            "actions": [],
            "data": None,
        }

    # Save assistant response
    save_conversation(
        str(current_user.id),
        "assistant",
        result["response"],
        actions=result.get("actions", []),
        data=result.get("data"),
    )

    return ChatResponse(
        response=result["response"],
        actions=result.get("actions", []),
        data=result.get("data"),
    )


@router.get("/history", response_model=HistoryResponse)
async def history(
    current_user: User = Depends(get_current_user),
):
    """Return the last 20 conversation entries for the current user."""
    convs = get_conversation_history(str(current_user.id), limit=20)
    return HistoryResponse(
        total=len(convs),
        conversations=[HistoryItem(**c) for c in convs],
    )