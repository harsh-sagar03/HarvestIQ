from typing import Final

DISEASE_STATUS_CONFIRMED: Final[str] = "CONFIRMED"
DISEASE_STATUS_LOW_CONFIDENCE: Final[str] = "LOW_CONFIDENCE"
DISEASE_STATUS_REJECTED: Final[str] = "REJECTED"

DEFAULT_CONFIDENCE_THRESHOLD: Final[float] = 0.70
MAX_IMAGE_BYTES: Final[int] = 5 * 1024 * 1024
ALLOWED_IMAGE_TYPES: Final[frozenset[str]] = frozenset(
    {"image/jpeg", "image/png", "image/webp", "image/jpg"}
)
