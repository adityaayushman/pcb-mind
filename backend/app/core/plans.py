"""Subscription plans and the shared PCB-template catalog.

There's no billing integration yet — a plan is just a tier stored on the
organization that governs how much a customer gets: the starter template
library seeded for them and the ceiling on how many templates they may hold.
The same catalog seeds the demo org's showcase library (1000 boards) and each
new org's plan-sized starter set, so names are consistent everywhere.
"""

from __future__ import annotations

PLANS: dict[str, dict] = {
    "free": {
        "label": "Free",
        "price": "$0",
        "cadence": "forever",
        "starter_templates": 5,
        "max_templates": 15,
        "max_golden_versions": 1,
        "inspections_per_month": 50,
        "blurb": "For a single engineer trying PCBMind on a line.",
    },
    "pro": {
        "label": "Pro",
        "price": "$149",
        "cadence": "per month",
        "starter_templates": 40,
        "max_templates": 300,
        "max_golden_versions": 10,
        "inspections_per_month": 2000,
        "blurb": "For a QA team running continuous inspection.",
    },
    "enterprise": {
        "label": "Enterprise",
        "price": "Custom",
        "cadence": "contact us",
        "starter_templates": 150,
        "max_templates": 100000,
        "max_golden_versions": 100,
        "inspections_per_month": 100000,
        "blurb": "For multi-line factories with unlimited scale.",
    },
}

DEFAULT_PLAN = "free"


def plan_config(plan: str | None) -> dict:
    return PLANS.get(plan or DEFAULT_PLAN, PLANS[DEFAULT_PLAN])


# Catalog building blocks — 25 product lines × 10 board types × 5 revisions
# gives 1250 unique, realistic names; we draw the first N deterministically so
# every org that seeds the same count gets the same well-known boards.
_PRODUCTS = [
    "Atlas", "Nimbus", "Orion", "Vertex", "Pulse", "Quantum", "Falcon", "Titan",
    "Nova", "Zephyr", "Helix", "Cobalt", "Aurora", "Vector", "Sentinel", "Photon",
    "Cipher", "Beacon", "Forge", "Raptor", "Ember", "Onyx", "Halcyon", "Meridian",
    "Lumen",
]
_TYPES = [
    "Control Board", "Power Supply", "Sensor Interface", "Motor Driver",
    "IO Expansion", "RF Module", "Gateway", "Display Driver",
    "Battery Management", "Backplane",
]
_REVS = ["Rev A", "Rev B", "Rev C", "Rev D", "Rev E"]


def template_catalog(count: int) -> list[tuple[str, str]]:
    """Return the first `count` (name, description) pairs from the catalog."""
    out: list[tuple[str, str]] = []
    for product in _PRODUCTS:
        for board in _TYPES:
            for rev in _REVS:
                if len(out) >= count:
                    return out
                out.append((f"{product} {board} {rev}", f"{board} for the {product} product line."))
    return out
