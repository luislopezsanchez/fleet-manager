"""FastAPI application entrypoint."""
import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import Base, engine, async_session_factory
from app.istarmap_client import get_istarmap_client
from app.routers import alerts, assistant, auth, devices, ibuttons, reports, sectors, users
from app.routers import settings as settings_router
from app.services.alerts_engine import run_all_alerts

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Background scheduler task handle
_alerts_task: asyncio.Task | None = None


async def _alerts_scheduler_loop():
    """Run ``run_all_alerts`` every hour for the configured org."""
    org_id = settings.ISTARMAP_ORG_ID
    if not org_id:
        logger.warning("Alerts scheduler disabled: ISTARMAP_ORG_ID not configured")
        return

    client = get_istarmap_client()
    # Ensure the client is authenticated if credentials are available
    username = settings.ISTARMAP_USERNAME or None
    password = settings.ISTARMAP_PASSWORD or None
    if username and password:
        try:
            await client.login(username, password)
        except Exception as exc:
            logger.error("Alerts scheduler: istarmap login failed: %s", exc)
            return

    logger.info("Alerts scheduler started — org_id=%s, interval=3600s", org_id)

    while True:
        try:
            async with async_session_factory() as session:
                try:
                    created = await run_all_alerts(session, client, org_id)
                    if created:
                        logger.info("Alerts scheduler: %d new alerts", len(created))
                    await session.commit()
                except Exception:
                    await session.rollback()
                    raise
        except Exception as exc:
            logger.error("Alerts scheduler iteration failed: %s", exc)

        await asyncio.sleep(3600)  # 1 hour


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: create tables, start alerts scheduler. Shutdown: cancel scheduler, dispose engine."""
    global _alerts_task

    logger.info("Creating database tables (if not exist) …")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables ready.")

    # Start background alerts scheduler
    _alerts_task = asyncio.create_task(_alerts_scheduler_loop())

    yield

    # Cancel scheduler
    if _alerts_task is not None:
        _alerts_task.cancel()
        try:
            await _alerts_task
        except asyncio.CancelledError:
            pass
        _alerts_task = None
    logger.info("Alerts scheduler cancelled.")

    logger.info("Disposing engine …")
    await engine.dispose()


app = FastAPI(
    title="Fleet Manager API",
    description="Sistema de Gestión y Monitoreo de Flota Vehicular",
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS ───────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers under /api/v1 ──────────────────────────────────────────────────
api_prefix = "/api/v1"
app.include_router(auth.router, prefix=api_prefix)
app.include_router(devices.router, prefix=api_prefix)
app.include_router(sectors.router, prefix=api_prefix)
app.include_router(users.router, prefix=api_prefix)
app.include_router(alerts.router, prefix=api_prefix)
app.include_router(reports.router, prefix=api_prefix)
app.include_router(ibuttons.router, prefix=api_prefix)
app.include_router(assistant.router, prefix=api_prefix)
app.include_router(settings_router.router, prefix=api_prefix)


# ── Health ─────────────────────────────────────────────────────────────────
@app.get("/health", tags=["health"])
async def health():
    return {"status": "ok"}


# ── Root ───────────────────────────────────────────────────────────────────
@app.get("/", tags=["root"])
async def root():
    return {
        "name": "Fleet Manager API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health",
    }