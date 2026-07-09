"""Rule-based pass/fail validation.

Derived from detected defect types at read time — not stored — matching
`severity.py`'s own philosophy: a pure function of data already persisted,
so a policy tweak never needs a backfill. Replaces the old crude rule
(`any detection at all -> fail`) with something a real QA workflow would
actually use: a single cosmetic minor defect doesn't sink a board the same
way a critical short does.
"""

from dataclasses import dataclass, field

from app.core.severity import get_severity

MAJOR_DEFECT_FAIL_THRESHOLD = 2


@dataclass
class ValidationVerdict:
    passed: bool
    notes: list[str] = field(default_factory=list)


def validate(defect_types: list[str]) -> ValidationVerdict:
    if not defect_types:
        return ValidationVerdict(True, ["No defects detected."])

    severities = [get_severity(t) for t in defect_types]
    critical = [t for t, s in zip(defect_types, severities) if s == "critical"]
    major = [t for t, s in zip(defect_types, severities) if s == "major"]
    minor = [t for t, s in zip(defect_types, severities) if s == "minor"]

    notes: list[str] = []
    if critical:
        notes.append(
            f"{len(critical)} critical defect(s) detected "
            f"({', '.join(sorted(set(critical)))}) — automatic fail."
        )
        passed = False
    elif len(major) >= MAJOR_DEFECT_FAIL_THRESHOLD:
        notes.append(
            f"{len(major)} major defects detected (threshold {MAJOR_DEFECT_FAIL_THRESHOLD}) — fail."
        )
        passed = False
    else:
        passed = True
        if major:
            notes.append(f"{len(major)} major defect(s) noted — within tolerance, flagged for review.")

    if minor:
        notes.append(f"{len(minor)} minor defect(s) noted — cosmetic, does not affect verdict.")

    return ValidationVerdict(passed, notes)
