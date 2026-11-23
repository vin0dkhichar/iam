"""Keycloak names for an agency. The agency itself is an Application row."""

AGENCY_ADMIN_ROLE = "AGENCY_ADMIN"
AGENT_WEB_CLIENT = "agent-web"
AGENT_APP_SUFFIX = "-agent-app"


def app_client_id(agency_id: str) -> str:
    return f"{agency_id}{AGENT_APP_SUFFIX}"
