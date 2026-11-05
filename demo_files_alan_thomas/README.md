# Demo Files & Test Invoices for Alan Thomas (Alan Enterprises Pvt Ltd)

**Entity Name:** Alan Enterprises Pvt Ltd  
**GSTIN:** `32AAECS1234F1Z5`  
**State:** Kerala (32)  
**Tax Period:** August 2026 (`2026-08`)

---

## 📁 Files in this Folder

### 1. Purchase Invoices (Upload in `/upload` -> "Purchase (ITC)")
| File | Vendor & GSTIN | Taxable & Tax | Purpose & Expected Behavior |
| :--- | :--- | :--- | :--- |
| **`Purchase_01_MalabarDyes_MATCHED.pdf`** | Malabar Dyes & Chemical Co.<br/>`32AACCA1234F1Z5` | ₹50,000 + ₹9,000 (CGST/SGST 18%) | **Clean Match:** Matches with GSTR-2B. ITC eligible under Section 16. |
| **`Purchase_02_ApexTech_MISMATCHED_GSTIN.pdf`** | Apex Tech Hardware<br/>`32ABCDE9999F1Z0` | ₹60,000 + ₹10,800 (CGST/SGST 18%) | **Rule 36(4) Risk:** Vendor GSTIN on invoice doesn't match vendor in 2B (`32ABCDE1234F1Z5`). Flagged in red! |
| **`Purchase_03_MysoreTimber_INTERSTATE_IGST.pdf`** | Mysore Timber Works<br/>`29AABFM3345L1Z2` | ₹84,000 + ₹15,120 (IGST 18%) | **Interstate IGST:** Originates in Karnataka (29), delivered to Kerala (32). Matches 2B. |
| **`Purchase_04_KochiMotors_BLOCKED_ITC_17_5.pdf`** | Kochi Auto Hub Pvt Ltd<br/>`32AABCK9988D1Z4` | ₹1,20,000 + ₹21,600 (CGST/SGST 18%) | **Blocked Credit:** Executive passenger motor vehicle. Engine tags blocked under Section 17(5). |

---

### 2. Sales Invoices (Upload in `/upload` -> "Sales" OR view in `/invoicing`)
| File | Recipient & GSTIN | Taxable & Tax | Purpose & Expected Behavior |
| :--- | :--- | :--- | :--- |
| **`Sales_01_CochinBuilders_EINVOICE.pdf`** | Cochin Builders Ltd<br/>`32AABCB4321A1Z1` | ₹1,50,000 + ₹27,000 (CGST/SGST 18%) | **E-Invoice with IRN:** Outward taxable supply. Confirms IRN stamp and updates outward liability. |
| **`Sales_02_CalicutRetail_B2B.pdf`** | Calicut Retail Enterprises<br/>`32AADCC5566K1Z9` | ₹80,000 + ₹14,400 (CGST/SGST 18%) | **Standard B2B Sales:** Adds ₹14,400 to Output Tax Liability on Dashboard. |

---

### 3. GSTR-2B Official Portal JSON
* **File:** **`GSTR2B_AlanEnterprises_32AAECS1234F1Z5_August2026.json`**
* **Usage:**
  * Go to **Compliance & ITC** (`/compliance`) $\rightarrow$ Click **"Upload GSTR-2B JSON"** (or in `/mock-portal`).
  * Select this file.
  * Ingests 3 official supplier filings:
    1. Malabar Dyes (`INV-2026-0729`) $\rightarrow$ **Matched**
    2. Mysore Timber (`MTW/26-27/0318`) $\rightarrow$ **Matched**
    3. Southern Steel Tubes (`SST-2026-441`) $\rightarrow$ **Unclaimed Opportunity in Books** (Supplier filed, but Alan hasn't entered invoice yet!)

