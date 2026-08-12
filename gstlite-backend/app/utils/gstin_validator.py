import re

GSTIN_REGEX = r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$"
CHAR_MAP = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"

def validate_gstin_checksum(gstin: str) -> bool:
    """Validates 15-digit GSTIN format and Luhn Mod-36 checksum."""
    if not gstin or not re.match(GSTIN_REGEX, gstin):
        return False

    factor = 1
    total = 0
    mod = len(CHAR_MAP)

    for i in range(14):
        code_point = CHAR_MAP.index(gstin[i])
        digit = code_point * factor
        factor = 1 if factor == 2 else 2
        total += (digit // mod) + (digit % mod)

    checksum_idx = (mod - (total % mod)) % mod
    return CHAR_MAP[checksum_idx] == gstin[14]