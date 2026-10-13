"use client";

import { useEffect, useState } from "react";
import Topbar from "@/components/Topbar";
import { invoicing as invoicingApi, auth as authApi } from "@/lib/api";
import {
  Receipt,
  Plus,
  QrCode,
  Truck,
  Printer,
  FileText,
  AlertCircle,
  CheckCircle2,
  Loader2,
  X,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";

export default function InvoicingPage() {
  const [invoices, setInvoices] = useState([]);
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activePrintInv, setActivePrintInv] = useState(null);
  const [activeEwbInv, setActiveEwbInv] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState("");

  // Form states for new invoice
  const [formData, setFormData] = useState({
    invoice_number: `INV-2026-0${Math.floor(100 + Math.random() * 900)}`,
    invoice_type: "B2B",
    customer_name: "",
    customer_gstin: "",
    customer_address: "",
    place_of_supply: "32",
    invoice_date: new Date().toISOString().split("T")[0],
    due_date: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
    items: [
      {
        description: "Premium Cotton Fabrics",
        hsn_code: "5208",
        quantity: 10,
        unit: "MTR",
        rate: 1500,
        tax_rate: 18,
      },
    ],
    notes: "Payment due within 30 days via NEFT / RTGS / UPI.",
  });

  // Form states for E-Way Bill
  const [ewbForm, setEwbForm] = useState({
    vehicle_no: "KL-07-CD-4512",
    transporter_id: "TRANS-IND-99",
    distance_km: 150,
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [invData, meData] = await Promise.all([
        invoicingApi.list(),
        authApi.me(),
      ]);
      setInvoices(invData.invoices || []);
      setBusiness(meData.business);
      if (meData.business?.gstin) {
        setFormData((prev) => ({
          ...prev,
          place_of_supply: meData.business.gstin.slice(0, 2),
        }));
      }
    } catch (err) {
      setError(err.message || "Failed to load sales invoices.");
    } finally {
      setLoading(false);
    }
  }

  // Calculate live summary metrics
  const totalSales = invoices.reduce((acc, i) => acc + (i.total_amount || 0), 0);
  const totalTax = invoices.reduce((acc, i) => acc + (i.total_tax || 0), 0);
  const irnCount = invoices.filter((i) => i.irn).length;
  const ewbCount = invoices.filter((i) => i.ewb_number).length;

  // Add Item to Create Form
  function handleAddItem() {
    setFormData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          description: "",
          hsn_code: "9999",
          quantity: 1,
          unit: "NOS",
          rate: 1000,
          tax_rate: 18,
        },
      ],
    }));
  }

  function handleItemChange(idx, field, val) {
    setFormData((prev) => {
      const nextItems = [...prev.items];
      nextItems[idx] = { ...nextItems[idx], [field]: val };
      return { ...prev, items: nextItems };
    });
  }

  function handleRemoveItem(idx) {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx),
    }));
  }

  // Submit New Sales Invoice
  async function handleCreateInvoice(e) {
    e.preventDefault();
    setActionLoading(true);
    setActionMsg("");
    try {
      await invoicingApi.create({
        ...formData,
        customer_gstin: formData.customer_gstin || null,
        customer_address: formData.customer_address || null,
      });
      setShowCreateModal(false);
      await loadData();
      alert(`Sales invoice ${formData.invoice_number} created successfully.`);
    } catch (err) {
      alert(err.message || "Failed to create invoice.");
    } finally {
      setActionLoading(false);
    }
  }

  // 1-Click E-Invoice (IRN)
  async function handleGenerateIrn(id) {
    setActionLoading(true);
    try {
      const res = await invoicingApi.generateEInvoice(id);
      await loadData();
      alert(`Official E-Invoice Generated!\n\nIRN: ${res.irn}\nAck No: ${res.ack_no}`);
    } catch (err) {
      alert(err.message || "E-Invoice generation failed.");
    } finally {
      setActionLoading(false);
    }
  }

  // Submit E-Way Bill
  async function handleGenerateEwb(e) {
    e.preventDefault();
    if (!activeEwbInv) return;
    setActionLoading(true);
    try {
      const res = await invoicingApi.generateEWayBill(activeEwbInv.id, ewbForm);
      setActiveEwbInv(null);
      await loadData();
      alert(`E-Way Bill Generated!\n\nEWB Number: ${res.ewb_number}\nValid Until: ${res.valid_until}`);
    } catch (err) {
      alert(err.message || "Failed to generate E-Way bill.");
    } finally {
      setActionLoading(false);
    }
  }

  const supplierState = business?.gstin ? business.gstin.slice(0, 2) : "32";
  const isFormIntraState = supplierState === formData.place_of_supply;

  return (
    <div>
      <Topbar
        title="Sales Invoicing & E-Way Bills"
        subtitle={`${business?.name || "Business"} · GSTIN: ${business?.gstin || "—"} · E-Invoice & Consignment Hub`}
        action={
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white shadow-sm hover:opacity-95 transition-opacity cursor-pointer"
            style={{ background: "var(--primary)" }}
          >
            <Plus size={15} />
            <span>Create Sales Invoice</span>
          </button>
        }
      />

      <div className="px-5 md:px-8 py-6 flex flex-col gap-6">
        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="card p-5">
            <p className="text-[13px] font-medium" style={{ color: "var(--ink-soft)" }}>
              Total Sales Turnover
            </p>
            <p className="font-display text-2xl font-bold mt-2" style={{ color: "var(--ink)" }}>
              ₹{totalSales.toLocaleString("en-IN")}
            </p>
            <span className="text-[11px] text-slate-400 mt-1 block">
              {invoices.length} Issued Documents
            </span>
          </div>

          <div className="card p-5">
            <p className="text-[13px] font-medium" style={{ color: "var(--ink-soft)" }}>
              Output Tax Liability
            </p>
            <p className="font-display text-2xl font-bold mt-2" style={{ color: "var(--primary)" }}>
              ₹{totalTax.toLocaleString("en-IN")}
            </p>
            <span className="text-[11px] text-slate-400 mt-1 block">
              CGST + SGST + IGST Collected
            </span>
          </div>

          <div className="card p-5">
            <p className="text-[13px] font-medium" style={{ color: "var(--ink-soft)" }}>
              E-Invoices (IRN Active)
            </p>
            <p className="font-display text-2xl font-bold mt-2 text-indigo-700">
              {irnCount} / {invoices.length}
            </p>
            <span className="text-[11px] text-slate-400 mt-1 block">
              NIC / IRP Signed QR Generated
            </span>
          </div>

          <div className="card p-5">
            <p className="text-[13px] font-medium" style={{ color: "var(--ink-soft)" }}>
              E-Way Bills Dispatched
            </p>
            <p className="font-display text-2xl font-bold mt-2 text-amber-700">
              {ewbCount} Generated
            </p>
            <span className="text-[11px] text-slate-400 mt-1 block">
              Consignments exceeding ₹50,000
            </span>
          </div>
        </div>

        {/* Sales Invoices Ledger */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <div>
              <h3 className="font-display font-bold text-base text-slate-900">
                Outward Supply & Sales Register
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Manage B2B/B2C invoices, government E-Invoicing IRNs, and transport E-Way bills.
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
              {invoices.length} Records
            </span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-400">
              <Loader2 size={24} className="animate-spin mx-auto mb-2 text-emerald-600" />
              <p className="text-xs">Loading sales invoices…</p>
            </div>
          ) : invoices.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <Receipt size={32} className="mx-auto mb-2 text-slate-300" />
              <p className="text-sm font-semibold text-slate-700">No Sales Invoices Issued Yet</p>
              <p className="text-xs text-slate-500 mt-1">
                Click "Create Sales Invoice" above to generate your first GST tax invoice.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs font-semibold text-slate-400 border-b border-slate-100 bg-slate-50/50">
                    <th className="text-left px-6 py-3">Invoice #</th>
                    <th className="text-left px-4 py-3">Customer</th>
                    <th className="text-left px-4 py-3">Date</th>
                    <th className="text-right px-4 py-3">Taxable</th>
                    <th className="text-right px-4 py-3">Tax</th>
                    <th className="text-right px-4 py-3">Total Value</th>
                    <th className="text-center px-4 py-3">E-Invoice (IRN)</th>
                    <th className="text-center px-4 py-3">E-Way Bill</th>
                    <th className="text-right px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono-data font-bold text-slate-800 text-xs">
                            {inv.invoice_number}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase bg-slate-100 text-slate-600">
                            {inv.invoice_type}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="font-semibold text-xs text-slate-800">{inv.customer_name}</p>
                        <p className="font-mono-data text-[11px] text-slate-400">
                          {inv.customer_gstin || "B2C Consumer"} · PoS: {inv.place_of_supply || "—"}
                        </p>
                      </td>
                      <td className="px-4 py-3.5 font-mono-data text-xs text-slate-600">
                        {inv.invoice_date}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono-data text-xs text-slate-700">
                        ₹{inv.taxable_amount.toLocaleString("en-IN")}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono-data text-xs text-slate-600">
                        ₹{inv.total_tax.toLocaleString("en-IN")}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono-data font-bold text-xs text-slate-900">
                        ₹{inv.total_amount.toLocaleString("en-IN")}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        {inv.irn ? (
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 cursor-pointer"
                            title={`IRN: ${inv.irn}\nAck No: ${inv.irn_ack_no}`}
                            onClick={() => alert(`Official IRN:\n${inv.irn}\n\nAck No: ${inv.irn_ack_no}\nAck Date: ${inv.irn_ack_date}`)}
                          >
                            <QrCode size={11} /> IRN Active
                          </span>
                        ) : inv.customer_gstin ? (
                          <button
                            onClick={() => handleGenerateIrn(inv.id)}
                            disabled={actionLoading}
                            className="text-[10px] font-semibold px-2 py-0.5 rounded border border-indigo-200 text-indigo-700 hover:bg-indigo-50 transition-colors cursor-pointer"
                          >
                            Generate IRN
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-400">N/A (B2C)</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        {inv.ewb_number ? (
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 cursor-pointer"
                            title={`EWB: ${inv.ewb_number}\nVehicle: ${inv.ewb_vehicle_no}\nValid Until: ${inv.ewb_valid_until}`}
                            onClick={() => alert(`Official E-Way Bill:\nNo: ${inv.ewb_number}\nVehicle: ${inv.ewb_vehicle_no}\nValid: ${inv.ewb_valid_until}`)}
                          >
                            <Truck size={11} /> {inv.ewb_number.slice(0, 8)}…
                          </span>
                        ) : inv.total_amount >= 50000 ? (
                          <button
                            onClick={() => setActiveEwbInv(inv)}
                            className="text-[10px] font-semibold px-2 py-0.5 rounded border border-amber-300 text-amber-800 hover:bg-amber-50 transition-colors cursor-pointer"
                          >
                            Generate EWB
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-400">&lt; ₹50k</span>
                        )}
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <button
                          onClick={() => setActivePrintInv(inv)}
                          className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shadow-sm"
                        >
                          <Printer size={13} />
                          Print / PDF
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* CREATE SALES INVOICE MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="flex flex-col w-full max-w-3xl max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Receipt size={18} className="text-emerald-600" />
                <h3 className="font-display font-bold text-base text-slate-900">
                  New Sales Invoice
                </h3>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateInvoice} className="p-6 overflow-y-auto flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Invoice Number</label>
                  <input
                    type="text"
                    required
                    value={formData.invoice_number}
                    onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                    className="w-full text-xs font-mono-data px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Invoice Date</label>
                  <input
                    type="date"
                    required
                    value={formData.invoice_date}
                    onChange={(e) => setFormData({ ...formData, invoice_date: e.target.value })}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Supply Type</label>
                  <select
                    value={formData.invoice_type}
                    onChange={(e) => setFormData({ ...formData, invoice_type: e.target.value })}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white"
                  >
                    <option value="B2B">B2B (Registered Business)</option>
                    <option value="B2C">B2C (Consumer Retail)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-slate-600 block mb-1">Customer / Client Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Apex Retail Private Limited"
                    value={formData.customer_name}
                    onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Customer GSTIN</label>
                  <input
                    type="text"
                    placeholder="e.g. 32KLMNO5678R1ZX"
                    maxLength={15}
                    value={formData.customer_gstin}
                    onChange={(e) => {
                      const v = e.target.value.toUpperCase();
                      const pos = v.length >= 2 ? v.slice(0, 2) : formData.place_of_supply;
                      setFormData({ ...formData, customer_gstin: v, place_of_supply: pos });
                    }}
                    className="w-full text-xs font-mono-data px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
              </div>

              {/* Tax Routing Banner */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                <div>
                  <span className="font-semibold text-slate-800">
                    Place of Supply (PoS): State Code {formData.place_of_supply}
                  </span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {isFormIntraState
                      ? "Intra-State Supply (Supplier 32 == Buyer 32) -> Routed to CGST (50%) + SGST (50%)"
                      : `Inter-State Supply (Supplier ${supplierState} != Buyer ${formData.place_of_supply}) -> Routed to 100% IGST`}
                  </p>
                </div>
                <span className={`px-2.5 py-1 rounded-full font-bold text-[10px] ${isFormIntraState ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-blue-800"}`}>
                  {isFormIntraState ? "CGST + SGST" : "IGST"}
                </span>
              </div>

              {/* Line Items */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Line Items & HSN Codes</span>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="text-xs font-semibold text-emerald-700 hover:underline flex items-center gap-1"
                  >
                    <Plus size={13} /> Add Row
                  </button>
                </div>

                <div className="flex flex-col gap-2">
                  {formData.items.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                      <div className="col-span-5">
                        <label className="text-[10px] text-slate-500">Item Description</label>
                        <input
                          type="text"
                          required
                          value={item.description}
                          onChange={(e) => handleItemChange(idx, "description", e.target.value)}
                          placeholder="Product or service"
                          className="w-full text-xs px-2.5 py-1.5 rounded border border-slate-200 bg-white"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-[10px] text-slate-500">HSN Code</label>
                        <input
                          type="text"
                          value={item.hsn_code}
                          onChange={(e) => handleItemChange(idx, "hsn_code", e.target.value)}
                          className="w-full text-xs font-mono-data px-2.5 py-1.5 rounded border border-slate-200 bg-white"
                        />
                      </div>
                      <div className="col-span-1">
                        <label className="text-[10px] text-slate-500">Qty</label>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(idx, "quantity", parseFloat(e.target.value) || 1)}
                          className="w-full text-xs px-2 py-1.5 rounded border border-slate-200 bg-white"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-[10px] text-slate-500">Rate (₹)</label>
                        <input
                          type="number"
                          min="0"
                          value={item.rate}
                          onChange={(e) => handleItemChange(idx, "rate", parseFloat(e.target.value) || 0)}
                          className="w-full text-xs px-2.5 py-1.5 rounded border border-slate-200 bg-white"
                        />
                      </div>
                      <div className="col-span-1">
                        <label className="text-[10px] text-slate-500">GST %</label>
                        <select
                          value={item.tax_rate}
                          onChange={(e) => handleItemChange(idx, "tax_rate", parseFloat(e.target.value))}
                          className="w-full text-xs py-1.5 rounded border border-slate-200 bg-white"
                        >
                          <option value="5">5%</option>
                          <option value="12">12%</option>
                          <option value="18">18%</option>
                          <option value="28">28%</option>
                        </select>
                      </div>
                      <div className="col-span-1 flex items-end justify-center pb-1">
                        {formData.items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2.5 rounded-lg text-xs font-bold text-white shadow-sm cursor-pointer disabled:opacity-60"
                  style={{ background: "var(--primary)" }}
                >
                  {actionLoading ? "Generating Invoice…" : "Issue GST Invoice"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* GENERATE E-WAY BILL MODAL */}
      {activeEwbInv && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="flex flex-col w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-amber-50 border-b border-amber-100">
              <div className="flex items-center gap-2">
                <Truck size={18} className="text-amber-700" />
                <h3 className="font-display font-bold text-base text-amber-950">
                  Generate E-Way Bill (Consignment)
                </h3>
              </div>
              <button onClick={() => setActiveEwbInv(null)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleGenerateEwb} className="p-6 flex flex-col gap-4">
              <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-200 text-xs">
                <p className="font-semibold text-amber-900">
                  Invoice: {activeEwbInv.invoice_number} (₹{activeEwbInv.total_amount?.toLocaleString("en-IN")})
                </p>
                <p className="text-amber-700 mt-0.5">
                  Consignment to: {activeEwbInv.customer_name} ({activeEwbInv.place_of_supply})
                </p>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">
                  Vehicle Number (Part-B)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. KL-07-CD-4512"
                  value={ewbForm.vehicle_no}
                  onChange={(e) => setEwbForm({ ...ewbForm, vehicle_no: e.target.value.toUpperCase() })}
                  className="w-full text-xs font-mono-data px-3 py-2 rounded-lg border border-slate-200"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">
                  Transporter ID / Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. BlueDart Logistics"
                  value={ewbForm.transporter_id}
                  onChange={(e) => setEwbForm({ ...ewbForm, transporter_id: e.target.value })}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">
                  Approximate Transit Distance (km)
                </label>
                <input
                  type="number"
                  min="1"
                  value={ewbForm.distance_km}
                  onChange={(e) => setEwbForm({ ...ewbForm, distance_km: parseInt(e.target.value) || 100 })}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Validity calculated at 200 km/day (Statutory Rule 138(10)).
                </span>
              </div>

              <div className="mt-4 pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActiveEwbInv(null)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2.5 rounded-lg text-xs font-bold text-white bg-amber-700 hover:bg-amber-800 shadow-sm cursor-pointer"
                >
                  {actionLoading ? "Generating EWB…" : "Submit & Generate E-Way Bill"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRINTABLE GST INVOICE MODAL */}
      {activePrintInv && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="flex flex-col w-full max-w-4xl max-h-[92vh] bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-3.5 bg-slate-50 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Printer size={16} className="text-slate-600" />
                <span className="font-semibold text-xs text-slate-800">
                  Tax Invoice Preview — {activePrintInv.invoice_number}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 cursor-pointer shadow-sm"
                >
                  <Printer size={13} /> Print Document
                </button>
                <button
                  onClick={() => setActivePrintInv(null)}
                  className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Document Body */}
            <div className="p-8 overflow-y-auto font-sans text-slate-800 flex flex-col gap-6">
              {/* Header */}
              <div className="flex items-start justify-between border-b pb-6 border-slate-200">
                <div>
                  <h1 className="text-2xl font-bold text-emerald-900">{business?.name || "Business Name"}</h1>
                  <p className="text-xs text-slate-500 mt-1">
                    GSTIN: <span className="font-mono-data font-semibold text-slate-800">{business?.gstin || "—"}</span>
                  </p>
                  <p className="text-xs text-slate-500">{business?.state || "State"}, India</p>
                </div>
                <div className="text-right">
                  <span className="px-3 py-1 rounded text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-900">
                    TAX INVOICE
                  </span>
                  <p className="font-mono-data font-bold text-sm text-slate-900 mt-2">
                    {activePrintInv.invoice_number}
                  </p>
                  <p className="text-xs text-slate-500">Date: {activePrintInv.invoice_date}</p>
                </div>
              </div>

              {/* Bill To & Dispatch */}
              <div className="grid grid-cols-2 gap-6 p-4 rounded-xl bg-slate-50 text-xs">
                <div>
                  <p className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Billed To (Recipient)</p>
                  <p className="font-bold text-slate-900 text-sm mt-1">{activePrintInv.customer_name}</p>
                  <p className="font-mono-data text-slate-600 mt-0.5">
                    GSTIN: {activePrintInv.customer_gstin || "Unregistered (B2C)"}
                  </p>
                  <p className="text-slate-500 mt-0.5">{activePrintInv.customer_address || "Customer Address"}</p>
                </div>
                <div className="text-right">
                  <p className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Supply & Consignment Details</p>
                  <p className="mt-1">Place of Supply (PoS): <b>State Code {activePrintInv.place_of_supply}</b></p>
                  {activePrintInv.ewb_number && (
                    <p className="font-mono-data text-amber-800 font-semibold mt-1">
                      E-Way Bill: {activePrintInv.ewb_number}
                    </p>
                  )}
                  {activePrintInv.irn && (
                    <p className="font-mono-data text-indigo-800 text-[10px] break-all mt-1">
                      IRN: {activePrintInv.irn.slice(0, 32)}…
                    </p>
                  )}
                </div>
              </div>

              {/* Items Table */}
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-300 font-bold text-slate-600">
                    <th className="text-left py-2">Item Description</th>
                    <th className="text-center py-2">HSN</th>
                    <th className="text-right py-2">Qty</th>
                    <th className="text-right py-2">Rate (₹)</th>
                    <th className="text-right py-2">Taxable (₹)</th>
                    <th className="text-right py-2">GST %</th>
                    <th className="text-right py-2">Total (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activePrintInv.items?.map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-2.5 font-medium">{item.description}</td>
                      <td className="py-2.5 text-center font-mono-data text-slate-500">{item.hsn_code}</td>
                      <td className="py-2.5 text-right font-mono-data">{item.quantity} {item.unit}</td>
                      <td className="py-2.5 text-right font-mono-data">₹{item.rate?.toLocaleString("en-IN")}</td>
                      <td className="py-2.5 text-right font-mono-data">₹{item.taxable_amount?.toLocaleString("en-IN")}</td>
                      <td className="py-2.5 text-right font-mono-data">{item.tax_rate}%</td>
                      <td className="py-2.5 text-right font-mono-data font-bold">₹{item.total?.toLocaleString("en-IN")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Tax Summary Totals */}
              <div className="flex justify-end pt-4 border-t border-slate-200">
                <div className="w-72 flex flex-col gap-2 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Taxable Subtotal:</span>
                    <span className="font-mono-data font-semibold">₹{activePrintInv.taxable_amount?.toLocaleString("en-IN")}</span>
                  </div>
                  {activePrintInv.cgst_amount > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>CGST:</span>
                      <span className="font-mono-data">₹{activePrintInv.cgst_amount?.toLocaleString("en-IN")}</span>
                    </div>
                  )}
                  {activePrintInv.sgst_amount > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>SGST:</span>
                      <span className="font-mono-data">₹{activePrintInv.sgst_amount?.toLocaleString("en-IN")}</span>
                    </div>
                  )}
                  {activePrintInv.igst_amount > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>IGST:</span>
                      <span className="font-mono-data">₹{activePrintInv.igst_amount?.toLocaleString("en-IN")}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-bold text-slate-900 border-t pt-2 border-slate-300">
                    <span>Invoice Total:</span>
                    <span className="font-mono-data text-emerald-800">
                      ₹{activePrintInv.total_amount?.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

