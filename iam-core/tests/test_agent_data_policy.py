from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from iam_core.schemas.data_policy import AddPolicyRequestPayload, DataPolicyType, PolicyTarget
from iam_core.user_auth.helpers.data_policy_role_helper import (
    AGC_ROLE_PREFIX,
    AGT_ROLE_PREFIX,
    agency_scoped_policy_mnemonic,
    get_data_policy_mnemonics,
)
from iam_core.user_auth.middleware.data_policy import DataPolicyMiddleware, select_policy_clients


def test_agency_prefix_keeps_agc_roles_grouped_by_client():
    middleware = DataPolicyMiddleware(None, iam_api_url="http://agency.example", role_prefix=AGC_ROLE_PREFIX)
    clients, roles = middleware._clients_for_request(
        {"agent-app": ["AGC_acme_region", "portal-admin"], "account": ["manage-account"]},
    )
    assert clients == [{"client_id": "agent-app", "policy_mnemonics": ["AGC_acme_region"]}]
    assert roles == ["AGC_acme_region"]


def test_select_policy_clients_keeps_agc_and_agt():
    clients, roles = select_policy_clients(
        {"agent-app": ["AGC_acme_geo", "AGT_acme_attr", "admin"], "other": ["DP_x"]},
        (AGC_ROLE_PREFIX, AGT_ROLE_PREFIX),
    )
    assert clients == [
        {"client_id": "agent-app", "policy_mnemonics": ["AGC_acme_geo", "AGT_acme_attr"]},
    ]
    assert roles == ["AGC_acme_geo", "AGT_acme_attr"]


def test_select_policy_clients_pins_to_registry_keycloak_client():
    clients, roles = select_policy_clients(
        {
            "farmer-registry-staff-portal": ["DP_crop", "editor"],
            "disability-registry-staff-portal": ["DP_other"],
            "agent-app": ["AGC_acme_x"],
        },
        ("DP_",),
        client_id="farmer-registry-staff-portal",
    )
    assert clients == [
        {"client_id": "farmer-registry-staff-portal", "policy_mnemonics": ["DP_crop"]},
    ]
    assert roles == ["DP_crop"]


def test_agency_scoped_policy_mnemonic_injects_agency():
    assert agency_scoped_policy_mnemonic("AGC_", "acme", "region") == "AGC_acme_region"
    assert agency_scoped_policy_mnemonic("AGT_", "acme", "AGC_acme_region") == "AGT_acme_region"
    assert agency_scoped_policy_mnemonic("AGC_", "acme", "acme_region") == "AGC_acme_region"


def test_staff_prefix_is_unchanged():
    assert get_data_policy_mnemonics(["DP_alpha", "AGC_region", "admin"]) == ["DP_alpha"]


def test_add_policy_payload_accepts_registry_scope_fields():
    payload = AddPolicyRequestPayload(
        policy_mnemonic="region",
        policy_type=DataPolicyType.ALLOW,
        policy_target=PolicyTarget.ATTRIBUTE,
        policy_filter_expression={"type": "GROUP", "operator": "AND", "children": []},
        application_id=10,
        registry_application_id=42,
        registry_client_id="farmer-registry-staff-portal",
    )
    assert payload.registry_application_id == 42
    assert payload.registry_client_id == "farmer-registry-staff-portal"


