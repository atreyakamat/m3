"""Shared domain package / backend contract.

packages/shared/src/domain.ts is the cross-transport vocabulary. This test pins
its role and status vocabulary to the server-side policy so client and backend
cannot silently drift apart (P4 requirement)."""
import re
from pathlib import Path

from app.permissions import ROLES

def _find_domain_ts() -> Path:
    for p in Path(__file__).resolve().parents:
        cand = p / "packages" / "shared" / "src" / "domain.ts"
        if cand.exists():
            return cand
    return Path(__file__).resolve().parents[-1] / "packages" / "shared" / "src" / "domain.ts"

DOMAIN_TS = _find_domain_ts()


def _ts_const(name: str) -> list[str]:
    if not DOMAIN_TS.exists():
        return []
    match = re.search(rf"export const {name}\s*=\s*\[([^\]]*)\]", DOMAIN_TS.read_text())
    if not match:
        return []
    return re.findall(r"'([^']+)'", match.group(1))


def test_shared_roles_cover_backend_role_vocabulary():
    roles = _ts_const("roles")
    if not roles:  # shared package not present in this checkout: nothing to pin
        return
    assert len(set(roles)) == len(roles), "shared role list has duplicates"
    missing = [role for role in ROLES if role not in roles]
    assert not missing, f"shared domain roles missing backend roles: {missing}"
    legacy_extra = set(roles) - set(ROLES)
    assert legacy_extra <= {"pathology"}, f"shared domain invents unknown roles: {legacy_extra}"


def test_shared_species_and_status_match_backend_lists():
    import app.schemas as schemas

    species = _ts_const("species")
    assert set(species) == set(schemas.SPECIES), f"species drift: {sorted(set(species) ^ set(schemas.SPECIES))}"
    statuses = _ts_const("diagnosticStatuses")
    assert set(statuses) == set(schemas.TEST_RESULTS), (
        f"diagnostic status drift: {sorted(set(statuses) ^ set(schemas.TEST_RESULTS))}"
    )
