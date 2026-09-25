import re
from typing import Any, Dict, List, Optional


class Finding:
    def __init__(
        self,
        title: str,
        severity: str,
        description: str,
        suggestion: str = "",
        rule_reference: str = "",
    ):
        self.title = title
        self.severity = severity  # "high", "medium", "low"
        self.description = description
        self.suggestion = suggestion
        self.rule_reference = rule_reference

    def to_dict(self) -> Dict[str, str]:
        return {
            "title": self.title,
            "severity": self.severity,
            "description": self.description,
            "suggestion": self.suggestion,
            "rule_reference": self.rule_reference,
        }


def validate_gstin_checksum(gstin: str) -> bool:
    """Validates GSTIN length and format structure."""
    if not gstin or len(gstin) != 15:
        return False
    gstin_regex = r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$"
    return bool(re.match(gstin_regex, gstin.upper()))


def check_gstin_validity(parsed_data: Dict[str, Any]) -> List[Finding]:
    """Validates vendor GSTIN format and checksum structure."""
    findings = []
    vendor_gstin = parsed_data.get("vendor_gstin")

    if not vendor_gstin:
        findings.append(
            Finding(
                title="Missing Vendor GSTIN",
                severity="high",
                description="The vendor GSTIN could not be extracted from the invoice.",
                suggestion="Manually verify and input the vendor's 15-digit GSTIN.",
                rule_reference="CGST Rule 46(b)",
            )
        )
    elif not validate_gstin_checksum(str(vendor_gstin)):
        findings.append(
            Finding(
                title="Invalid Vendor GSTIN Format",
                severity="high",
                description=f"The extracted GSTIN '{vendor_gstin}' is invalid or poorly formatted.",
                suggestion="Cross-check the vendor GSTIN against the official GST portal.",
                rule_reference="CGST Rule 46(b)",
            )
        )

    return findings


def check_tax_calculation(parsed_data: Dict[str, Any]) -> List[Finding]:
    """Validates if tax amounts match expected tax rates."""
    findings = []
    amount = parsed_data.get("amount")
    tax_rate = parsed_data.get("tax_rate")

    if amount and tax_rate:
        try:
            expected_tax = float(amount) * (float(tax_rate) / 100.0)
            cgst = parsed_data.get("cgst")
            sgst = parsed_data.get("sgst")
            if cgst is not None and sgst is not None:
                actual_tax = float(cgst) + float(sgst)
                if abs(expected_tax - actual_tax) > 2.0:
                    findings.append(
                        Finding(
                            title="Tax Calculation Mismatch",
                            severity="medium",
                            description=f"Expected tax calculation (₹{expected_tax:.2f}) differs from stated tax (₹{actual_tax:.2f}).",
                            suggestion="Recalculate line-item values and tax rates.",
                            rule_reference="CGST Section 33",
                        )
                    )
        except (ValueError, TypeError):
            pass

    return findings


def check_2b_reconciliation(
    parsed_data: Dict[str, Any], known_2b_gstins: set
) -> List[Finding]:
    """Checks whether the vendor GSTIN is present in the local GSTR-2B registry."""
    findings = []
    vendor_gstin = parsed_data.get("vendor_gstin")

    if vendor_gstin and known_2b_gstins and vendor_gstin not in known_2b_gstins:
        findings.append(
            Finding(
                title="GSTR-2B Unmatched Vendor",
                severity="medium",
                description=f"Vendor GSTIN '{vendor_gstin}' was not found in your filed GSTR-2B returns.",
                suggestion="Verify if supplier has filed GSTR-1 for the current period before claiming ITC.",
                rule_reference="CGST Section 16(2)(aa)",
            )
        )

    return findings


