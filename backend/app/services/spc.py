"""Statistical process control: turn a daily quality metric into a control
chart and detect process drift *before* it breaches an acceptance threshold.

Control limits come from a stable baseline (the earlier part of the window),
so drift that inflates the recent variance doesn't hide itself. Drift signals
implement a subset of the Nelson / Western-Electric rules that matter most for
a rate metric where higher is worse (defect/fail rate).
"""

from __future__ import annotations


def analyze_control_chart(points: list[dict], baseline_frac: float = 0.6) -> dict:
    """`points`: [{"date": str, "value": float}] in chronological order.

    Returns the center line, control limits, and any drift signals. With too
    few days to form limits, returns status="insufficient_data"."""
    values = [float(p["value"]) for p in points]
    n = len(values)
    base: dict = {
        "points": points,
        "center_line": None,
        "ucl": None,
        "lcl": None,
        "sigma": None,
        "signals": [],
        "status": "insufficient_data",
    }
    if n < 8:
        return base

    b = max(6, int(n * baseline_frac))
    baseline = values[:b]
    mean = sum(baseline) / len(baseline)
    sigma = (sum((v - mean) ** 2 for v in baseline) / len(baseline)) ** 0.5
    ucl = mean + 3 * sigma
    lcl = max(0.0, mean - 3 * sigma)

    signals: list[dict] = []

    # Rule 1 — any point beyond the 3σ control limits (out of control).
    for p, v in zip(points, values):
        if v > ucl:
            signals.append({
                "date": p["date"], "rule": "beyond_ucl", "severity": "critical",
                "message": f"{v:.1f} exceeded the upper control limit ({ucl:.1f})",
            })
        elif v < lcl:
            signals.append({
                "date": p["date"], "rule": "beyond_lcl", "severity": "major",
                "message": f"{v:.1f} fell below the lower control limit ({lcl:.1f})",
            })

    # Rule 2 — 6+ consecutive rising points (a trend). Report the latest only.
    run, trend_idx = 1, None
    for i in range(1, n):
        run = run + 1 if values[i] > values[i - 1] else 1
        if run >= 6:
            trend_idx = i
    if trend_idx is not None:
        signals.append({
            "date": points[trend_idx]["date"], "rule": "trend_up", "severity": "major",
            "message": "6+ consecutive rising points — an upward trend",
        })

    # Rule 3 — 8+ consecutive points above the center line (a sustained shift).
    run, shift_idx = 0, None
    for i in range(n):
        run = run + 1 if values[i] > mean else 0
        if run >= 8:
            shift_idx = i
    if shift_idx is not None:
        signals.append({
            "date": points[shift_idx]["date"], "rule": "shift_up", "severity": "major",
            "message": "8+ consecutive points above the center line — a sustained shift",
        })

    signals.sort(key=lambda s: s["date"])
    return {
        "points": points,
        "center_line": round(mean, 1),
        "ucl": round(ucl, 1),
        "lcl": round(lcl, 1),
        "sigma": round(sigma, 2),
        "signals": signals,
        "status": "drift_detected" if signals else "in_control",
    }
