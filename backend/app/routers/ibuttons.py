"""iButtons router: bulk CSV upload, batch operations, command log."""
import csv
import io
import logging
import uuid
from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, status
from pydantic import BaseModel
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user, role_required
from app.database import get_db
from app.istarmap_client import IstarmapClient, get_authenticated_istarmap_client
from app.models import CommandLog, CommandStatus, User
from app.schemas import CommandResponse

router = APIRouter(prefix="/ibuttons", tags=["ibuttons"])
logger = logging.getLogger(__name__)

# Command codes
CMD_ADD_IBUTTON = 144
CMD_REMOVE_IBUTTON = 145
CMD_APPROVE = 146


# ── Schemas ─────────────────────────────────────────────────────────────────
class BatchOperation(BaseModel):
    imei: str
    ibutton_id: str
    action: str  # 'add' | 'remove'


class BatchRequest(BaseModel):
    operations: List[BatchOperation]


class UploadResult(BaseModel):
    total_rows: int
    processed: int
    succeeded: int
    failed: int
    commands: List[CommandResponse]


class BatchResult(BaseModel):
    total: int
    succeeded: int
    failed: int
    commands: List[CommandResponse]


# ── Helpers ─────────────────────────────────────────────────────────────────
async def _send_ibutton_command(
    client: IstarmapClient,
    db: AsyncSession,
    user: User,
    imei: str,
    ibutton_id: str,
    command_type: int,
) -> CommandLog:
    """Send an iButton command via istarmap and log it."""
    log = CommandLog(
        user_id=user.id,
        device_imei=imei,
        command_type=command_type,
        ibutton_id=ibutton_id,
        status=CommandStatus.pending,
    )
    db.add(log)
    await db.flush()
    await db.refresh(log)

    try:
        result = await client.send_command(
            imei, command_type, params={"ibuttonId": ibutton_id}
        )
        log.status = CommandStatus.sent
        log.result_data = result
    except Exception as exc:
        log.status = CommandStatus.failed
        log.result_data = {"error": str(exc)}
        logger.warning("iButton command %d for %s failed: %s", command_type, imei, exc)

    await db.flush()
    await db.refresh(log)
    return log


# ── Endpoints ───────────────────────────────────────────────────────────────
@router.post("/upload", response_model=UploadResult)
async def upload_ibuttons_csv(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(role_required("admin")),
    client: IstarmapClient = Depends(get_authenticated_istarmap_client),
):
    """Upload a CSV with columns vehicle_imei, ibutton_id.
    For each row, sends command 144 (add) then 146 (approve) via istarmap.
    Admin-only.
    """
    if not file.filename or not file.filename.endswith((".csv", ".txt")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be a CSV (.csv or .txt)",
        )

    content = await file.read()
    text = content.decode("utf-8-sig")  # handle BOM
    reader = csv.DictReader(io.StringIO(text))

    if not reader.fieldnames or "vehicle_imei" not in reader.fieldnames or "ibutton_id" not in reader.fieldnames:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CSV must have columns: vehicle_imei, ibutton_id",
        )

    commands: List[CommandLog] = []
    succeeded = 0
    failed = 0
    total_rows = 0

    for row in reader:
        imei = (row.get("vehicle_imei") or "").strip()
        ibutton_id = (row.get("ibutton_id") or "").strip()
        if not imei or not ibutton_id:
            continue
        total_rows += 1

        # Send add (144) then approve (146)
        add_log = await _send_ibutton_command(
            client, db, current_user, imei, ibutton_id, CMD_ADD_IBUTTON
        )
        commands.append(add_log)

        if add_log.status == CommandStatus.sent:
            approve_log = await _send_ibutton_command(
                client, db, current_user, imei, ibutton_id, CMD_APPROVE
            )
            commands.append(approve_log)
            if approve_log.status == CommandStatus.sent:
                succeeded += 1
            else:
                failed += 1
        else:
            failed += 1

    return UploadResult(
        total_rows=total_rows,
        processed=total_rows,
        succeeded=succeeded,
        failed=failed,
        commands=[CommandResponse.model_validate(c) for c in commands],
    )


@router.post("/batch", response_model=BatchResult)
async def batch_operations(
    body: BatchRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client: IstarmapClient = Depends(get_authenticated_istarmap_client),
):
    """Execute batch iButton operations.
    action='add' sends command 144, action='remove' sends command 145.
    """
    commands: List[CommandLog] = []
    succeeded = 0
    failed = 0

    for op in body.operations:
        cmd_type = CMD_ADD_IBUTTON if op.action == "add" else CMD_REMOVE_IBUTTON
        log = await _send_ibutton_command(
            client, db, current_user, op.imei, op.ibutton_id, cmd_type
        )
        commands.append(log)
        if log.status == CommandStatus.sent:
            succeeded += 1
        else:
            failed += 1

    return BatchResult(
        total=len(body.operations),
        succeeded=succeeded,
        failed=failed,
        commands=[CommandResponse.model_validate(c) for c in commands],
    )


@router.get("/commands", response_model=dict)
async def list_commands(
    status_filter: str = Query(None, alias="status"),
    limit: int = Query(100, le=500),
    offset: int = Query(0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List command logs with optional status filter."""
    query = select(CommandLog)
    if status_filter:
        try:
            cmd_status = CommandStatus(status_filter)
            query = query.where(CommandLog.status == cmd_status)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status. Must be one of: {', '.join(s.value for s in CommandStatus)}",
            )

    query = query.order_by(desc(CommandLog.created_at)).limit(limit).offset(offset)
    result = await db.execute(query)
    logs = result.scalars().all()

    return {
        "total": len(logs),
        "commands": [CommandResponse.model_validate(c) for c in logs],
    }


@router.get("/commands/{command_id}", response_model=CommandResponse)
async def get_command(
    command_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a single command log by ID."""
    result = await db.execute(select(CommandLog).where(CommandLog.id == command_id))
    log = result.scalar_one_or_none()
    if not log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Command {command_id} not found",
        )
    return CommandResponse.model_validate(log)