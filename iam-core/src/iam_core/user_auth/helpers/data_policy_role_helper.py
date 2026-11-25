"""Roles representing data policies are identified by a DP_ / AGC_ / AGT_ prefix in Keycloak."""

DP_ROLE_PREFIX = "DP_"
AGC_ROLE_PREFIX = "AGC_"
AGT_ROLE_PREFIX = "AGT_"

_POLICY_PREFIXES = (DP_ROLE_PREFIX, AGC_ROLE_PREFIX, AGT_ROLE_PREFIX)


def is_dp_role(role: str, prefix: str = DP_ROLE_PREFIX) -> bool:
    """Check whether a role string carries the policy prefix (case-insensitive)."""
    return str(role).strip().upper().startswith(prefix.upper())


def strip_policy_prefix(role: str) -> str:
    """Remove DP_ / AGC_ / AGT_ prefix from a role name (case-insensitive)."""
    cleaned_role = str(role).strip()
    upper = cleaned_role.upper()
    for prefix in _POLICY_PREFIXES:
        if upper.startswith(prefix.upper()):
            return cleaned_role[len(prefix) :].strip()
    return cleaned_role


def strip_dp_prefix(role: str) -> str:
    """Remove the DP_ prefix from a role name, returning the mnemonic portion."""
    return strip_policy_prefix(role)


def agency_scoped_policy_mnemonic(prefix: str, agency_mnemonic: str, bare: str) -> str:
    """Build ``AGC_<agency>_<name>`` / ``AGT_<agency>_<name>`` for agent-app uniqueness.

    Backend always injects the agency mnemonic after the prefix. If the bare name
    already starts with ``<agency>_``, it is not duplicated.
    """
    agency = (agency_mnemonic or "").strip()
    name = strip_policy_prefix(bare or "").strip()
    if not name:
        raise ValueError("policy mnemonic is required")
    if not agency:
        return f"{prefix}{name}"
    agency_token = f"{agency}_"
    if name.startswith(agency_token):
        return f"{prefix}{name}"
    return f"{prefix}{agency}_{name}"


def get_data_policy_mnemonics(roles: list[str] | None, prefix: str = DP_ROLE_PREFIX) -> list[str]:
    """Return deduplicated policy role names that start with ``prefix``, in first-seen order."""
    if not roles:
        return []

    seen: set[str] = set()
    mnemonics: list[str] = []

    for role in roles:
        if not is_dp_role(role, prefix):
            continue
        cleaned_role = str(role).strip()
        if cleaned_role and cleaned_role not in seen:
            seen.add(cleaned_role)
            mnemonics.append(cleaned_role)

    return mnemonics
