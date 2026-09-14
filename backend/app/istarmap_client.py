"""Async client for the Istarmap GPS platform API.

Handles authentication (with AES-128-CBC encrypted password), token caching,
and all device / tracking / report / command endpoints with retry logic.
"""
import base64
import logging
import time
from datetime import datetime, timezone
from typing import Any, Optional

import httpx
from Crypto.Cipher import AES  # pycryptodome — see note below

from app.config import settings

logger = logging.getLogger(__name__)

# ── AES encryption helpers ──────────────────────────────────────────────────
_AES_KEY = b"1234567812345678"  # 16 bytes – AES-128
_AES_IV = b"1234567812345678"   # 16 bytes


def _zero_pad(data: bytes, block_size: int = 16) -> bytes:
    pad_len = block_size - (len(data) % block_size)
    if pad_len == 0:
        pad_len = block_size
    return data + b"\x00" * pad_len


def _aes_encrypt(plaintext: str) -> str:
    """AES-128-CBC with zero-padding, then BASE64 — as required by Istarmap."""
    cipher = AES.new(_AES_KEY, AES.MODE_CBC, _AES_IV)
    padded = _zero_pad(plaintext.encode("utf-8"))
    encrypted = cipher.encrypt(padded)
    return base64.b64encode(encrypted).decode("ascii")


# ── Istarmap client ────────────────────────────────────────────────────────
class IstarmapError(Exception):
    """Raised when the Istarmap API returns an unrecoverable error."""

    def __init__(self, message: str, status_code: int = 0, detail: Any = None):
        super().__init__(message)
        self.status_code = status_code
        self.detail = detail


