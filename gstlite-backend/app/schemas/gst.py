from pydantic import BaseModel


class TaxSlab(BaseModel):
    rate: float
    taxable_value: float
    tax_amount: float


class GstSummaryOut(BaseModel):
    period: str
    output_tax_liability: float
    input_tax_credit: float
    net_payable: float
    flagged_invoice_count: float
    tax_slabs: list[TaxSlab]


class GenerateReturnRequest(BaseModel):
    period: str  # "2026-07"
    return_type: str = "GSTR-3B"  # "GSTR-1" | "GSTR-3B"


class GstReturnOut(BaseModel):
    id: str
    period: str
    return_type: str
    output_tax_liability: float
    input_tax_credit: float
    net_payable: float
    is_filed: bool
    payload: dict

    class Config:
        from_attributes = True


class ChatRequest(BaseModel):
    message: str
    invoice_id: str | None = None


class ChatMessageOut(BaseModel):
    role: str
    content: str

    class Config:
        from_attributes = True
