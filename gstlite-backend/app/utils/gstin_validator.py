import re

GSTIN_REGEX = r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$"
CHAR_MAP = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"


def validate_gstin_checksum(gstin: str) -> bool:
    """Validates 15-digit GSTIN format and structure."""
    if not gstin or not re.match(GSTIN_REGEX, str(gstin).strip().upper()):
        return False
    return True
