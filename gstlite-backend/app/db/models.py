import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


def gen_uuid() -> str:
    return str(uuid.uuid4())


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class DocumentType(str, enum.Enum):
    sales = "sales"
    purchase = "purchase"


class InvoiceStatus(str, enum.Enum):
    uploaded = "uploaded"
    parsed = "parsed"
    validated = "validated"
    risk = "risk"
    flagged = "flagged"
    filed = "filed"
    failed = "failed"


class RiskLevel(str, enum.Enum):
    unscored = "unscored"
    low = "low"
    medium = "medium"
    high = "high"


class IssueSeverity(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    email: Mapped[str] = mapped_column(String, unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String)
    full_name: Mapped[str] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    business: Mapped["Business"] = relationship(
        back_populates="owner", uselist=False, cascade="all, delete-orphan"
    )


class Business(Base):
    __tablename__ = "businesses"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    name: Mapped[str] = mapped_column(String)
    gstin: Mapped[str] = mapped_column(String, unique=True, index=True)
    state: Mapped[str] = mapped_column(String, default="")
    scheme: Mapped[str] = mapped_column(String, default="Regular")

    owner: Mapped["User"] = relationship(back_populates="business")
    invoices: Mapped[list["Invoice"]] = relationship(
        back_populates="business", cascade="all, delete-orphan"
    )


class Invoice(Base):
    __tablename__ = "invoices"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    business_id: Mapped[str] = mapped_column(ForeignKey("businesses.id"))

    display_id: Mapped[str] = mapped_column(String)  # e.g. INV-2026-0731
    file_path: Mapped[str] = mapped_column(String)
    original_filename: Mapped[str] = mapped_column(String)

    document_type: Mapped[DocumentType] = mapped_column(
        Enum(DocumentType), default=DocumentType.purchase, nullable=False
    )
    status: Mapped[InvoiceStatus] = mapped_column(
        Enum(InvoiceStatus), default=InvoiceStatus.uploaded
    )
    risk: Mapped[RiskLevel] = mapped_column(Enum(RiskLevel), default=RiskLevel.unscored)
    compliance_score: Mapped[int] = mapped_column(Integer, default=100)

    # Extracted / parsed fields (filled in by the OCR + AI pipeline)
    vendor_name: Mapped[str | None] = mapped_column(String, nullable=True)
    vendor_gstin: Mapped[str | None] = mapped_column(String, nullable=True)
    invoice_date: Mapped[str | None] = mapped_column(String, nullable=True)
    amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    tax_rate: Mapped[float | None] = mapped_column(Float, nullable=True)
    hsn_code: Mapped[str | None] = mapped_column(String, nullable=True)

    processing_error: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    business: Mapped["Business"] = relationship(back_populates="invoices")
    issues: Mapped[list["ComplianceIssue"]] = relationship(
        back_populates="invoice", cascade="all, delete-orphan"
    )


class ComplianceIssue(Base):
    __tablename__ = "compliance_issues"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    invoice_id: Mapped[str] = mapped_column(ForeignKey("invoices.id"))

    title: Mapped[str] = mapped_column(String)
    severity: Mapped[IssueSeverity] = mapped_column(Enum(IssueSeverity))
    description: Mapped[str] = mapped_column(Text)
    suggestion: Mapped[str] = mapped_column(Text)
    rule_reference: Mapped[str] = mapped_column(String)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    invoice: Mapped["Invoice"] = relationship(back_populates="issues")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    business_id: Mapped[str] = mapped_column(ForeignKey("businesses.id"))
    role: Mapped[str] = mapped_column(String)  # "user" | "assistant"
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class GstReturn(Base):
    __tablename__ = "gst_returns"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    business_id: Mapped[str] = mapped_column(ForeignKey("businesses.id"))

    period: Mapped[str] = mapped_column(String)  # e.g. "2026-07"
    return_type: Mapped[str] = mapped_column(String)  # "GSTR-1" | "GSTR-3B"

    output_tax_liability: Mapped[float] = mapped_column(Float, default=0)
    input_tax_credit: Mapped[float] = mapped_column(Float, default=0)
    net_payable: Mapped[float] = mapped_column(Float, default=0)

    payload_json: Mapped[str] = mapped_column(Text)  # full generated return, as JSON
    is_filed: Mapped[bool] = mapped_column(Boolean, default=False)

    generated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)