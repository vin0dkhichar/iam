from iam_core.user_auth.helpers.data_policy_role_helper import (
    AGC_ROLE_PREFIX,
    agency_scoped_policy_mnemonic,
    get_data_policy_mnemonics,
)
from iam_core.user_auth.middleware.data_policy import DataPolicyMiddleware


def test_agency_prefix_keeps_agc_roles_grouped_by_client():
    middleware = DataPolicyMiddleware(None, iam_api_url="http://agency.example", role_prefix=AGC_ROLE_PREFIX)
    clients, roles = middleware._clients_for_request(
        {"agent-app": ["AGC_acme_region", "portal-admin"], "account": ["manage-account"]},
    )
    assert clients == [{"client_id": "agent-app", "policy_mnemonics": ["AGC_acme_region"]}]
    assert roles == ["AGC_acme_region"]


def test_agency_scoped_policy_mnemonic_injects_agency():
    assert agency_scoped_policy_mnemonic("AGC_", "acme", "region") == "AGC_acme_region"
    assert agency_scoped_policy_mnemonic("AGT_", "acme", "AGC_acme_region") == "AGT_acme_region"
    assert agency_scoped_policy_mnemonic("AGC_", "acme", "acme_region") == "AGC_acme_region"


def test_staff_prefix_is_unchanged():
    assert get_data_policy_mnemonics(["DP_alpha", "AGC_region", "admin"]) == ["DP_alpha"]
