from typing import Any


_FACTOR_LABELS = {
    "THERMAL": "thermal stress",
    "MOISTURE": "rainfall deficit",
    "GDD": "growth stage vulnerability",
    "NITROGEN": "nitrogen deficiency",
    "PHOSPHORUS": "phosphorus deficiency",
    "POTASSIUM": "potassium deficiency",
    "PH": "soil pH imbalance",
    "ORGANIC_CARBON": "low organic carbon",
    "ELECTRICAL_CONDUCTIVITY": "salinity stress",
    "DISEASE": "disease detection",
}


def build_fsi_explanation(
    fsi: float,
    classification: str,
    primary_factor: str,
    inputs: dict[str, Any],
) -> dict[str, Any]:
    label = _FACTOR_LABELS.get(primary_factor, primary_factor.lower())
    classification_label = classification.replace("_", " ").title()
    summary = (
        f"FSI is {fsi} ({classification_label}) primarily due to {label}."
    )
    return {
        "summary": summary,
        "inputs": inputs,
        "primary_factor": primary_factor,
    }


def build_soil_explanation(
    soil_health_index: float,
    primary_factor: str,
    inputs: dict[str, Any],
    deficiency_status: dict[str, str],
) -> dict[str, Any]:
    label = _FACTOR_LABELS.get(primary_factor, primary_factor.lower())
    low_nutrients = [k for k, v in deficiency_status.items() if v == "LOW"]
    summary = (
        f"Soil health index is {soil_health_index} with primary concern: {label}."
    )
    if low_nutrients:
        summary += f" Low nutrients: {', '.join(low_nutrients)}."
    return {
        "summary": summary,
        "inputs": inputs,
        "primary_factor": primary_factor,
    }


def build_disease_explanation(
    disease: str,
    confidence: float,
    deterministic_status: str,
    primary_factor: str,
    inputs: dict[str, Any],
) -> dict[str, Any]:
    summary = (
        f"Vision model suggested {disease} at {confidence:.2f} confidence. "
        f"Deterministic status: {deterministic_status}."
    )
    return {
        "summary": summary,
        "inputs": inputs,
        "primary_factor": primary_factor,
    }


def build_alert_explanation(
    rule_id: str,
    primary_factor: str,
    inputs: dict[str, Any],
    message: str,
) -> dict[str, Any]:
    summary = f"Alert {rule_id} triggered: {message}"
    return {
        "summary": summary,
        "inputs": inputs,
        "primary_factor": primary_factor,
    }


def build_advisory_explanation(
    primary_factor: str,
    inputs: dict[str, Any],
    triggered_rules: list[str],
    rag_sources: list[str],
    mitigation_locked: bool,
    nearby_outbreaks: list[str],
) -> dict[str, Any]:
    parts = [f"Advisory grounded in deterministic farm intelligence (snapshot {inputs.get('snapshot_version', 'v1')})."]
    if triggered_rules:
        parts.append(f" Active rules: {', '.join(triggered_rules)}.")
    if rag_sources:
        parts.append(f" Knowledge sources: {', '.join(rag_sources)}.")
    if nearby_outbreaks:
        parts.append(f" Nearby outbreaks: {', '.join(nearby_outbreaks)}.")
    if mitigation_locked:
        parts.append(" Mitigation advice is locked due to high field stress.")
    enriched_inputs = {
        **inputs,
        "triggered_rules": triggered_rules,
        "rag_sources": rag_sources,
        "mitigation_locked": mitigation_locked,
        "nearby_outbreaks": nearby_outbreaks,
    }
    return {
        "summary": "".join(parts),
        "inputs": enriched_inputs,
        "primary_factor": primary_factor,
    }


def build_optimizer_explanation(
    action_type: str,
    safe: bool,
    reasons: list[str],
    triggered_rules: list[str],
    inputs: dict[str, Any],
) -> dict[str, Any]:
    status = "SAFE" if safe else "UNSAFE"
    summary = f"Input window for {action_type} is {status}."
    if triggered_rules:
        summary += f" Rules: {', '.join(triggered_rules)}."
    return {
        "summary": summary,
        "inputs": {**inputs, "triggered_rules": triggered_rules, "reasons": reasons},
        "primary_factor": action_type,
    }


def build_momentum_explanation(momentum: dict[str, Any]) -> dict[str, Any]:
    summary = (
        f"Stress momentum is {momentum['direction']} "
        f"(score={momentum['momentum_score']}, delta={momentum['fsi_delta']})."
    )
    return {
        "summary": summary,
        "inputs": momentum,
        "primary_factor": "MOMENTUM",
    }


def build_yield_risk_explanation(yield_risk: dict[str, Any]) -> dict[str, Any]:
    summary = (
        f"Yield risk is {yield_risk['risk_band']} "
        f"at {yield_risk['estimated_risk_percent']}%."
    )
    factors = yield_risk.get("contributing_factors", [])
    if factors:
        summary += f" Factors: {', '.join(factors)}."
    return {
        "summary": summary,
        "inputs": yield_risk,
        "primary_factor": "YIELD_RISK",
    }


def build_briefing_explanation(sections: dict[str, Any]) -> dict[str, Any]:
    summary = "Daily briefing compiled from deterministic farm intelligence snapshot v3."
    return {
        "summary": summary,
        "inputs": sections,
        "primary_factor": "BRIEFING",
    }


def build_simulation_explanation(
    baseline_fsi: float,
    projected_fsi: float,
    inputs: dict[str, Any],
) -> dict[str, Any]:
    summary = (
        f"Simulation projects FSI from {baseline_fsi} to {projected_fsi} "
        f"under the selected scenario."
    )
    return {
        "summary": summary,
        "inputs": inputs,
        "primary_factor": "SIMULATION",
    }
