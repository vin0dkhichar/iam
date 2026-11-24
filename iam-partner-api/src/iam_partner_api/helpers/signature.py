"""Partner transport auth, following the registry DCI envelope.

The signature is a detached JWS over the raw ``header`` and ``message``.
When signature_validation_enabled is false the check is skipped so a partner
key is not required in tests.
"""

import logging

from fastapi import Request
from openg2p_fastapi_common.crypto import CryptoFactory, get_partner_mgmt_key_store
from openg2p_fastapi_common.errors.http_exceptions import UnauthorizedError

from ..config import Settings

_logger = logging.getLogger(__name__)
_PARTNER_MGMT = frozenset({"partner-mgmt", "partner_mgmt", "partnermgmt"})


def partner_reference_id(sender_id: str) -> str:
    raw = (sender_id or "").strip()
    normalised = raw.replace("-", "_").replace(" ", "_").upper()
    if normalised.startswith("PARTNER_"):
        return normalised
    return f"PARTNER_{normalised}" if normalised else ""


def _crypto_helper():
    """Build verifier from iam_partner_* Settings (not COMMON_*)."""
    settings = Settings.get_config(strict=False)
    backend = (getattr(settings, "crypto_backend", None) or "pyjwt").strip().lower()
    allowed = [
        item.strip()
        for item in (getattr(settings, "crypto_allowed_algorithms", None) or "").split(",")
        if item.strip()
    ]
    kwargs: dict = {}
    if allowed:
        kwargs["allowed_algorithms"] = allowed
    if backend in _PARTNER_MGMT:
        kwargs["partner_key_store"] = get_partner_mgmt_key_store(
            api_url=getattr(settings, "partner_mgmt_api_url", None) or None
        )
    return CryptoFactory.build(backend=backend, **kwargs)


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
    valid = await _crypto_helper().verify_jwt(
        orig_jwt=signature,
        payload={"header": header, "message": message},
        km_app_id=header.get("receiver_id"),
        km_ref_id=partner_reference_id(header.get("sender_id", "")),
    )
    if not valid:
        raise UnauthorizedError(message="Invalid partner signature")
