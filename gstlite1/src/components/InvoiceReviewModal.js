"use client";

import { useState, useEffect } from "react";
import { X, CheckCircle2, AlertTriangle, FileText, Loader2, Save, ExternalLink } from "lucide-react";
import { invoices as invoicesApi } from "@/lib/api";
import StatusPill from "@/components/StatusPill";

function getInitialFormData(inv) {
  return {
    invoice_number: inv?.invoice_number ?? "",
    invoice_date: inv?.invoice_date ?? "",
    document_type: inv?.document_type ?? "purchase",
    vendor_name: inv?.vendor_name ?? "",
    vendor_gstin: inv?.vendor_gstin ?? "",
    buyer_name: inv?.buyer_name ?? "",
    buyer_gstin: inv?.buyer_gstin ?? "",
    taxable_amount: inv?.taxable_amount ?? inv?.amount ?? "",
    tax_rate: inv?.tax_rate ?? 18.0,
    cgst_amount: inv?.cgst_amount ?? "",
    sgst_amount: inv?.sgst_amount ?? "",
    igst_amount: inv?.igst_amount ?? "",
    total_tax: inv?.total_tax ?? "",
    total_amount: inv?.total_amount ?? inv?.amount ?? "",
    hsn_code: inv?.hsn_code ?? "",
  };
}