@pytest.mark.asyncio
async def test_middleware_posts_registry_client_id_when_configured():
    middleware = DataPolicyMiddleware(
        MagicMock(),
        iam_api_url="http://iam.example",
        role_prefixes=(AGC_ROLE_PREFIX, AGT_ROLE_PREFIX),
        registry_client_id="farmer-registry-staff-portal",
    )
    request = MagicMock()
    request.state.auth = SimpleNamespace(access_token="tok", credentials=None)

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"policies": [{"policy_mnemonic": "AGC_acme_x"}]}
    mock_client = AsyncMock()
    mock_client.post = AsyncMock(return_value=mock_response)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("iam_core.user_auth.middleware.data_policy.httpx.AsyncClient", return_value=mock_client):
        policies = await middleware._get_policies(
            [{"client_id": "agent-app", "policy_mnemonics": ["AGC_acme_x"]}],
            request,
        )

    assert policies == [{"policy_mnemonic": "AGC_acme_x"}]
    mock_client.post.assert_awaited_once()
    _args, kwargs = mock_client.post.await_args
    assert kwargs["json"] == {
        "clients": [{"client_id": "agent-app", "policy_mnemonics": ["AGC_acme_x"]}],
        "registry_client_id": "farmer-registry-staff-portal",
    }


@pytest.mark.asyncio
async def test_policies_for_client_roles_filters_agent_app_by_registry():
    from iam_core.services.data_policy_service import DataPolicyService

    farmer = SimpleNamespace(
        policy_id="p1",
        policy_mnemonic="AGC_acme_crop",
        policy_description=None,
        register_id="reg-1",
        policy_target="REGISTER_RECORD",
        policy_type="ALLOW",
        policy_filter_expression={"type": "GROUP", "operator": "AND", "children": []},
        application_id=10,
        registry_application_id=100,
    )
    disability = SimpleNamespace(
        policy_id="p2",
        policy_mnemonic="AGC_acme_crop",
        policy_description=None,
        register_id="reg-2",
        policy_target="REGISTER_RECORD",
        policy_type="ALLOW",
        policy_filter_expression={"type": "GROUP", "operator": "AND", "children": []},
        application_id=10,
        registry_application_id=200,
    )

    session = AsyncMock()

    async def scalar(stmt):
        return 100

    session.scalar = AsyncMock(side_effect=scalar)

    class _Result:
        def __init__(self, rows):
            self._rows = rows

        def scalars(self):
            return self

        def all(self):
            return self._rows

    execute_calls = []

    async def execute(stmt):
        execute_calls.append(stmt)
        # First execute: agent-app policy load; later calls unused in this path.
        if len(execute_calls) == 1:
            return _Result([farmer, disability])
        return _Result([])

    session.execute = AsyncMock(side_effect=execute)

    service = DataPolicyService()
    policies = await service.policies_for_client_roles(
        session,
        [("agent-app", ["AGC_acme_crop"])],
        registry_client_id="farmer-registry-staff-portal",
    )

    assert len(policies) == 1
    assert policies[0].policy_id == "p1"
    assert policies[0].registry_application_id == 100


@pytest.mark.asyncio
async def test_policies_for_client_roles_without_registry_returns_all_agent_rows():
    from iam_core.services.data_policy_service import DataPolicyService

    farmer = SimpleNamespace(
        policy_id="p1",
        policy_mnemonic="AGC_acme_crop",
        policy_description=None,
        register_id=None,
        policy_target="ATTRIBUTE",
        policy_type="ALLOW",
        policy_filter_expression={"type": "GROUP", "operator": "AND", "children": []},
        application_id=10,
        registry_application_id=100,
    )
    disability = SimpleNamespace(
        policy_id="p2",
        policy_mnemonic="AGC_acme_crop",
        policy_description=None,
        register_id=None,
        policy_target="ATTRIBUTE",
        policy_type="ALLOW",
        policy_filter_expression={"type": "GROUP", "operator": "AND", "children": []},
        application_id=10,
        registry_application_id=200,
    )

    session = AsyncMock()
    session.scalar = AsyncMock(return_value=None)

    class _Result:
        def __init__(self, rows):
            self._rows = rows

        def scalars(self):
            return self

        def all(self):
            return self._rows

    session.execute = AsyncMock(return_value=_Result([farmer, disability]))

    service = DataPolicyService()
    policies = await service.policies_for_client_roles(
        session,
        [("agent-app", ["AGC_acme_crop"])],
    )

    assert {p.policy_id for p in policies} == {"p1", "p2"}
