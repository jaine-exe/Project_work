"use client";

import { useState, useEffect } from "react";
import Topbar from "@/components/Topbar";
import { integrations as integrationsApi, auth as authApi } from "@/lib/api";
import {
  FolderSync,
  FileSpreadsheet,
  Download,
  UploadCloud,
  FileArchive,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileText,
  ArrowRight,
  Database,
} from "lucide-react";

export default function IntegrationsPage() {
  const [business, setBusiness] = useState(null);

  // States for downloads
  const [exportingTally, setExportingTally] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);

  // States for Bulk ZIP
  const [zipFile, setZipFile] = useState(null);
  const [uploadingZip, setUploadingZip] = useState(false);
  const [zipResult, setZipResult] = useState(null);

  // States for Bank Reconcile
  const [bankFile, setBankFile] = useState(null);
  const [reconcilingBank, setReconcilingBank] = useState(false);
  const [bankResult, setBankResult] = useState(null);

  useEffect(() => {
    authApi.me().then((res) => setBusiness(res.business)).catch(() => {});
  }, []);

  async function handleTallyExport() {
    setExportingTally(true);
    try {
      await integrationsApi.downloadTallyXml("", business?.gstin || "32AACCA1234F1Z5");
    } catch (err) {
      alert(err.message || "Failed to export Tally XML.");
    } finally {
      setExportingTally(false);
    }
  }

  async function handleExcelExport() {
    setExportingExcel(true);
    try {
      await integrationsApi.downloadExcelCsv(business?.gstin || "32AACCA1234F1Z5");
    } catch (err) {
      alert(err.message || "Failed to export Excel CSV.");
    } finally {
      setExportingExcel(false);
    }
  }

  async function handleBulkZipUpload(e) {
    e.preventDefault();
    if (!zipFile) return;

    setUploadingZip(true);
    setZipResult(null);
    try {
      const fd = new FormData();
      fd.append("file", zipFile);
      const res = await integrationsApi.bulkZipUpload(fd);
      setZipResult(res);
      setZipFile(null);
    } catch (err) {
      alert(err.message || "Bulk ZIP upload failed.");
    } finally {
      setUploadingZip(false);
    }
  }

  async function handleBankReconcile(e) {
    e.preventDefault();
    if (!bankFile) return;

    setReconcilingBank(true);
    setBankResult(null);
    try {
      const fd = new FormData();
      fd.append("file", bankFile);
      const res = await integrationsApi.reconcileBankStatement(fd);
      setBankResult(res);
      setBankFile(null);
    } catch (err) {
      alert(err.message || "Bank reconciliation failed.");
    } finally {
      setReconcilingBank(false);
    }
  }

  return (
    <div>
      <Topbar
        title="ERP, Tally & Bank Integrations"
        subtitle={`${business?.name || "Business"} · Tally Prime XML, Excel Sync, Bulk ZIP Ingestion & Bank Reconciliation`}
      />

      <div className="px-5 md:px-8 py-6 flex flex-col gap-6">
        {/* TOP ROW: TALLY & EXCEL EXPORTS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Tally Prime Integration */}
          <div className="card p-6 flex flex-col justify-between">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
                  T
                </div>
                <div>
                  <h3 className="font-display font-bold text-base text-slate-900">
                    Tally Prime XML Synchronization
                  </h3>
                  <p className="text-xs text-slate-500">
                    1-Click XML export formatted for Tally Prime voucher importing.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex flex-col gap-2 mt-2">
                <p className="font-semibold text-slate-800">How to import into Tally Prime:</p>
                <ol className="list-decimal pl-4 flex flex-col gap-1 text-[11px] text-slate-600">
                  <li>Click <b>"Download Tally XML Vouchers"</b> below.</li>
                  <li>Open Tally Prime &rarr; Press <kbd className="px-1 py-0.5 rounded bg-slate-200 text-slate-800">Alt + O</kbd> (Import).</li>
                  <li>Select <b>"Transactions / Vouchers"</b> &rarr; choose the downloaded XML file.</li>
                  <li>All purchase ledgers, taxes (CGST/SGST/IGST), and party records sync automatically.</li>
                </ol>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                Format: <code className="font-mono-data text-slate-600">XML Vouchers v1.0</code>
              </span>
              <button
                onClick={handleTallyExport}
                disabled={exportingTally}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold text-white bg-amber-700 hover:bg-amber-800 shadow-sm cursor-pointer disabled:opacity-60"
              >
                {exportingTally ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                {exportingTally ? "Generating XML…" : "Download Tally XML Vouchers"}
              </button>
            </div>
          </div>

          {/* Excel Master Ledger */}
          <div className="card p-6 flex flex-col justify-between">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                  <FileSpreadsheet size={20} />
                </div>
                <div>
                  <h3 className="font-display font-bold text-base text-slate-900">
                    Excel & CSV Master Ledger
                  </h3>
                  <p className="text-xs text-slate-500">
                    Comprehensive spreadsheet export for audit, CA filing, and internal accounting.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex flex-col gap-2 mt-2">
                <p className="font-semibold text-slate-800">Included spreadsheet columns:</p>
                <div className="grid grid-cols-2 gap-1.5 text-[11px] text-slate-600">
                  <span>• Invoice Number & Display ID</span>
                  <span>• Vendor Name & 15-digit GSTIN</span>
                  <span>• Taxable Subtotal & Total Value</span>
                  <span>• CGST, SGST, IGST breakdown</span>
                  <span>• GSTR-2B Compliance Status</span>
                  <span>• Return Lock & Payment Status</span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                Format: <code className="font-mono-data text-slate-600">UTF-8 CSV (Excel Ready)</code>
              </span>
              <button
                onClick={handleExcelExport}
                disabled={exportingExcel}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 shadow-sm cursor-pointer disabled:opacity-60"
              >
                {exportingExcel ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                {exportingExcel ? "Generating CSV…" : "Export Master Ledger (CSV)"}
              </button>
            </div>
          </div>
        </div>

        {/* BOTTOM ROW: BULK ZIP & BANK RECONCILIATION */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Bulk Invoice ZIP Ingestion */}
          <div className="card p-6 flex flex-col justify-between">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
                  <FileArchive size={20} />
                </div>
                <div>
                  <h3 className="font-display font-bold text-base text-slate-900">
                    Bulk Invoice ZIP Ingestion
                  </h3>
                  <p className="text-xs text-slate-500">
                    Upload a single .zip folder with 10–50+ invoices for batch OCR extraction.
                  </p>
                </div>
              </div>

              <form onSubmit={handleBulkZipUpload} className="flex flex-col gap-3 mt-2">
                <div className="p-5 border-2 border-dashed border-slate-200 rounded-2xl text-center bg-slate-50/50 hover:bg-slate-50 transition-colors">
                  <UploadCloud size={24} className="mx-auto text-indigo-500 mb-2" />
                  <p className="text-xs font-semibold text-slate-700">
                    {zipFile ? zipFile.name : "Select or Drop a .zip Archive"}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Contains PDF, PNG, or JPG bills
                  </p>
                  <input
                    type="file"
                    accept=".zip"
                    onChange={(e) => setZipFile(e.target.files?.[0] || null)}
                    className="mt-3 text-xs text-slate-500 mx-auto block cursor-pointer"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!zipFile || uploadingZip}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 cursor-pointer shadow-sm"
                >
                  {uploadingZip ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}
                  {uploadingZip ? "Extracting & Ingesting Invoices…" : "Upload & Process ZIP Archive"}
                </button>
              </form>

              {zipResult && (
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-900 flex items-start gap-2 mt-2">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">{zipResult.message}</p>
                    <p className="text-[11px] text-emerald-700 mt-0.5">
                      Extracted: {zipResult.total_extracted} · Ingested into Ledger: {zipResult.successfully_ingested}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bank Statement Cross-Reconciliation */}
          <div className="card p-6 flex flex-col justify-between">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
                  <CreditCard size={20} />
                </div>
                <div>
                  <h3 className="font-display font-bold text-base text-slate-900">
                    Bank Statement Cross-Reconciliation
                  </h3>
                  <p className="text-xs text-slate-500">
                    Match bank statement debits against bills to resolve Section 16(2) 180-day alerts.
                  </p>
                </div>
              </div>

              <form onSubmit={handleBankReconcile} className="flex flex-col gap-3 mt-2">
                <div className="p-5 border-2 border-dashed border-slate-200 rounded-2xl text-center bg-slate-50/50 hover:bg-slate-50 transition-colors">
                  <CreditCard size={24} className="mx-auto text-purple-500 mb-2" />
                  <p className="text-xs font-semibold text-slate-700">
                    {bankFile ? bankFile.name : "Select Bank Statement CSV"}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    HDFC, ICICI, SBI or any standard bank statement export
                  </p>
                  <input
                    type="file"
                    accept=".csv,.txt"
                    onChange={(e) => setBankFile(e.target.files?.[0] || null)}
                    className="mt-3 text-xs text-slate-500 mx-auto block cursor-pointer"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!bankFile || reconcilingBank}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 cursor-pointer shadow-sm"
                >
                  {reconcilingBank ? <Loader2 size={14} className="animate-spin" /> : <FolderSync size={14} />}
                  {reconcilingBank ? "Matching Bank Payouts…" : "Reconcile Bank Transactions"}
                </button>
              </form>

              {bankResult && (
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-900 flex items-start gap-2 mt-2">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">{bankResult.message}</p>
                    <p className="text-[11px] text-emerald-700 mt-0.5">
                      Matched {bankResult.matched_count} payout(s) — marked as settled in ledger.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

