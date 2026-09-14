"""Reports router: proxy to istarmap report endpoints."""
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.auth import get_current_user
from app.istarmap_client import IstarmapClient, get_authenticated_istarmap_client
from app.models import User

router = APIRouter(prefix="/reports", tags=["reports"])
logger = logging.getLogger(__name__)


@router.get("/working")
async def report_working(
    org_id: int = Query(..., description="Organization ID"),
    start_time: str = Query(..., description="Start time yyyy-MM-ddTHH:mm:ssZ"),
    end_time: str = Query(..., description="End time yyyy-MM-ddTHH:mm:ssZ"),
    current_user: User = Depends(get_current_user),
    client: IstarmapClient = Depends(get_authenticated_istarmap_client),
):
    """Operations overview — proxy to istarmap /tapi/report/working."""
    try:
        result = await client.get_report_working(org_id, start_time, end_time)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Istarmap report failed: {exc}",
        )
    return result


@router.get("/mileage")
async def report_mileage(
    vid: int = Query(..., description="Vehicle ID"),
    start_time: str = Query(..., description="Start time yyyy-MM-ddTHH:mm:ssZ"),
    end_time: str = Query(..., description="End time yyyy-MM-ddTHH:mm:ssZ"),
    current_user: User = Depends(get_current_user),
    client: IstarmapClient = Depends(get_authenticated_istarmap_client),
):
    """Mileage per vehicle.

    NOTE: istarmap /tapi/report/day_running is broken (returns 'Please select
    a device' regardless of vid). We use /tapi/report/working (which works) as
    the data source and filter for the requested vid.
    """
    try:
        # working needs orgId; we derive it from settings
        from app.config import settings
        result = await client.get_report_working(settings.ISTARMAP_ORG_ID, start_time, end_time)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Istarmap report failed: {exc}",
        )

    # Extract workingDeviceInfos and filter for the requested vid
    data = result.get("data") if isinstance(result, dict) else None
    if data is None:
        return {"code": 1, "msg": "Query in progress, try again later", "data": None}

    infos = data.get("workingDeviceInfos", []) if isinstance(data, dict) else []
    matching = [d for d in infos if d.get("vid") == vid]
    return {
        "code": 0,
        "msg": "",
        "data": matching,
        "total": len(matching),
    }


@router.get("/alarms")
async def report_alarms(
    vid: int = Query(..., description="Vehicle ID"),
    start_time: str = Query(..., description="Start time yyyy-MM-ddTHH:mm:ssZ"),
    end_time: str = Query(..., description="End time yyyy-MM-ddTHH:mm:ssZ"),
    warn_ids: str = Query("", description="Comma-separated warn IDs, e.g. 1025,1026"),
    current_user: User = Depends(get_current_user),
    client: IstarmapClient = Depends(get_authenticated_istarmap_client),
):
    """Alarm/warning detail — proxy to istarmap /tapi/report/warn_detail."""
    parsed_warn_ids: list[int] | None = None
    if warn_ids:
        try:
            parsed_warn_ids = [int(x.strip()) for x in warn_ids.split(",") if x.strip()]
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="warn_ids must be comma-separated integers",
            )
    try:
        result = await client.get_report_warn_detail(vid, start_time, end_time, parsed_warn_ids)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Istarmap report failed: {exc}",
        )
    return result


@router.get("/overspeed")
async def report_overspeed(
    vid: int = Query(..., description="Vehicle ID"),
    start_time: str = Query(..., description="Start time yyyy-MM-ddTHH:mm:ssZ"),
    end_time: str = Query(..., description="End time yyyy-MM-ddTHH:mm:ssZ"),
    current_user: User = Depends(get_current_user),
    client: IstarmapClient = Depends(get_authenticated_istarmap_client),
):
    """Speeding incidents.

    NOTE: istarmap /tapi/report/over_speed_detail is broken (returns 'Please
    select a device'). We derive overspeed count from /tapi/report/working
    (which works) and return the overSpeedNum for the requested vid.
    """
    from app.config import settings
    try:
        result = await client.get_report_working(settings.ISTARMAP_ORG_ID, start_time, end_time)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Istarmap report failed: {exc}",
        )

    data = result.get("data") if isinstance(result, dict) else None
    if data is None:
        return {"code": 1, "msg": "Query in progress, try again later", "data": None}

    infos = data.get("workingDeviceInfos", []) if isinstance(data, dict) else []
    matching = [d for d in infos if d.get("vid") == vid]
    return {
        "code": 0,
        "msg": "",
        "data": matching,
        "total": len(matching),
    }


@router.get("/history")
async def report_history(
    imei: str = Query(..., description="Device IMEI"),
    start_time: str = Query(..., description="Start time yyyy-MM-ddTHH:mm:ssZ"),
    end_time: str = Query(..., description="End time yyyy-MM-ddTHH:mm:ssZ"),
    current_user: User = Depends(get_current_user),
    client: IstarmapClient = Depends(get_authenticated_istarmap_client),
):
    """Historical GPS track — proxy to istarmap /tapi/tracker/history/{imei}."""
    try:
        result = await client.get_history(imei, start_time, end_time)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Istarmap history failed: {exc}",
        )
    return result