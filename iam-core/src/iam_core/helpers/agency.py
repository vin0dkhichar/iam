"""Shared Keycloak portal clients and agency-admin helpers.

Portal OIDC clients (not the per-agency client):
  - agent-portal  — web UI; holds AGENCY_ADMIN
  - agent-app     — mobile app
  - staff-portal  — staff UI

Per-agency Keycloak client id == agency_id; it holds AGC_ / AGT_ data-policy roles.
"""

from __future__ import annotations

AGENCY_ADMIN_ROLE = "AGENCY_ADMIN"
AGENT_PORTAL_CLIENT = "agent-portal"
AGENT_APP_CLIENT = "agent-app"
STAFF_PORTAL_CLIENT = "staff-portal"

# Backward-compatible alias (was agency-web).
AGENT_WEB_CLIENT = AGENT_PORTAL_CLIENT


def admin_keycloak_clients(agency_id: str, agc_roles: list[str] | None = None) -> list[dict]:
    """agent-portal AGENCY_ADMIN plus inherited AGC_ roles on the agency client."""
    clients: list[dict] = [{"client_id": AGENT_PORTAL_CLIENT, "roles": [AGENCY_ADMIN_ROLE]}]
    inherited = sorted(
        {role.strip() for role in (agc_roles or []) if role and role.strip().startswith("AGC_")}
    )
    # Always include the agency client so Celery can replace Keycloak mappings.
    clients.append({"client_id": agency_id, "roles": inherited})
    return clients


def merge_agency_client_roles(
    existing: list | None,
    agency_id: str,
    roles: list[str],
) -> list[dict]:
    """Set roles on the agency client. Keep agent-portal / AGENCY_ADMIN as it was."""
    agency_roles = sorted(
        {role.strip() for role in roles if role and role.strip() and role.strip() != AGENCY_ADMIN_ROLE}
    )
    clients: list[dict] = []
    for entry in existing or []:
        client_id = entry.get("client_id")
        if client_id == agency_id:
            continue
        if client_id == AGENT_PORTAL_CLIENT:
            web_roles = [role for role in (entry.get("roles") or []) if role]
            if AGENCY_ADMIN_ROLE not in web_roles:
                web_roles.append(AGENCY_ADMIN_ROLE)
            clients.append({"client_id": AGENT_PORTAL_CLIENT, "roles": sorted(set(web_roles))})
            continue
        # Drop legacy agency-web mappings; AGENCY_ADMIN lives on agent-portal only.
        if client_id == "agency-web":
            continue
        clients.append(entry)
    clients.append({"client_id": agency_id, "roles": agency_roles})
    return clients


def with_inherited_agc_roles(roles: list[str] | None, agc_roles: list[str] | None) -> list[str]:
    """Drop stale AGC_ entries and re-apply the current agency AGC_ set."""
    without_agc = [
        role.strip()
        for role in (roles or [])
        if role and role.strip() and not role.strip().startswith("AGC_")
    ]
    inherited = [role.strip() for role in (agc_roles or []) if role and role.strip().startswith("AGC_")]
    return sorted(set(without_agc) | set(inherited))
