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
    """Validates GSTIN length, format structure, and Mod-36 checksum."""
    if not gstin or len(gstin) != 15:
        return False
    gstin_regex = r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$"
    if not re.match(gstin_regex, gstin.upper()):
        return False
    try:
        chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
        total = 0
        for i, ch in enumerate(gstin[:14].upper()):
            factor = 1 if i % 2 == 0 else 2
            prod = chars.index(ch) * factor
            total += prod // 36 + prod % 36
        expected = chars[(36 - total % 36) % 36]
        return gstin[14].upper() == expected
    except Exception:
        return True


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
                description=f"The extracted GSTIN '{vendor_gstin}' is invalid or has a corrupt checksum.",
                suggestion="Cross-check the vendor GSTIN against the official GST portal.",
                rule_reference="CGST Rule 46(b)",
            )
        )

    return findings


def check_tax_calculation(parsed_data: Dict[str, Any]) -> List[Finding]:
    """Validates if tax amounts match expected tax rates and total arithmetic."""
    findings = []
    # Prefer taxable_amount over gross total amount
    taxable_base = parsed_data.get("taxable_amount") or parsed_data.get("taxable") or parsed_data.get("subtotal")
    tax_rate = parsed_data.get("tax_rate")

    # If only gross amount exists, calculate taxable base backwards
    if not taxable_base and parsed_data.get("total_amount") and tax_rate:
        try:
            taxable_base = float(parsed_data.get("total_amount")) / (1.0 + (float(tax_rate) / 100.0))
        except Exception:
            pass
    elif not taxable_base and parsed_data.get("amount") and tax_rate:
        taxable_base = parsed_data.get("amount")

    if taxable_base and tax_rate:
        try:
            expected_tax = float(taxable_base) * (float(tax_rate) / 100.0)
            cgst = parsed_data.get("cgst") or parsed_data.get("cgst_amount")
            sgst = parsed_data.get("sgst") or parsed_data.get("sgst_amount")
            igst = parsed_data.get("igst") or parsed_data.get("igst_amount")
            
            actual_tax = None
            if cgst is not None or sgst is not None:
                actual_tax = float(cgst or 0.0) + float(sgst or 0.0)
            elif igst is not None:
                actual_tax = float(igst)

            if actual_tax is not None and abs(expected_tax - actual_tax) > 2.0:
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

    # Total arithmetic check: Taxable + CGST + SGST + IGST == Total
    total = parsed_data.get("total") or parsed_data.get("total_amount")
    taxable = parsed_data.get("taxable_amount") or parsed_data.get("taxable")
    cgst = parsed_data.get("cgst") or parsed_data.get("cgst_amount") or 0.0
    sgst = parsed_data.get("sgst") or parsed_data.get("sgst_amount") or 0.0
    igst = parsed_data.get("igst") or parsed_data.get("igst_amount") or 0.0
    if total is not None and taxable is not None:
        try:
            calc_total = float(taxable) + float(cgst) + float(sgst) + float(igst)
            if abs(calc_total - float(total)) > 0.05:
                findings.append(
                    Finding(
                        title="Tax Calculation Mismatch",
                        severity="medium",
                        description=f"Sum of taxable and taxes (₹{calc_total:.2f}) differs from invoice total (₹{float(total):.2f}).",
                        suggestion="Ensure total invoice matches the sum of taxable base and taxes.",
                        rule_reference="CGST Section 33",
                    )
                )
        except (ValueError, TypeError):
            pass

    return findings


