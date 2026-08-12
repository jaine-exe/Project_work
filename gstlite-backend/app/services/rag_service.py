import os
import chromadb
from chromadb.utils import embedding_functions

# Initialize persistent local ChromaDB
CHROMA_PATH = os.path.join(os.getcwd(), "chroma_db")
client = chromadb.PersistentClient(path=CHROMA_PATH)
default_ef = embedding_functions.DefaultEmbeddingFunction()

collection = client.get_or_create_collection(
    name="gst_knowledge_base",
    embedding_function=default_ef
)


def populate_initial_gst_rules():
    """Seeds ChromaDB with essential Indian GST legal sections if empty."""
    if collection.count() > 0:
        return

    documents = [
        "Section 16(2) of CGST Act: No registered person shall be entitled to Input Tax Credit unless the tax charged in respect of such supply has been paid to the Government and the invoice appears in GSTR-2B.",
        "Section 17(5) Blocked Credits: Input Tax Credit shall not be available for motor vehicles, food and beverages, outdoor catering, beauty treatment, and health services.",
        "Rule 36(4) of CGST Rules: Input Tax Credit to be availed by a registered person in respect of invoices not uploaded by suppliers in GSTR-1 is restricted.",
        "Section 31 Tax Invoice: A valid tax invoice must contain a 15-digit GSTIN, date, consecutive invoice number, HSN code, taxable value, and applicable tax rates."
    ]
    
    ids = [f"doc_{i}" for i in range(len(documents))]
    collection.add(documents=documents, ids=ids)


def query_gst_knowledge_base(user_query: str) -> str:
    """Retrieves relevant GST legal sections matching user chat question."""
    try:
        populate_initial_gst_rules()
        results = collection.query(query_texts=[user_query], n_results=2)
        if results and results.get("documents"):
            return "\n\n".join(results["documents"][0])
    except Exception as e:
        print(f"[RAG ERROR] {e}")
    return ""