class IstarmapClient:
    """Async client with in-memory token caching and automatic retry."""

    def __init__(
        self,
        base_url: str = settings.ISTARMAP_BASE_URL,
        client_id: str = settings.ISTARMAP_CLIENT_ID,
        client_secret: str = settings.ISTARMAP_CLIENT_SECRET,
        timeout: float = 30.0,
        max_retries: int = 3,
    ):
        self.base_url = base_url.rstrip("/")
        self.client_id = client_id
        self.client_secret = client_secret
        self.timeout = timeout
        self.max_retries = max_retries

        # Token cache
        self._token: Optional[str] = None
        self._token_expires_at: float = 0.0

        # We create the httpx client lazily so it lives within the event loop
        self._client: Optional[httpx.AsyncClient] = None

    # ── httpx lifecycle ────────────────────────────────────────────────────
    async def _ensure_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                timeout=httpx.Timeout(self.timeout),
                headers={"Accept": "application/json"},
            )
        return self._client

    async def close(self) -> None:
        if self._client and not self._client.is_closed:
            await self._client.aclose()

    # ── Auth ───────────────────────────────────────────────────────────────
    async def login(self, username: str, password: str) -> str:
        """Authenticate with Istarmap and cache the bearer token."""
        encrypted_password = _aes_encrypt(password)

        params = {
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "grant_type": "password",
        }
        data = {
            "username": username,
            "password": encrypted_password,
        }

        client = await self._ensure_client()
        resp = await self._request_with_retry(
            client, "POST", "/auth/oauth/token", params=params, data=data
        )
        body = resp.json()

        token = body.get("access_token") or body.get("token") or body.get("token_type", {}).get("token")
        if not token:
            raise IstarmapError("Login succeeded but no token in response", detail=body)

        expires_in = body.get("expires_in", 7200)  # default 2h
        self._token = token
        self._token_expires_at = time.time() + expires_in - 60  # refresh 60s early
        logger.info("Istarmap login OK, token expires in %ss", expires_in)
        return token

    async def _ensure_token(self, username: Optional[str] = None, password: Optional[str] = None) -> str:
        if self._token and time.time() < self._token_expires_at:
            return self._token
        if username and password:
            return await self.login(username, password)
        if self._token:
            # Token expired — caller must re-login
            raise IstarmapError("Istarmap token expired and no credentials provided for re-login")
        raise IstarmapError("Not authenticated with Istarmap — call login() first")

    # ── Core request with retry ────────────────────────────────────────────
    async def _request_with_retry(
        self,
        client: httpx.AsyncClient,
        method: str,
        url: str,
        *,
        params: Optional[dict] = None,
        json: Optional[dict] = None,
        data: Optional[dict] = None,
        headers: Optional[dict] = None,
    ) -> httpx.Response:
        last_exc: Optional[Exception] = None
        for attempt in range(1, self.max_retries + 1):
            try:
                resp = await client.request(
                    method,
                    url,
                    params=params,
                    json=json,
                    data=data,
                    headers=headers,
                )
                if resp.status_code == 401:
                    # Token might have expired — invalidate cache
                    self._token = None
                    raise IstarmapError("Unauthorized (401) — token expired", status_code=401)
                if resp.status_code >= 500:
                    raise IstarmapError(
                        f"Server error {resp.status_code}", status_code=resp.status_code
                    )
                resp.raise_for_status()
                return resp
            except IstarmapError:
                raise
            except (httpx.HTTPStatusError, httpx.HTTPError) as exc:
                last_exc = exc
                wait = min(2**attempt, 10)
                logger.warning("Istarmap request attempt %d/%d failed: %s — retrying in %ss",
                               attempt, self.max_retries, exc, wait)
                # httpx doesn't have async sleep; use asyncio
                import asyncio
                await asyncio.sleep(wait)

        raise IstarmapError(f"Max retries ({self.max_retries}) exceeded", detail=str(last_exc))

    async def _authed_request(
        self,
        method: str,
        url: str,
        *,
        params: Optional[dict] = None,
        json: Optional[dict] = None,
        username: Optional[str] = None,
        password: Optional[str] = None,
    ) -> dict:
        """Make a request with the cached bearer token."""
        token = await self._ensure_token(username, password)
        client = await self._ensure_client()
        headers = {"Authorization": f"Bearer {token}"}
        resp = await self._request_with_retry(
            client, method, url, params=params, json=json, headers=headers
        )
        return resp.json()

    # ── Devices ────────────────────────────────────────────────────────────
    async def get_devices(self, org_id: int) -> list[dict]:
        """GET /dpms/device/all?orgId=X — list all devices for an org."""
        result = await self._authed_request("GET", "/dpms/device/all", params={"orgId": org_id})
        if isinstance(result, list):
            return result
        return result.get("data", result.get("devices", []))

    async def get_group_devices(self, org_id: int) -> list[dict]:
        """GET /tapi/group/device?orgId=X — devices grouped by category."""
        result = await self._authed_request("GET", "/tapi/group/device", params={"orgId": org_id})
        if isinstance(result, list):
            return result
        return result.get("data", [])

    # ── Tracking ───────────────────────────────────────────────────────────
    async def track_devices(
        self,
        org_id: int,
        last_query_time: Optional[str] = None,
    ) -> dict:
        """POST /tapi/tracker — live tracking positions.

        Returns ``{"data": [...positions...], "lastQueryTime": "..."}``
        """
        body: dict[str, Any] = {
            "orgId": org_id,
            "lastQueryTime": last_query_time,
            "historyFlag": False,
        }
        result = await self._authed_request("POST", "/tapi/tracker", json=body)
        return result

    async def get_history(
        self,
        imei: str,
        start_time: str,
        end_time: str,
        filter_drift: bool = True,
    ) -> list[dict]:
        """GET /tapi/tracker/history/{imei} — historical GPS track (playback)."""
        params: dict[str, Any] = {
            "startTime": start_time,
            "endTime": end_time,
            "filterDrift": filter_drift,
        }
        result = await self._authed_request(
            "GET", f"/tapi/tracker/history/{imei}", params=params
        )
        if isinstance(result, list):
            return result
        return result.get("data", [])

    # ── Reports ────────────────────────────────────────────────────────────
    async def get_report_working(
        self,
        org_id: int,
        start_time: str,
        end_time: str,
    ) -> dict:
        """GET /tapi/report/working — operations overview."""
        params = {"orgId": org_id, "startTime": start_time, "endTime": end_time}
        return await self._authed_request("GET", "/tapi/report/working", params=params)

    async def get_report_day_running(
        self,
        vid: int,
        start_time: str,
        end_time: str,
    ) -> dict:
        """GET /tapi/report/day_running — daily mileage per vehicle."""
        params = {"vid": vid, "startTime": start_time, "endTime": end_time}
        return await self._authed_request("GET", "/tapi/report/day_running", params=params)

    async def get_report_warn_detail(
        self,
        vid: int,
        start_time: str,
        end_time: str,
        warn_ids: Optional[list[int]] = None,
    ) -> dict:
        """GET /tapi/report/warn_detail — alarm/warning detail."""
        params: dict[str, Any] = {
            "vid": vid,
            "startTime": start_time,
            "endTime": end_time,
        }
        if warn_ids:
            params["warnIds"] = ",".join(str(w) for w in warn_ids)
        return await self._authed_request("GET", "/tapi/report/warn_detail", params=params)

    async def get_report_over_speed(
        self,
        vid: int,
        start_time: str,
        end_time: str,
    ) -> dict:
        """GET /tapi/report/over_speed_detail — speeding incidents."""
        params = {"vid": vid, "startTime": start_time, "endTime": end_time}
        return await self._authed_request("GET", "/tapi/report/over_speed_detail", params=params)

    # ── Commands ───────────────────────────────────────────────────────────
    async def send_command(
        self,
        imei: str,
        command: int,
        params: Optional[dict] = None,
    ) -> dict:
        """POST a command to a device (command_type 144/145/146)."""
        body: dict[str, Any] = {
            "imei": imei,
            "command": command,
        }
        if params:
            body["params"] = params
        return await self._authed_request("POST", "/tapi/command/send", json=body)

    async def term_ctrl(
        self,
        imei: str,
        ctrl_type: str,
    ) -> dict:
        """POST /tapi/command/{termId}/termCtrl — terminal control.

        ctrl_type: "OIL_ELE_CUT" (cut fuel/electricity) | "OIL_ELE_RECOVER" (restore).
        Returns {"code":0, "data": {"requestId": "...", "result": "SUCCESS|OFF_LINE|FAIL"}}.
        """
        if ctrl_type not in ("OIL_ELE_CUT", "OIL_ELE_RECOVER"):
            raise ValueError(f"Invalid ctrl_type: {ctrl_type}")
        return await self._authed_request(
            "POST",
            f"/tapi/command/{imei}/termCtrl",
            json={"ctrlType": ctrl_type},
        )

    async def get_command_result(
        self,
        imei: str,
        request_id: str,
    ) -> dict:
        """GET /tapi/command/{termId}/trackerSndResult — command delivery status."""
        result = await self._authed_request(
            "GET", f"/tapi/command/{imei}/trackerSndResult",
            params={"requestId": request_id},
        )
        return result


# ── Module-level singleton convenience ─────────────────────────────────────
_istarmap_client: Optional[IstarmapClient] = None


def get_istarmap_client() -> IstarmapClient:
    global _istarmap_client
    if _istarmap_client is None:
        _istarmap_client = IstarmapClient(
            base_url=settings.ISTARMAP_BASE_URL,
            client_id=settings.ISTARMAP_CLIENT_ID,
            client_secret=settings.ISTARMAP_CLIENT_SECRET,
        )
    return _istarmap_client


async def get_authenticated_istarmap_client() -> IstarmapClient:
    """Dependency that returns a logged-in IstarmapClient."""
    client = get_istarmap_client()
    if not client._token or time.time() >= client._token_expires_at:
        username = settings.ISTARMAP_USERNAME if hasattr(settings, 'ISTARMAP_USERNAME') else None
        password = settings.ISTARMAP_PASSWORD if hasattr(settings, 'ISTARMAP_PASSWORD') else None
        if username and password:
            await client.login(username, password)
    return client