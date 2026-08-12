import os
from typing import Optional


def extract_text_from_pdf(file_path: str) -> str:
    """
    Extracts text content from a PDF file safely.
    """
    if not os.path.exists(file_path):
        return ""

    text_content = ""

    # Primary PDF extraction
    try:
        import pypdf
        reader = pypdf.PdfReader(file_path)
        for page in reader.pages:
            extracted = page.extract_text()
            if extracted:
                text_content += extracted + "\n"
        if text_content.strip():
            return text_content
    except Exception as err:
        print(f"[pypdf Extract Error] {err}")

    # Fallback to direct file reading
    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            text_content = f.read()
    except Exception as err:
        print(f"[Raw Read Error] {err}")

    return text_content