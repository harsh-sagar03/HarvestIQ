from app.core.constants.disease import (
    DISEASE_STATUS_CONFIRMED,
    DISEASE_STATUS_LOW_CONFIDENCE,
    DISEASE_STATUS_REJECTED,
)
from app.services.deterministic_engine import confirm_disease_detection, normalize_disease_tag

ALLOWLIST = {
    "WHEAT": {
        "RAJASTHAN": ["WHEAT_RUST", "POWDERY_MILDEW"],
        "ALL": ["LEAF_BLIGHT"],
    }
}


def test_normalize_disease_tag() -> None:
    assert normalize_disease_tag("Wheat Rust") == "WHEAT_RUST"


def test_low_confidence_status() -> None:
    disease, status = confirm_disease_detection(
        "WHEAT",
        "Rajasthan",
        "Wheat Rust",
        0.55,
        0.70,
        ALLOWLIST,
    )
    assert disease == "WHEAT_RUST"
    assert status == DISEASE_STATUS_LOW_CONFIDENCE


def test_confirmed_for_allowed_region() -> None:
    disease, status = confirm_disease_detection(
        "WHEAT",
        "Rajasthan",
        "WHEAT_RUST",
        0.91,
        0.70,
        ALLOWLIST,
    )
    assert disease == "WHEAT_RUST"
    assert status == DISEASE_STATUS_CONFIRMED


def test_rejected_for_unknown_disease() -> None:
    # Use confidence below the 0.80 high-confidence approval threshold
    # but above the base threshold (0.70) to test regional rejection
    disease, status = confirm_disease_detection(
        "WHEAT",
        "Rajasthan",
        "UNKNOWN_PATHOGEN",
        0.75,
        0.70,
        ALLOWLIST,
    )
    assert disease == "UNKNOWN_PATHOGEN"
    assert status == DISEASE_STATUS_REJECTED
