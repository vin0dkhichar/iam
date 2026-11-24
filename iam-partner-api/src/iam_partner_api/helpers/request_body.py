"""Read partner request payloads as flat JSON or a DCI {header, message, signature} envelope."""

from fastapi import Request
from openg2p_fastapi_common.errors.http_exceptions import BadRequestError
from pydantic import BaseModel, ValidationError


async def partner_payload(request: Request, model: type[BaseModel]) -> BaseModel:
    raw = await request.json()
    if not isinstance(raw, dict):
        raise BadRequestError(message="Request body must be a JSON object")
    data = raw
    message = raw.get("message")
    if isinstance(message, dict) and any(key in message for key in model.model_fields):
        data = message
    try:
        return model.model_validate(data)
    except ValidationError as exc:
        raise BadRequestError(message=str(exc)) from exc
