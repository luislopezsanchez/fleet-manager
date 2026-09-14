"""Settings router: system configuration and AI provider management."""
import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.config import settings as app_settings
from app.database import get_db
from app.models import SystemConfig, User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/settings", tags=["settings"])


# ── Schemas ─────────────────────────────────────────────────────────────────
class ConfigItem(BaseModel):
    key: str
    value: str


class ConfigUpdate(BaseModel):
    key: str
    value: str


class AITestRequest(BaseModel):
    provider: str
    api_key: str
    base_url: str


class AITestResponse(BaseModel):
    valid: bool
    models: list[str] = []
    error: str | None = None


class AISaveRequest(BaseModel):
    provider: str
    api_key: str
    model: str
    base_url: str


class AISaveResponse(BaseModel):
    success: bool
    message: str


class AICurrentResponse(BaseModel):
    provider: str
    model: str
    base_url: str
    api_key_masked: str


# ── Helpers ─────────────────────────────────────────────────────────────────
async def _get_config_value(db: AsyncSession, key: str) -> str | None:
    result = await db.execute(select(SystemConfig).where(SystemConfig.key == key))
    row = result.scalar_one_or_none()
    return row.value if row else None


async def _set_config_value(db: AsyncSession, key: str, value: str) -> None:
    result = await db.execute(select(SystemConfig).where(SystemConfig.key == key))
    row = result.scalar_one_or_none()
    if row:
        row.value = value
    else:
        db.add(SystemConfig(key=key, value=value))
    await db.flush()


def _mask_key(key: str) -> str:
    if not key or len(key) <= 4:
        return "****" if key else ""
    return "*" * (len(key) - 4) + key[-4:]


# ── Endpoints ───────────────────────────────────────────────────────────────
@router.get("/", response_model=list[ConfigItem])
async def get_all_settings(
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    """Return all system configuration entries."""
    result = await db.execute(select(SystemConfig).order_by(SystemConfig.key))
    rows = result.scalars().all()
    return [ConfigItem(key=r.key, value=r.value) for r in rows]


@router.put("/", response_model=ConfigItem)
async def update_setting(
    body: ConfigUpdate,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    """Update a single key-value configuration entry."""
    await _set_config_value(db, body.key, body.value)
    return ConfigItem(key=body.key, value=body.value)


@router.post("/ai/test", response_model=AITestResponse)
async def test_ai_provider(
    body: AITestRequest,
    _current_user: User = Depends(get_current_user),
):
    """Test AI provider credentials by calling GET base_url/models."""
    base = body.base_url.rstrip("/")
    url = f"{base}/models"
    headers = {"Authorization": f"Bearer {body.api_key}"}

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url, headers=headers)

        if resp.status_code != 200:
            return AITestResponse(
                valid=False,
                models=[],
                error=f"HTTP {resp.status_code}: {resp.text[:200]}",
            )

        data = resp.json()
        # OpenAI-compatible format: {"data": [{"id": "model-name"}, ...]}
        raw_models = data.get("data", [])
        if isinstance(raw_models, list):
            model_ids = [
                m.get("id") if isinstance(m, dict) else str(m)
                for m in raw_models
                if m
            ]
        else:
            model_ids = []

        return AITestResponse(valid=True, models=model_ids, error=None)

    except httpx.TimeoutException:
        return AITestResponse(valid=False, models=[], error="Request timed out")
    except Exception as exc:
        logger.error("AI provider test failed: %s", exc)
        return AITestResponse(valid=False, models=[], error=str(exc))


@router.post("/ai/save", response_model=AISaveResponse)
async def save_ai_config(
    body: AISaveRequest,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    """Save AI provider configuration to SystemConfig and update runtime settings."""
    await _set_config_value(db, "ai_provider", body.provider)
    await _set_config_value(db, "ai_api_key", body.api_key)
    await _set_config_value(db, "ai_model", body.model)
    await _set_config_value(db, "ai_base_url", body.base_url)

    # Update runtime settings so AIAssistant picks up new values
    app_settings.AI_PROVIDER = body.provider
    app_settings.AI_API_KEY = body.api_key
    app_settings.AI_MODEL = body.model
    app_settings.AI_BASE_URL = body.base_url

    logger.info(
        "AI config saved: provider=%s, model=%s, base_url=%s",
        body.provider, body.model, body.base_url,
    )
    return AISaveResponse(success=True, message="AI configuration saved successfully")


@router.get("/ai/current", response_model=AICurrentResponse)
async def get_current_ai_config(
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    """Return current AI provider configuration with masked API key."""
    provider = await _get_config_value(db, "ai_provider") or app_settings.AI_PROVIDER
    model = await _get_config_value(db, "ai_model") or app_settings.AI_MODEL
    base_url = await _get_config_value(db, "ai_base_url") or app_settings.AI_BASE_URL
    api_key = await _get_config_value(db, "ai_api_key") or app_settings.AI_API_KEY

    return AICurrentResponse(
        provider=provider,
        model=model,
        base_url=base_url,
        api_key_masked=_mask_key(api_key),
    )