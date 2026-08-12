from datetime import datetime

from pydantic import BaseModel


class ComplianceIssueOut(BaseModel):
    id: str
    title: str
    severity: str
    description: str
    suggestion: str
    rule_reference: str

    class Config:
        from_attributes = True


class InvoiceOut(BaseModel):
    id: str
    display_id: str
    original_filename: str
    status: str
    risk: str
    vendor_name: str | None = None
    vendor_gstin: str | None = None
    invoice_date: str | None = None
    amount: float | None = None
    tax_rate: float | None = None
    hsn_code: str | None = None
    processing_error: str | None = None
    created_at: datetime
    issues: list[ComplianceIssueOut] = []

    class Config:
        from_attributes = True


class InvoiceListOut(BaseModel):
    invoices: list[InvoiceOut]
    total: int
