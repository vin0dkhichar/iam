"""Shared Keycloak portal clients and agency-admin helpers.

Portal OIDC clients:
  - agent-portal  — agent UI login; holds AGENCY_ADMIN
  - agent-app     — holds AGC_ / AGT_ data-policy roles for every agency
  - staff-portal  — staff UI

Agency rows still use application_mnemonic as the Keycloak group name. IAM keeps
which agency a policy belongs to; Keycloak roles for those policies live on
agent-app (mnemonic includes the agency id for uniqueness).
"""

from __future__ import annotations

AGENCY_ADMIN_ROLE = "AGENCY_ADMIN"
AGENT_PORTAL_CLIENT = "agent-portal"
AGENT_APP_CLIENT = "agent-app"
STAFF_PORTAL_CLIENT = "staff-portal"

# Backward-compatible alias (was agency-web).
AGENT_WEB_CLIENT = AGENT_PORTAL_CLIENT


def admin_keycloak_clients(agency_id: str, agc_roles: list[str] | None = None) -> list[dict]:
    """agent-portal AGENCY_ADMIN plus inherited AGC_ roles on agent-app.

    ``agency_id`` is kept for callers; AGC_/AGT_ Keycloak roles live on agent-app
    (mnemonics already include the agency id for uniqueness).
    """
    _ = agency_id
    clients: list[dict] = [{"client_id": AGENT_PORTAL_CLIENT, "roles": [AGENCY_ADMIN_ROLE]}]
    inherited = sorted(
        {role.strip() for role in (agc_roles or []) if role and role.strip().startswith("AGC_")}
    )
    clients.append({"client_id": AGENT_APP_CLIENT, "roles": inherited})
    return clients


def merge_agency_client_roles(
    existing: list | None,
    agency_id: str,
    roles: list[str],
) -> list[dict]:
    """Set AGC_/AGT_ roles on agent-app. Keep agent-portal / AGENCY_ADMIN as it was.

    Legacy per-agency client role entries are dropped so Keycloak mappings stay
    on agent-app only.
    """
    policy_roles = sorted(
        {
            role.strip()
            for role in roles
            if role
            and role.strip()
            and role.strip() != AGENCY_ADMIN_ROLE
            and (role.strip().startswith("AGC_") or role.strip().startswith("AGT_"))
        }
    )
    # Non-policy roles that used to live on the agency client are ignored;
    # agent UI no longer assigns arbitrary Keycloak roles per agency.
    clients: list[dict] = []
    for entry in existing or []:
        client_id = entry.get("client_id")
        if client_id in {agency_id, AGENT_APP_CLIENT, "agency-web"}:
            continue
        if client_id == AGENT_PORTAL_CLIENT:
            web_roles = [role for role in (entry.get("roles") or []) if role]
            if AGENCY_ADMIN_ROLE not in web_roles:
                web_roles.append(AGENCY_ADMIN_ROLE)
            clients.append({"client_id": AGENT_PORTAL_CLIENT, "roles": sorted(set(web_roles))})
            continue
        clients.append(entry)
    clients.append({"client_id": AGENT_APP_CLIENT, "roles": policy_roles})
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