export default function InvoiceReviewModal({ invoice, isOpen, onClose, onSaveSuccess }) {
  const [formData, setFormData] = useState(() => getInitialFormData(invoice));
  const [fileUrl, setFileUrl] = useState(null);
  const [loadingFile, setLoadingFile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!invoice) return;
    setFormData(getInitialFormData(invoice));
    setError("");

    // Load file blob for in-browser preview
    let objectUrl = null;
    setLoadingFile(true);
    invoicesApi
      .getFileBlob(invoice.id)
      .then((blob) => {
        objectUrl = window.URL.createObjectURL(blob);
        setFileUrl(objectUrl);
      })
      .catch((err) => {
        console.warn("Could not preview invoice file:", err);
        setFileUrl(null);
      })
      .finally(() => {
        setLoadingFile(false);
      });

    return () => {
      if (objectUrl) {
        window.URL.revokeObjectURL(objectUrl);
      }
    };
  }, [invoice]);

  if (!isOpen || !invoice) return null;

  function handleChange(field, val) {
    setFormData((prev) => {
      const next = { ...prev, [field]: val };

      // Auto recalculate tax if taxable_amount or tax_rate changed
      if (field === "taxable_amount" || field === "tax_rate") {
        const taxable = parseFloat(next.taxable_amount) || 0;
        const rate = parseFloat(next.tax_rate) || 0;
        const totalTax = (taxable * rate) / 100;
        const half = totalTax / 2;
        next.cgst_amount = parseFloat(half.toFixed(2));
        next.sgst_amount = parseFloat(half.toFixed(2));
        next.total_tax = parseFloat(totalTax.toFixed(2));
        next.total_amount = parseFloat((taxable + totalTax).toFixed(2));
      }

      return next;
    });
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const payload = {
        invoice_number: formData.invoice_number || null,
        invoice_date: formData.invoice_date || null,
        document_type: formData.document_type || "purchase",
        vendor_name: formData.vendor_name || null,
        vendor_gstin: formData.vendor_gstin || null,
        buyer_name: formData.buyer_name || null,
        buyer_gstin: formData.buyer_gstin || null,
        taxable_amount: formData.taxable_amount ? parseFloat(formData.taxable_amount) : null,
        cgst_amount: formData.cgst_amount ? parseFloat(formData.cgst_amount) : null,
        sgst_amount: formData.sgst_amount ? parseFloat(formData.sgst_amount) : null,
        igst_amount: formData.igst_amount ? parseFloat(formData.igst_amount) : null,
        total_tax: formData.total_tax ? parseFloat(formData.total_tax) : null,
        total_amount: formData.total_amount ? parseFloat(formData.total_amount) : null,
        amount: formData.total_amount ? parseFloat(formData.total_amount) : null,
        tax_rate: formData.tax_rate ? parseFloat(formData.tax_rate) : null,
        hsn_code: formData.hsn_code || null,
      };

      const updated = await invoicesApi.update(invoice.id, payload);
      if (onSaveSuccess) onSaveSuccess(updated);
      onClose();
    } catch (err) {
      setError(err.message || "Failed to update invoice");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="flex flex-col w-full max-w-6xl max-h-[92vh] rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        {/* Modal Header */}
        <div
          className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{ borderBottom: "1px solid var(--border-soft)", background: "var(--surface-sunken)" }}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700">
              <FileText size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display font-bold text-base sm:text-lg" style={{ color: "var(--ink)" }}>
                  {invoice.invoice_number || invoice.display_id}
                </h3>
                <span className="font-mono-data text-xs px-2 py-0.5 rounded font-semibold" style={{ background: "var(--surface)", color: "var(--ink-soft)" }}>
                  {invoice.display_id}
                </span>
                <StatusPill tone={invoice.status} />
              </div>
              <p className="text-xs mt-0.5" style={{ color: "var(--ink-soft)" }}>
                {invoice.original_filename} · Review extracted data and verify against the source document.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-black/5 text-gray-500 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body: Split 2-Column (Preview & Form) */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 overflow-y-auto divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
          {/* Left Column: Document Preview */}
          <div className="p-5 flex flex-col h-full bg-slate-50 min-h-[350px] lg:min-h-[550px]">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Source Document Preview
              </p>
              {fileUrl && (
                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline"
                >
                  Open in tab <ExternalLink size={12} />
                </a>
              )}
            </div>

            <div className="flex-1 w-full rounded-xl border border-slate-200 bg-white overflow-hidden flex items-center justify-center">
              {loadingFile ? (
                <div className="flex flex-col items-center gap-2 p-8 text-slate-400">
                  <Loader2 size={24} className="animate-spin text-emerald-600" />
                  <p className="text-xs">Loading document preview…</p>
                </div>
              ) : fileUrl ? (
                <iframe
                  src={fileUrl}
                  title="Invoice PDF Preview"
                  className="w-full h-full min-h-[450px] border-0"
                />
              ) : (
                <div className="p-8 text-center text-slate-400">
                  <FileText size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-medium">No document preview available</p>
                  <p className="text-xs mt-1">File path: {invoice.original_filename}</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Editable Invoice Fields Form */}
          <form onSubmit={handleSave} className="p-6 flex flex-col justify-between overflow-y-auto">
            <div className="flex flex-col gap-5">
              {/* Compliance Alerts banner if flagged */}
              {invoice.issues?.length > 0 && (
                <div className="rounded-xl p-3.5 flex flex-col gap-2 bg-amber-50 border border-amber-200">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800">
                    <AlertTriangle size={14} className="text-amber-600" />
                    <span>Compliance Flags Detected ({invoice.issues.length})</span>
                  </div>
                  {invoice.issues.map((iss) => (
                    <div key={iss.id} className="text-xs bg-white/70 p-2 rounded border border-amber-100">
                      <p className="font-semibold text-slate-900">{iss.title}</p>
                      <p className="text-slate-600 mt-0.5 text-[11px]">{iss.description}</p>
                      {iss.suggestion && (
                        <p className="text-emerald-800 text-[10px] mt-0.5 font-medium">
                          Fix: {iss.suggestion}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {error && (
                <div className="p-3 rounded-lg bg-red-50 text-red-700 text-xs font-medium">
                  {error}
                </div>
              )}

              {/* Section 1: Basic Identifiers */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">
                  1. Invoice Header & Type
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Original Invoice No
                    </label>
                    <input
                      type="text"
                      value={formData.invoice_number ?? ""}
                      onChange={(e) => handleChange("invoice_number", e.target.value)}
                      className="w-full text-xs font-mono-data px-3 py-2 rounded-lg border border-slate-200 focus:outline-emerald-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Invoice Date
                    </label>
                    <input
                      type="date"
                      value={formData.invoice_date ?? ""}
                      onChange={(e) => handleChange("invoice_date", e.target.value)}
                      className="w-full text-xs font-mono-data px-3 py-2 rounded-lg border border-slate-200 focus:outline-emerald-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Document Classification
                    </label>
                    <select
                      value={formData.document_type ?? "purchase"}
                      onChange={(e) => handleChange("document_type", e.target.value)}
                      className="w-full text-xs font-medium px-3 py-2 rounded-lg border border-slate-200 focus:outline-emerald-600"
                    >
                      <option value="purchase">Purchase (Inward ITC)</option>
                      <option value="sales">Sales (Outward Liability)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 2: Parties (Vendor & Buyer) */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">
                  2. Vendor & Recipient (Buyer) Details
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Vendor / Supplier Name
                    </label>
                    <input
                      type="text"
                      value={formData.vendor_name ?? ""}
                      onChange={(e) => handleChange("vendor_name", e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 focus:outline-emerald-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Vendor GSTIN
                    </label>
                    <input
                      type="text"
                      value={formData.vendor_gstin ?? ""}
                      onChange={(e) => handleChange("vendor_gstin", e.target.value)}
                      className="w-full text-xs font-mono-data uppercase px-3 py-2 rounded-lg border border-slate-200 focus:outline-emerald-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Billed To (Buyer / Project)
                    </label>
                    <input
                      type="text"
                      value={formData.buyer_name ?? ""}
                      onChange={(e) => handleChange("buyer_name", e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 focus:outline-emerald-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Buyer GSTIN (if stated)
                    </label>
                    <input
                      type="text"
                      value={formData.buyer_gstin ?? ""}
                      onChange={(e) => handleChange("buyer_gstin", e.target.value)}
                      className="w-full text-xs font-mono-data uppercase px-3 py-2 rounded-lg border border-slate-200 focus:outline-emerald-600"
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Taxable Amounts & GST Breakdown */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">
                  3. Taxable Values & GST Computation
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="col-span-2 sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Taxable Amount / Subtotal (₹)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.taxable_amount ?? ""}
                      onChange={(e) => handleChange("taxable_amount", e.target.value)}
                      className="w-full text-xs font-mono-data font-bold px-3 py-2 rounded-lg border border-slate-200 focus:outline-emerald-600"
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      GST Rate (%)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={formData.tax_rate ?? ""}
                      onChange={(e) => handleChange("tax_rate", e.target.value)}
                      className="w-full text-xs font-mono-data px-3 py-2 rounded-lg border border-slate-200 focus:outline-emerald-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      CGST (₹)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.cgst_amount ?? ""}
                      onChange={(e) => handleChange("cgst_amount", e.target.value)}
                      className="w-full text-xs font-mono-data px-3 py-2 rounded-lg border border-slate-200 focus:outline-emerald-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      SGST (₹)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.sgst_amount ?? ""}
                      onChange={(e) => handleChange("sgst_amount", e.target.value)}
                      className="w-full text-xs font-mono-data px-3 py-2 rounded-lg border border-slate-200 focus:outline-emerald-600"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-emerald-800 mb-1">
                      Total Invoice Value (₹)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.total_amount ?? ""}
                      onChange={(e) => handleChange("total_amount", e.target.value)}
                      className="w-full text-sm font-mono-data font-bold px-3 py-2 rounded-lg border-2 border-emerald-500 text-emerald-900 bg-emerald-50/30 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Section 4: HSN / Tariff */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  HSN / SAC Codes
                </label>
                <input
                  type="text"
                  value={formData.hsn_code ?? ""}
                  onChange={(e) => handleChange("hsn_code", e.target.value)}
                  placeholder="e.g. 84715000, 90318000"
                  className="w-full text-xs font-mono-data px-3 py-2 rounded-lg border border-slate-200 focus:outline-emerald-600"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div
              className="mt-6 pt-4 flex items-center justify-end gap-3"
              style={{ borderTop: "1px solid var(--border-soft)" }}
            >
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold text-white shadow-sm transition-opacity disabled:opacity-60 cursor-pointer"
                style={{ background: "var(--primary)" }}
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {saving ? "Saving & Re-validating…" : "Save & Re-validate"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
