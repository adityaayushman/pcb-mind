"""Severity classification for detected defects.

Derived from `defect_type` at read time — not stored — since it's a pure
function of a value we already persist. Storing it would mean a data
backfill every time the policy below changes; this way a reclassification
is a one-line edit.
"""

# short/open_circuit are immediate functional failures (dead net, short-to-
# fire risk) -> critical. missing_hole/spurious_copper are serious but
# conditional (a missing hole may not break the specific net; spurious
# copper is a latent short risk, not a guaranteed one) -> major, and
# unclassified ("other") detections default to major rather than a neutral
# minor, since under-classifying severity is worse than extra QA scrutiny
# on a possibly-benign one. mouse_bite/spur are edge/mechanical defects
# that rarely intersect a live trace -> minor.
DEFECT_SEVERITY: dict[str, str] = {
    "short": "critical",
    "open_circuit": "critical",
    "missing_hole": "major",
    "spurious_copper": "major",
    "other": "major",
    "mouse_bite": "minor",
    "spur": "minor",
}

_SEVERITY_ORDER = ["minor", "major", "critical"]


def get_severity(defect_type: str) -> str:
    return DEFECT_SEVERITY.get(defect_type, "major")


def worst_severity(defect_types: list[str]) -> str | None:
    if not defect_types:
        return None
    return max((get_severity(t) for t in defect_types), key=_SEVERITY_ORDER.index)
