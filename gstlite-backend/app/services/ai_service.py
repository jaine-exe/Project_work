import os
import re
from typing import Any, Dict, List, Optional
from pydantic import BaseModel
from dotenv import load_dotenv

from app.services.compliance_engine import run_all_checks
from app.services.ocr_service import extract_text_from_pdf

load_dotenv()


class PipelineResult(BaseModel):
    vendor_name: Optional[str] = None
    vendor_gstin: Optional[str] = None
    invoice_date: Optional[str] = None
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
        self, file_path: str, known_2b_gstins: Optional[Any] = None
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
            print("--- EXTRACTED INVOICE TEXT ---")
            print(extracted_text)
            print("------------------------------")
        except Exception as err:
            print(f"[OCR ERROR] {err}")

        vendor_name = None
        vendor_gstin = None
        invoice_date = None
        amount = None
        tax_rate = 18.0
        hsn_code = None

        if extracted_text:
            gstin_match = re.search(
                r"\b[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}\b",
                extracted_text,
            )
            if gstin_match:
                vendor_gstin = gstin_match.group(0)

            total_match = re.search(
                r"(?:Grand Total|Total Amount|Total|Amount Payable)[\s:]*₹?\s*([\d,]+\.?\d*)",
                extracted_text,
                re.IGNORECASE,
            )
            if total_match:
                try:
                    amount = float(total_match.group(1).replace(",", ""))
                except ValueError:
                    pass

            vendor_match = re.search(
                r"([A-Z0-9\s&\.\'-]+(?:Pvt\.?\s*Ltd\.?|Private Limited|Limited|Inc\.?|Traders|Enterprise|Services))",
                extracted_text,
                re.IGNORECASE,
            )
            if vendor_match:
                vendor_name = vendor_match.group(1).strip()

            date_match = re.search(
                r"\b(\d{2}[-/\.]\d{2}[-/\.]\d{4}|\d{4}[-/\.]\d{2}[-/\.]\d{2})\b",
                extracted_text,
            )
            if date_match:
                invoice_date = date_match.group(1)

        if not vendor_name:
            filename = os.path.basename(file_path).replace(".pdf", "").replace("_", " ").title()
            vendor_name = f"Vendor ({filename})"

        parsed_data = {
            "vendor_name": vendor_name,
            "vendor_gstin": vendor_gstin,
            "invoice_date": invoice_date,
            "amount": amount,
            "tax_rate": tax_rate,
            "hsn_code": hsn_code,
            "extracted_text": extracted_text,
        }

        compliance_res = run_all_checks(parsed_data, known_2b_gstins=safe_gstins)

        return PipelineResult(
            vendor_name=vendor_name,
            vendor_gstin=vendor_gstin,
            invoice_date=invoice_date,
            amount=amount,
            tax_rate=tax_rate,
            hsn_code=hsn_code,
            status=compliance_res.get("status", "validated"),
            risk=compliance_res.get("risk", "low"),
            compliance_score=compliance_res.get("compliance_score", 100),
            findings=compliance_res.get("findings", []),
        )


def answer_question(question: str, context: Optional[str] = None) -> str:
    groq_key = os.getenv("GROQ_API_KEY")
    openai_key = os.getenv("OPENAI_API_KEY")

    system_prompt = (
        "You are a concise, helpful Indian GST Tax Assistant.\n\n"
        "Strict Communication Rules:\n"
        "- Match the user's energy and length. If the user says something simple like 'ok', 'thanks', or 'hi', respond in 1 short sentence.\n"
        "- Do NOT provide a full summary of all invoices unless the user specifically asks for a summary or list.\n"
        "- Keep answers brief, direct, and conversational.\n"
        "- Always output each bullet point on its own new line using proper Markdown."
    )

    prompt = f"Invoice Context:\n{context or 'No context.'}\n\nUser Message: {question}"

    # 1. Groq Call
    if groq_key:
        try:
            from groq import Groq
            client = Groq(api_key=groq_key)
            completion = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.5,
                max_tokens=300,  # Limits lengthy outputs
            )
            return completion.choices[0].message.content
        except Exception as err:
            print(f"[GROQ ERROR] {err}")

    # 2. OpenAI Call
    if openai_key:
        try:
            import openai
            client = openai.OpenAI(api_key=openai_key)
            completion = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.5,
                max_tokens=300,
            )
            return completion.choices[0].message.content
        except Exception as err:
            print(f"[OPENAI ERROR] {err}")

    # Fallback for simple inputs
    q_lower = question.lower().strip()
    if q_lower in ["ok", "okay", "thanks", "thank you", "got it"]:
        return "Sounds good! Let me know if you need help with any specific invoice or filing."

    return "I'm here to help with your GST invoices and compliance. What would you like to check?"