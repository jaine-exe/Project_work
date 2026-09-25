import os
import re
from typing import Any, Dict, List, Optional
from pydantic import BaseModel
from dotenv import load_dotenv

from app.services.compliance_engine import run_all_checks
from app.services.invoice_parser import parse_invoice_text
from app.services.ocr_service import extract_text_from_pdf

load_dotenv()


class PipelineResult(BaseModel):
    invoice_number: Optional[str] = None
    vendor_name: Optional[str] = None
    vendor_gstin: Optional[str] = None
    buyer_name: Optional[str] = None
    buyer_gstin: Optional[str] = None
    invoice_date: Optional[str] = None
    taxable_amount: Optional[float] = None
    cgst_amount: Optional[float] = None
    sgst_amount: Optional[float] = None
    igst_amount: Optional[float] = None
    total_tax: Optional[float] = None
    total_amount: Optional[float] = None
    amount: Optional[float] = None
    tax_rate: Optional[float] = None
    hsn_code: Optional[str] = None
    status: str = "validated"
    risk: str = "low"
    compliance_score: int = 100
    findings: List[Any] = []


class ManagerAgent:
    def __init__(self):
        pass

    def process_invoice(
        self,
        file_path: str,
        known_2b_gstins: Optional[Any] = None,
        business: Optional[Any] = None,
    ) -> PipelineResult:
        safe_gstins = set()
        if known_2b_gstins:
            if isinstance(known_2b_gstins, (set, list, tuple)):
                for item in known_2b_gstins:
                    if isinstance(item, (tuple, list)):
                        if len(item) > 0 and item[0]:
                            safe_gstins.add(str(item[0]))
                    elif item:
                        safe_gstins.add(str(item))
            elif isinstance(known_2b_gstins, str):
                safe_gstins.add(known_2b_gstins)

        extracted_text = ""
        try:
            extracted_text = extract_text_from_pdf(file_path)
            print("--- EXTRACTED INVOICE TEXT LENGTH:", len(extracted_text))
        except Exception as err:
            print(f"[OCR ERROR] {err}")

        parsed_data = parse_invoice_text(extracted_text)
        if not parsed_data.get("vendor_name"):
            filename = os.path.basename(file_path).replace(".pdf", "").replace("_", " ").title()
            parsed_data["vendor_name"] = f"Vendor ({filename})"

        parsed_data["extracted_text"] = extracted_text

        compliance_res = run_all_checks(
            parsed_data,
            known_2b_gstins=safe_gstins,
            business=business,
        )

        return PipelineResult(
            invoice_number=parsed_data.get("invoice_number"),
            vendor_name=parsed_data.get("vendor_name"),
            vendor_gstin=parsed_data.get("vendor_gstin"),
            buyer_name=parsed_data.get("buyer_name"),
            buyer_gstin=parsed_data.get("buyer_gstin"),
            invoice_date=parsed_data.get("invoice_date"),
            taxable_amount=parsed_data.get("taxable_amount"),
            cgst_amount=parsed_data.get("cgst_amount"),
            sgst_amount=parsed_data.get("sgst_amount"),
            igst_amount=parsed_data.get("igst_amount"),
            total_tax=parsed_data.get("total_tax"),
            total_amount=parsed_data.get("total_amount"),
            amount=parsed_data.get("amount") or parsed_data.get("total_amount"),
            tax_rate=parsed_data.get("tax_rate", 18.0),
            hsn_code=parsed_data.get("hsn_code"),
            status=compliance_res.get("status", "validated"),
            risk=compliance_res.get("risk", "low"),
            compliance_score=compliance_res.get("compliance_score", 100),
            findings=compliance_res.get("findings", []),
        )


_CACHED_GROQ_MODEL: Optional[str] = None


def _get_working_groq_model(client: Any) -> str:
    global _CACHED_GROQ_MODEL
    if _CACHED_GROQ_MODEL:
        return _CACHED_GROQ_MODEL

    configured_model = os.getenv("GROQ_MODEL")
    candidates = [
        configured_model,
        "openai/gpt-oss-120b",
        "llama-3.3-70b-versatile",
        "qwen/qwen3.8-27b",
        "llama-3.1-8b-instant",
        "openai/gpt-oss-20b",
    ]
    candidates = [c for c in candidates if c]

    try:
        models_data = client.models.list().data
        available_ids = {m.id for m in models_data}
        for cand in candidates:
            if cand in available_ids:
                _CACHED_GROQ_MODEL = cand
                return cand
        for m in models_data:
            if "whisper" not in m.id and "guard" not in m.id:
                _CACHED_GROQ_MODEL = m.id
                return m.id
    except Exception as err:
        print(f"[GROQ MODEL LIST ERROR] {err}")

    _CACHED_GROQ_MODEL = configured_model or "openai/gpt-oss-120b"
    return _CACHED_GROQ_MODEL