def check_buyer_taxpayer_match(
    parsed_data: Dict[str, Any], business: Optional[Any] = None
) -> List[Finding]:
    """
    Checks if the invoice buyer matches the registered taxpayer entity.
    """
    findings = []
    buyer_name = parsed_data.get("buyer_name")
    buyer_gstin = parsed_data.get("buyer_gstin")

    taxpayer_name = getattr(business, "name", None) if business else parsed_data.get("taxpayer_name")
    taxpayer_gstin = getattr(business, "gstin", None) if business else parsed_data.get("taxpayer_gstin")

    if not taxpayer_name:
        taxpayer_name = "Ashoka Textiles Pvt. Ltd."
    if not taxpayer_gstin:
        taxpayer_gstin = "32AACCA1234F1Z5"

    if buyer_name:
        clean_buyer = re.sub(r"[^a-zA-Z0-9]", "", buyer_name.lower())
        clean_taxpayer = re.sub(r"[^a-zA-Z0-9]", "", taxpayer_name.lower())

        if clean_buyer and clean_taxpayer and clean_buyer not in clean_taxpayer and clean_taxpayer not in clean_buyer:
            findings.append(
                Finding(
                    title="Buyer / Taxpayer Entity Mismatch",
                    severity="high",
                    description=(
                        f"Invoice is billed to '{buyer_name}', but your registered GST taxpayer profile "
                        f"is '{taxpayer_name}' ({taxpayer_gstin})."
                    ),
                    suggestion=(
                        "Verify whether this invoice belongs to the selected taxpayer. "
                        "Input Tax Credit (ITC) cannot be claimed on invoices billed to an unlinked entity."
                    ),
                    rule_reference="CGST Act Section 16(2)(a) & Rule 36(1)",
                )
            )

    if buyer_gstin and taxpayer_gstin:
        if str(buyer_gstin).upper().strip() != str(taxpayer_gstin).upper().strip():
            findings.append(
                Finding(
                    title="Buyer GSTIN Mismatch",
                    severity="high",
                    description=(
                        f"Invoice recipient GSTIN '{buyer_gstin}' does not match your registered GSTIN "
                        f"'{taxpayer_gstin}'."
                    ),
                    suggestion="Verify that the vendor issued the invoice to your correct 15-digit GSTIN.",
                    rule_reference="CGST Section 16(2)(aa) & Rule 36(1)",
                )
            )

    return findings


def calculate_compliance_score(findings: List[Any]) -> int:
    """Calculates compliance score (base 100) from list of findings."""
    score = 100
    for finding in findings:
        sev = getattr(finding, "severity", "low") if not isinstance(finding, dict) else finding.get("severity", "low")
        if sev == "high":
            score -= 30
        elif sev == "medium":
            score -= 15
        else:
            score -= 5
    return max(0, score)


def risk_from_findings(findings: List[Any]) -> str:
    """Determines overall risk level based on compliance score."""
    score = calculate_compliance_score(findings)
    if score >= 85:
        return "low"
    elif score >= 50:
        return "medium"
    return "high"


def run_all_checks(
    parsed_data: Optional[Dict[str, Any]] = None,
    known_2b_gstins: Optional[set] = None,
    business: Optional[Any] = None,
    vendor_gstin: Optional[str] = None,
    amount: Optional[float] = None,
    tax_rate: Optional[float] = None,
    hsn_code: Optional[str] = None,
    **kwargs: Any,
) -> Dict[str, Any]:
    """Main entry point called by ManagerAgent / AI pipeline."""
    if parsed_data is None:
        parsed_data = {}

    if vendor_gstin:
        parsed_data["vendor_gstin"] = vendor_gstin
    if amount is not None:
        parsed_data["amount"] = amount
    if tax_rate is not None:
        parsed_data["tax_rate"] = tax_rate
    if hsn_code:
        parsed_data["hsn_code"] = hsn_code

    for k, v in kwargs.items():
        if k not in parsed_data:
            parsed_data[k] = v

    if known_2b_gstins is None:
        known_2b_gstins = set()

    findings: List[Finding] = []
    findings.extend(check_gstin_validity(parsed_data))
    findings.extend(check_tax_calculation(parsed_data))
    findings.extend(check_2b_reconciliation(parsed_data, known_2b_gstins))
    findings.extend(check_buyer_taxpayer_match(parsed_data, business=business))

    score = calculate_compliance_score(findings)
    risk = risk_from_findings(findings)
    status = "validated" if score >= 85 else "flagged"

    return {
        "findings": findings,
        "compliance_score": score,
        "risk": risk,
        "status": status,
    }