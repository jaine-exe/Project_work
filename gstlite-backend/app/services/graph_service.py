from typing import TypedDict, List, Dict, Any, Optional
from langgraph.graph import StateGraph, END

from app.services import ocr_service, compliance_engine
from app.services.ai_service import ValidationAgent, ComplianceAgent, RiskAgent


# 1. Define the Graph State (Holds data passed between nodes)
class InvoiceWorkflowState(TypedDict):
    file_path: str
    known_2b_gstins: set[str]
    extracted: Optional[Any]
    findings: List[compliance_engine.Finding]
    risk: str
    status: str


# Initialize agents
validation_agent = ValidationAgent()
compliance_agent = ComplianceAgent()
risk_agent = RiskAgent()


# 2. Node Functions
def extract_node(state: InvoiceWorkflowState) -> Dict[str, Any]:
    """Scans and extracts data from file using OCR/PDF parser."""
    extracted_data = ocr_service.extract(state["file_path"])
    validated_data = validation_agent.run(extracted_data)
    return {"extracted": validated_data}


def compliance_node(state: InvoiceWorkflowState) -> Dict[str, Any]:
    """Runs compliance rules against extracted data."""
    extracted = state["extracted"]
    known_2b = state.get("known_2b_gstins", set())
    findings = compliance_agent.run(extracted, known_2b)
    return {"findings": findings}


def risk_node(state: InvoiceWorkflowState) -> Dict[str, Any]:
    """Evaluates findings to assign risk and status levels."""
    findings = state["findings"]
    risk, status = risk_agent.run(findings)
    return {"risk": risk, "status": status}


# 3. Build the LangGraph StateGraph
builder = StateGraph(InvoiceWorkflowState)

builder.add_node("extract", extract_node)
builder.add_node("compliance", compliance_node)
builder.add_node("risk", risk_node)

builder.set_entry_point("extract")
builder.add_edge("extract", "compliance")
builder.add_edge("compliance", "risk")
builder.add_edge("risk", END)

# Compile the workflow execution graph
invoice_graph = builder.compile()


def process_invoice_with_langgraph(file_path: str, known_2b_gstins: set[str] | None = None) -> Dict[str, Any]:
    """Entry point function replacing ManagerAgent.process_invoice."""
    initial_state: InvoiceWorkflowState = {
        "file_path": file_path,
        "known_2b_gstins": known_2b_gstins or set(),
        "extracted": None,
        "findings": [],
        "risk": "low",
        "status": "validated",
    }
    
    # Execute graph from start to end
    final_state = invoice_graph.invoke(initial_state)
    extracted = final_state["extracted"]

    return {
        "vendor_name": getattr(extracted, "vendor_name", None),
        "vendor_gstin": getattr(extracted, "vendor_gstin", None),
        "invoice_date": getattr(extracted, "invoice_date", None),
        "amount": getattr(extracted, "amount", None) or getattr(extracted, "total_amount", None),
        "tax_rate": getattr(extracted, "tax_rate", None),
        "hsn_code": getattr(extracted, "hsn_code", None),
        "findings": final_state["findings"],
        "risk": final_state["risk"],
        "status": final_state["status"],
    }