def answer_question(
    question: str,
    context: Optional[str] = None,
    history: Optional[List[Dict[str, str]]] = None,
) -> str:
    groq_key = os.getenv("GROQ_API_KEY")
    openai_key = os.getenv("OPENAI_API_KEY")

    system_prompt = (
        "You are an expert Indian GST Tax and Compliance Assistant.\n\n"
        "Communication Rules:\n"
        "- If the user says a greeting ('hi', 'hello', 'hlo') or simple acknowledgment ('ok', 'thanks'), respond briefly and warmly.\n"
        "- Only reference the invoice context if the user's question relates to their specific invoices, vendors, or filing records. For general GST principles, definitions, or queries, explain clearly without forcing invoice details.\n"
        "- Provide direct, clear, actionable explanations.\n"
        "- Format bullet points cleanly on new lines using Markdown."
    )

    messages: List[Dict[str, str]] = [{"role": "system", "content": system_prompt}]
    if context:
        messages.append({"role": "system", "content": f"Invoice Context:\n{context}"})
    if history:
        for msg in history[-6:]:
            role = msg.get("role")
            content = msg.get("content")
            if role in ("user", "assistant") and content:
                messages.append({"role": role, "content": content})
    messages.append({"role": "user", "content": question})

    # 1. Groq Call
    if groq_key:
        try:
            from groq import Groq
            client = Groq(api_key=groq_key)
            model_name = _get_working_groq_model(client)
            completion = client.chat.completions.create(
                model=model_name,
                messages=messages,
                temperature=0.5,
                max_tokens=800,
            )
            content = completion.choices[0].message.content
            if content and content.strip():
                return content.strip()
        except Exception as err:
            print(f"[GROQ ERROR] {err}")

    # 2. OpenAI Call
    if openai_key:
        try:
            import openai
            client = openai.OpenAI(api_key=openai_key)
            completion = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                temperature=0.5,
                max_tokens=800,
            )
            content = completion.choices[0].message.content
            if content and content.strip():
                return content.strip()
        except Exception as err:
            print(f"[OPENAI ERROR] {err}")

    # Fallback if no LLM is reachable
    q_lower = question.lower().strip()
    if q_lower in ["ok", "okay", "thanks", "thank you", "got it"]:
        return "Sounds good! Let me know if you need help with any specific invoice or filing."
    if any(q_lower.startswith(g) for g in ["hi", "hello", "hey", "hlo"]):
        return "Hello! I am your GST Tax Assistant. How can I help you with your invoices or GST compliance today?"
    if "itc" in q_lower or "input tax credit" in q_lower:
        return (
            "**Input Tax Credit (ITC)** allows you to deduct the GST you've paid on business purchases "
            "from the GST you collect on sales.\n\n"
            "Key requirements under Section 16:\n"
            "- You must hold a valid tax invoice.\n"
            "- The supplier must have reported the invoice in their GSTR-1 (so it appears in your GSTR-2B).\n"
            "- The goods or services must have been received.\n"
            "- Tax must have been deposited with the government and GSTR-3B filed."
        )
    if any(k in q_lower for k in ["penalty", "late fee", "dont pay", "don't pay"]):
        return (
            "**Consequences of Not Paying GST or Late Filing:**\n\n"
            "- **Interest**: 18% per annum on unpaid tax liabilities.\n"
            "- **Late fee**: ₹50/day (₹20/day for nil returns) under Section 47.\n"
            "- **Penalty**: Up to 10% of tax due (minimum ₹10,000) for delay; 100% for willful evasion.\n"
            "- **Compliance impact**: E-way bill generation and filing may be blocked."
        )

    return "I'm here to help with your GST invoices, ITC reconciliation, and compliance rules. You can ask about specific invoice flags, GSTR-1/3B filing, or GST regulations."