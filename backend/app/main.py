"""FastAPI application entrypoint."""
import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import Base, engine, async_session_factory
from app.istarmap_client import get_istarmap_client
from app.routers import alerts, assistant, auth, devices, drivers, geofences, ibuttons, reports, sectors, users
from app.routers import settings as settings_router
from app.routers.devices import sync_devices_into_db
from app.services.alerts_engine import run_all_alerts

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Background scheduler task handles
_alerts_task: asyncio.Task | None = None
_sync_task: asyncio.Task | None = None

DEVICE_SYNC_INTERVAL = 3600  # 1 hour


async def _istarmap_login_or_none():
    """Login to istarmap if credentials are configured. Returns client or None."""
    client = get_istarmap_client()
    username = settings.ISTARMAP_USERNAME or None
    password = settings.ISTARMAP_PASSWORD or None
    if username and password:
        try:
            await client.login(username, password)
            return client
        except Exception as exc:
            logger.error("istarmap login failed: %s", exc)
    return None


async def _sync_devices_once(client) -> int:
    """One device-cache sync pass. Returns synced count (0 on failure)."""
    org_id = settings.ISTARMAP_ORG_ID
    if not org_id:
        return 0
    try:
        async with async_session_factory() as session:
            try:
                synced = await sync_devices_into_db(session, client, int(org_id))
                await session.commit()
                logger.info("Device sync: %d devices upserted into device_cache", synced)
                return synced
            except Exception:
                await session.rollback()
                raise
    except Exception as exc:
        logger.error("Device sync failed: %s", exc)
        return 0


async def _device_sync_loop():
    """Keep device_cache in sync with istarmap every hour."""
    client = await _istarmap_login_or_none()
    if client is None:
        logger.warning("Device sync disabled: istarmap credentials not configured")
        return
    logger.info("Device sync scheduler started — interval=%ds", DEVICE_SYNC_INTERVAL)
    while True:
        await _sync_devices_once(client)
        await asyncio.sleep(DEVICE_SYNC_INTERVAL)


async def _alerts_scheduler_loop():
    """Run ``run_all_alerts`` every hour for the configured org."""
    org_id = settings.ISTARMAP_ORG_ID
    if not org_id:
        logger.warning("Alerts scheduler disabled: ISTARMAP_ORG_ID not configured")
        return

    client = await _istarmap_login_or_none()
    if client is None:
        logger.warning("Alerts scheduler disabled: istarmap login failed")
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
    """Startup: create tables, initial device sync, start schedulers. Shutdown: cancel them."""
    global _alerts_task, _sync_task

    logger.info("Creating database tables (if not exist) …")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables ready.")

    # Initial device sync (fills device_cache so KPIs/lists work from the start)
    client = await _istarmap_login_or_none()
    if client is not None:
        await _sync_devices_once(client)

    # Start background schedulers
    _sync_task = asyncio.create_task(_device_sync_loop())
    _alerts_task = asyncio.create_task(_alerts_scheduler_loop())

    yield

    # Cancel schedulers
    for task in (_alerts_task, _sync_task):
        if task is not None:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
    _alerts_task = None
    _sync_task = None
    logger.info("Schedulers cancelled.")

    logger.info("Disposing engine …")
    await engine.dispose()


app = FastAPI(
    title="Fleet Manager API",
    description="Sistema de Gestión y Monitoreo de Flota Vehicular",
    version="1.1.0",
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
app.include_router(geofences.router, prefix=api_prefix)
app.include_router(drivers.router, prefix=api_prefix)
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
        "version": "1.1.0",
        "docs": "/docs",
        "health": "/health",
    }