def check_2b_reconciliation(
    parsed_data: Dict[str, Any], known_2b_gstins: set, business: Optional[Any] = None
) -> List[Finding]:
    """Checks whether the vendor GSTIN is present in the local GSTR-2B registry (Purchases only)."""
    findings = []
    
    # Skip GSTR-2B check for sales invoices
    taxpayer_gstin = getattr(business, "gstin", None) if business else parsed_data.get("taxpayer_gstin")
    vendor_gstin = parsed_data.get("vendor_gstin")
    is_sales = (
        parsed_data.get("document_type") == "sales"
        or (taxpayer_gstin and vendor_gstin and str(vendor_gstin).strip().upper() == str(taxpayer_gstin).strip().upper())
    )
    if is_sales:
        return []

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
    For Purchase Invoices: Checks if the invoice buyer matches the registered taxpayer entity (claiming ITC).
    For Sales Invoices: Checks if the invoice seller matches the registered taxpayer entity (issuing invoice).
    """
    findings = []

    taxpayer_name = getattr(business, "name", None) if business else parsed_data.get("taxpayer_name")
    taxpayer_gstin = getattr(business, "gstin", None) if business else parsed_data.get("taxpayer_gstin")

    if not taxpayer_name:
        taxpayer_name = "Kaveri Home Furnishings"
    if not taxpayer_gstin:
        taxpayer_gstin = "29AAFFK4812M1Z0"

    vendor_gstin = parsed_data.get("vendor_gstin")
    is_sales = (
        parsed_data.get("document_type") == "sales"
        or (taxpayer_gstin and vendor_gstin and str(vendor_gstin).strip().upper() == str(taxpayer_gstin).strip().upper())
    )

    if is_sales:
        # On a SALES invoice, the taxpayer is the SELLER (vendor).
        # We only check that the seller matches the taxpayer profile.
        # The buyer is the customer, so having a different buyer is expected and correct!
        if vendor_gstin and taxpayer_gstin:
            if str(vendor_gstin).upper().strip() != str(taxpayer_gstin).upper().strip():
                findings.append(
                    Finding(
                        title="Seller GSTIN Mismatch",
                        severity="high",
                        description=(
                            f"Sales invoice seller GSTIN '{vendor_gstin}' does not match your registered GSTIN "
                            f"'{taxpayer_gstin}'."
                        ),
                        suggestion="Ensure sales invoices are issued under your registered business GSTIN.",
                        rule_reference="CGST Section 31 & Rule 46",
                    )
                )
        return findings

    # PURCHASE INVOICE: The taxpayer is the BUYER
    buyer_name = parsed_data.get("buyer_name")
    buyer_gstin = parsed_data.get("buyer_gstin")

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


BLOCKED_ITC_KEYWORDS = [
    ("motor vehicle", "Motor vehicles for transportation of persons with seating capacity <= 13"),
    ("motor car", "Motor vehicles for transportation of persons"),
    ("car purchase", "Passenger motor car purchase"),
    ("motor", "Motor vehicles and conveyances"),
    ("car rental", "Car rental / leasing of passenger motor vehicles"),
    ("catering", "Food and beverages / outdoor catering services"),
    ("food and beverages", "Food and beverage expenses"),
    ("food", "Food and beverage expenses"),
    ("beverage", "Food and beverage expenses"),
    ("restaurant", "Food and beverages supplied at restaurants"),
    ("hotel food", "Food and beverage expenses"),
    ("health insurance", "Health insurance or life insurance not mandated by statutory law"),
    ("gym", "Club, fitness centre or gym membership fees"),
    ("fitness", "Club or fitness centre membership fees"),
    ("club membership", "Club or social association membership fees"),
    ("cosmetic", "Cosmetic and plastic surgery expenses"),
    ("gift", "Goods given as gifts or free samples exceeding permissible thresholds"),
    ("personal", "Goods or services used for personal consumption"),
    ("written off", "Goods lost, stolen, destroyed, written off or disposed of by way of gift"),
]


def check_section_17_5_blocked_itc(parsed_data: Dict[str, Any]) -> List[Finding]:
    """Detects Section 17(5) blocked / ineligible ITC goods and services."""
    findings = []
    text_corpus = " ".join([
        str(parsed_data.get("vendor_name") or ""),
        str(parsed_data.get("description") or ""),
        str(parsed_data.get("original_filename") or ""),
        str(parsed_data.get("notes") or ""),
        str(parsed_data.get("hsn_code") or ""),
    ]).lower()

    for keyword, reason in BLOCKED_ITC_KEYWORDS:
        if keyword in text_corpus:
            findings.append(
                Finding(
                    title="Section 17(5) Blocked / Ineligible ITC",
                    severity="high",
                    description=(
                        f"Input Tax Credit appears blocked under CGST Section 17(5): {reason}. "
                        "Claiming this ITC risks audit scrutiny, mandatory reversal, and 18% p.a. interest."
                    ),
                    suggestion="Route to Table 4(B)(1) Ineligible ITC in GSTR-3B rather than claiming in Table 4(A).",
                    rule_reference="CGST Section 17(5)",
                )
            )
            break
    return findings


def check_place_of_supply(
    parsed_data: Dict[str, Any], business: Optional[Any] = None
) -> List[Finding]:
    """Validates Place of Supply (PoS) and tax type routing (CGST+SGST vs IGST)."""
    findings = []
    vendor_gstin = str(parsed_data.get("vendor_gstin") or "").strip().upper()
    taxpayer_gstin = getattr(business, "gstin", "") or str(parsed_data.get("buyer_gstin") or "").strip().upper()

    if not taxpayer_gstin and parsed_data.get("buyer_state_code"):
        taxpayer_gstin = str(parsed_data["buyer_state_code"]) + "AAPCA1234F1Z5"

    if len(vendor_gstin) >= 2 and len(taxpayer_gstin) >= 2:
        vendor_state = vendor_gstin[:2]
        buyer_state = taxpayer_gstin[:2]

        igst = float(parsed_data.get("igst_amount") or parsed_data.get("igst") or 0.0)
        cgst = float(parsed_data.get("cgst_amount") or parsed_data.get("cgst") or 0.0)
        sgst = float(parsed_data.get("sgst_amount") or parsed_data.get("sgst") or 0.0)

        # Same state: Intra-state -> Expect CGST + SGST, no IGST
        if vendor_state == buyer_state:
            if igst > 10.0 and (cgst == 0.0 or sgst == 0.0):
                findings.append(
                    Finding(
                        title="Place of Supply Error: Incorrect IGST on Intra-State Supply",
                        severity="high",
                        description=(
                            f"Supplier GSTIN starts with '{vendor_state}' and Buyer GSTIN starts with '{buyer_state}' (Intra-state), "
                            f"but IGST of ₹{igst:,.2f} was charged instead of CGST + SGST."
                        ),
                        suggestion="Request the supplier to cancel this invoice or issue a credit note and re-issue with CGST and SGST.",
                        rule_reference="CGST Section 9 & IGST Section 7",
                    )
                )
        else:
            # Different state: Inter-state -> Expect IGST, no CGST + SGST
            if (cgst > 10.0 or sgst > 10.0) and igst == 0.0:
                findings.append(
                    Finding(
                        title="Place of Supply Error: Incorrect CGST/SGST on Inter-State Supply",
                        severity="high",
                        description=(
                            f"Supplier GSTIN starts with '{vendor_state}' (Inter-state supply to '{buyer_state}'), "
                            f"but local CGST/SGST was charged instead of IGST."
                        ),
                        suggestion="CGST/SGST of another state cannot be claimed as ITC. Request the supplier to amend the bill with IGST.",
                        rule_reference="IGST Section 8 & CGST Section 12",
                    )
                )
    return findings


def check_180_day_payment(parsed_data: Dict[str, Any]) -> List[Finding]:
    """Detects vendor invoices unpaid beyond 180 days requiring mandatory ITC reversal."""
    findings = []
    inv_date_str = parsed_data.get("invoice_date") or parsed_data.get("date")
    is_paid = parsed_data.get("is_paid", False) or parsed_data.get("paid", False)
    days_unpaid = parsed_data.get("days_unpaid")

    if days_unpaid is not None:
        try:
            if int(days_unpaid) > 180 and not is_paid:
                findings.append(
                    Finding(
                        title="Section 16(2) 180-Day Payment Overdue — Mandatory ITC Reversal",
                        severity="high",
                        description=(
                            f"Invoice is {days_unpaid} days overdue and remains unpaid. Under the second proviso to "
                            "Section 16(2), if payment is not made to the supplier within 180 days, the ITC must be "
                            "reversed with 18% annual interest under Rule 37."
                        ),
                        suggestion="Mark invoice as paid if settled, or record ITC reversal in Table 4(B)(2) of GSTR-3B.",
                        rule_reference="CGST Section 16(2) Proviso & Rule 37",
                    )
                )
        except Exception:
            pass

    elif inv_date_str and not is_paid:
        try:
            from datetime import date, datetime
            if "-" in inv_date_str:
                parts = inv_date_str.split("-")
                if len(parts[0]) == 4:
                    dt = datetime.strptime(inv_date_str, "%Y-%m-%d").date()
                else:
                    dt = datetime.strptime(inv_date_str, "%d-%m-%Y").date()
                days_old = (date.today() - dt).days
                if days_old > 180:
                    findings.append(
                        Finding(
                            title="Section 16(2) 180-Day Payment Overdue — Mandatory ITC Reversal",
                            severity="high",
                            description=(
                                f"Invoice is {days_old} days old and remains unpaid. Under the second proviso to "
                                "Section 16(2), if payment is not made to the supplier within 180 days, the ITC must be "
                                "reversed with 18% annual interest under Rule 37."
                            ),
                            suggestion="Mark invoice as paid if settled, or record ITC reversal in Table 4(B)(2) of GSTR-3B.",
                            rule_reference="CGST Section 16(2) Proviso & Rule 37",
                        )
                    )
        except Exception:
            pass
    return findings


def check_duplicate_invoice(
    parsed_data: Dict[str, Any], history: Optional[List[Dict[str, Any]]] = None
) -> List[Finding]:
    """Detects duplicate invoice submissions from the same vendor."""
    findings = []
    if history:
        inv_no = str(parsed_data.get("invoice_no") or parsed_data.get("invoice_number") or "").strip().upper()
        gstin = str(parsed_data.get("vendor_gstin") or "").strip().upper()
        if inv_no and gstin:
            for h in history:
                h_inv_no = str(h.get("invoice_no") or h.get("invoice_number") or "").strip().upper()
                h_gstin = str(h.get("vendor_gstin") or "").strip().upper()
                if h_inv_no == inv_no and h_gstin == gstin:
                    findings.append(
                        Finding(
                            title="Duplicate Invoice Submission Detected",
                            severity="high",
                            description=f"Invoice '{inv_no}' from supplier '{gstin}' was already processed in this batch.",
                            suggestion="Verify whether this invoice was already recorded to avoid double-claiming ITC.",
                            rule_reference="CGST Rule 36 & Anti-Fraud Guidelines",
                        )
                    )
                    break
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
        if k != "history" and k not in parsed_data:
            parsed_data[k] = v

    if known_2b_gstins is None:
        known_2b_gstins = set()

    findings: List[Finding] = []
    findings.extend(check_gstin_validity(parsed_data))
    findings.extend(check_tax_calculation(parsed_data))
    findings.extend(check_2b_reconciliation(parsed_data, known_2b_gstins, business=business))
    findings.extend(check_buyer_taxpayer_match(parsed_data, business=business))
    if parsed_data.get("document_type") != "sales":
        findings.extend(check_section_17_5_blocked_itc(parsed_data))
    findings.extend(check_place_of_supply(parsed_data, business=business))
    findings.extend(check_180_day_payment(parsed_data))
    history = kwargs.get("history") or parsed_data.get("history")
    findings.extend(check_duplicate_invoice(parsed_data, history=history))

    score = calculate_compliance_score(findings)
    risk = risk_from_findings(findings)
    status = "validated" if score >= 85 else "flagged"

    return {
        "findings": findings,
        "compliance_score": score,
        "risk": risk,
        "status": status,
    }