"""Shared Keycloak names for an agency admin."""

AGENCY_ADMIN_ROLE = "AGENCY_ADMIN"
AGENT_WEB_CLIENT = "agency-web"


def merge_agency_client_roles(
    existing: list | None,
    agency_id: str,
    roles: list[str],
) -> list[dict]:
    """Set roles on the agency client. Keep agency-web / AGENCY_ADMIN as it was."""
    agency_roles = sorted(
        {role.strip() for role in roles if role and role.strip() and role.strip() != AGENCY_ADMIN_ROLE}
    )
    clients: list[dict] = []
    for entry in existing or []:
        client_id = entry.get("client_id")
        if client_id == agency_id:
            continue
        if client_id == AGENT_WEB_CLIENT:
            web_roles = [role for role in (entry.get("roles") or []) if role]
            if AGENCY_ADMIN_ROLE not in web_roles:
                web_roles.append(AGENCY_ADMIN_ROLE)
            clients.append({"client_id": AGENT_WEB_CLIENT, "roles": sorted(set(web_roles))})
            continue
        clients.append(entry)
    clients.append({"client_id": agency_id, "roles": agency_roles})
    return clients
