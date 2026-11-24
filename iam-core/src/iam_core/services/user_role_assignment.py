"""Assign existing client roles to a user. Staff and agency APIs choose the client and the role names."""

import httpx

from iam_core.helpers.keycloak_admin import KeycloakAdmin, KeycloakAdminError
from iam_core.helpers.keycloak_admin_config import ProvisioningSettings


async def assign_client_roles(
    *,
    realm: str,
    client_id: str,
    keycloak_user_id: str,
    role_names: list[str],
) -> None:
    """Ensure roles exist, then replace the user's client role mappings in Keycloak."""
    settings = ProvisioningSettings()
    admin = KeycloakAdmin(settings)
    names = [name.strip() for name in role_names if name and name.strip()]
    async with httpx.AsyncClient(timeout=30) as client:
        client_uuid = await admin.find_client_uuid(client, realm, client_id)
        if not client_uuid:
            raise KeycloakAdminError(f"Client {client_id} was not found")
        for role_name in names:
            await admin.create_client_role(client, realm, client_uuid, role_name)
        await admin.assign_client_roles_to_user(
            client,
            realm,
            keycloak_user_id,
            client_uuid,
            names,
        )
