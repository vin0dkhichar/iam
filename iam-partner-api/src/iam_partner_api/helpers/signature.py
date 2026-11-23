"""Partner transport auth, following the registry DCI envelope.

The signature is a detached JWS over the raw ``header`` and ``message``.
When signature_validation_enabled is false the check is skipped so a partner
key is not required in tests.
"""

import logging

from fastapi import Request
from openg2p_fastapi_common.crypto import CryptoFactory
from openg2p_fastapi_common.errors.http_exceptions import UnauthorizedError

from ..config import Settings

_logger = logging.getLogger(__name__)


def partner_reference_id(sender_id: str) -> str:
    raw = (sender_id or "").strip()
    normalised = raw.replace("-", "_").replace(" ", "_").upper()
    if normalised.startswith("PARTNER_"):
        return normalised
    return f"PARTNER_{normalised}" if normalised else ""


async def require_partner_signature(request: Request) -> None:
    settings = Settings.get_config(strict=False)
    body = await request.json()
    signature = body.get("signature")
    header = body.get("header") or {}
    message = body.get("message") or {}
    if not settings.signature_validation_enabled:
        _logger.warning("signature_validation_enabled=false — skipping partner signature verification")
        return
    if not signature or not header or not message:
        raise UnauthorizedError(message="Missing partner signature")
    valid = await CryptoFactory.get().verify_jwt(
        orig_jwt=signature,
        payload={"header": header, "message": message},
        km_app_id=header.get("receiver_id"),
        km_ref_id=partner_reference_id(header.get("sender_id", "")),
    )
    if not valid:
        raise UnauthorizedError(message="Invalid partner signature")
