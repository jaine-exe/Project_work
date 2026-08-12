"use client";

import { useCallback, useRef, useState } from "react";
import Topbar from "@/components/Topbar";
import PipelineStepper from "@/components/PipelineStepper";
import StatusPill from "@/components/StatusPill";
import { invoices as invoicesApi } from "@/lib/api";
import { UploadCloud, FileText, X, CheckCircle2, Loader2, AlertTriangle } from "lucide-react";

// Maps backend invoice status -> pipeline stage key used by PipelineStepper
const STATUS_TO_STAGE = {
  uploaded: "uploaded",
  parsed: "parsed",
  validated: "risk",
  flagged: "risk",
  failed: "risk",
  filed: "filed",
};

const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 30000;

function makeLocalFile(file) {
  return {
    localId: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: file.name,
    size: file.size,
    stage: "uploaded",
    invoiceId: null,
    backendStatus: null,
    error: null,
  };
}

export default function UploadPage() {
  const [files, setFiles] = useState([]);
  const [isDragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const patchFile = useCallback((localId, patch) => {
    setFiles((prev) => prev.map((f) => (f.localId === localId ? { ...f, ...patch } : f)));
  }, []);

  const pollInvoice = useCallback(
    (localId, invoiceId) => {
      const startedAt = Date.now();

      const tick = async () => {
        try {
          const inv = await invoicesApi.get(invoiceId);
          patchFile(localId, {
            stage: STATUS_TO_STAGE[inv.status] || "uploaded",
            backendStatus: inv.status,
          });

          const terminal = ["validated", "flagged", "filed", "failed"].includes(inv.status);
          if (terminal) return;

          if (Date.now() - startedAt < POLL_TIMEOUT_MS) {
            setTimeout(tick, POLL_INTERVAL_MS);
          }
        } catch (err) {
          patchFile(localId, { error: "Lost connection while checking status" });
        }
      };

      setTimeout(tick, POLL_INTERVAL_MS);
    },
    [patchFile]
  );

  const uploadOne = useCallback(
    async (localId, file) => {
      try {
        const invoice = await invoicesApi.upload(file);
        patchFile(localId, {
          invoiceId: invoice.id,
          stage: STATUS_TO_STAGE[invoice.status] || "uploaded",
          backendStatus: invoice.status,
        });
        pollInvoice(localId, invoice.id);
      } catch (err) {
        patchFile(localId, {
          error: err.message || "Upload failed. Is the backend running?",
        });
      }
    },
    [patchFile, pollInvoice]
  );

  const addFiles = useCallback(
    (fileList) => {
      const incoming = Array.from(fileList);
      const newFiles = incoming.map(makeLocalFile);
      setFiles((prev) => [...newFiles, ...prev]);
      newFiles.forEach((lf, i) => uploadOne(lf.localId, incoming[i]));
    },
    [uploadOne]
  );

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  }

  function removeFile(localId) {
    setFiles((prev) => prev.filter((f) => f.localId !== localId));
  }

  const doneCount = files.filter((f) => ["validated", "flagged", "filed"].includes(f.backendStatus)).length;

  return (
    <div>
      <Topbar title="Upload invoices" subtitle="PDF, image, or e-invoice XML — up to 20 files at once" />

      <div className="px-5 md:px-8 py-6 flex flex-col gap-6 max-w-5xl">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className="card flex flex-col items-center justify-center text-center px-6 py-14 cursor-pointer transition-colors"
          style={{
            borderStyle: "dashed",
            borderWidth: 2,
            borderColor: isDragging ? "var(--primary)" : "var(--border)",
            background: isDragging ? "var(--primary-light)" : "var(--surface)",
          }}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.xml"
            className="hidden"
            onChange={(e) => e.target.files?.length && addFiles(e.target.files)}
          />
          <div
            className="flex items-center justify-center rounded-full w-14 h-14 mb-4"
            style={{ background: "var(--primary-light)" }}
          >
            <UploadCloud size={24} style={{ color: "var(--primary)" }} />
          </div>
          <p className="font-display font-bold text-lg">Drop invoices here, or browse</p>
          <p className="text-sm mt-1.5" style={{ color: "var(--ink-soft)" }}>
            Our parsing pipeline extracts vendor, GSTIN, HSN, amount, and tax rate automatically.
          </p>
          <span
            className="mt-5 inline-flex items-center rounded-lg px-4 py-2 text-sm font-semibold text-white"
            style={{ background: "var(--primary)" }}
          >
            Choose files
          </span>
        </div>

        {files.length > 0 && (
          <div className="card overflow-hidden">
            <div
              className="flex items-center justify-between px-5 py-4"
              style={{ borderBottom: "1px solid var(--border-soft)" }}
            >
              <h3 className="font-display font-bold text-[15px]">
                Processing {files.length} {files.length === 1 ? "file" : "files"}
              </h3>
              <span className="text-xs font-medium" style={{ color: "var(--ink-soft)" }}>
                {doneCount} of {files.length} complete
              </span>
            </div>

            <ul>
              {files.map((f) => (
                <li
                  key={f.localId}
                  className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 px-5 py-4"
                  style={{ borderTop: "1px solid var(--border-soft)" }}
                >
                  <div className="flex items-center gap-3 min-w-0 sm:w-64 shrink-0">
                    <span
                      className="flex items-center justify-center rounded-lg w-9 h-9 shrink-0"
                      style={{ background: "var(--surface-sunken)" }}
                    >
                      <FileText size={16} style={{ color: "var(--ink-soft)" }} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: "var(--ink)" }}>
                        {f.name}
                      </p>
                      <p className="text-xs" style={{ color: "var(--ink-faint)" }}>
                        {(f.size / 1024).toFixed(0)} KB
                      </p>
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    {f.error ? (
                      <p className="text-xs" style={{ color: "var(--danger)" }}>
                        {f.error}
                      </p>
                    ) : (
                      <PipelineStepper currentStage={f.stage} compact />
                    )}
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {f.error ? (
                      <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--danger)" }}>
                        <AlertTriangle size={14} /> Failed
                      </span>
                    ) : f.backendStatus === "flagged" ? (
                      <StatusPill tone="flagged" />
                    ) : ["validated", "filed"].includes(f.backendStatus) ? (
                      <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--success)" }}>
                        <CheckCircle2 size={14} /> Ready
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: "var(--ink-soft)" }}>
                        <Loader2 size={14} className="animate-spin" /> Processing
                      </span>
                    )}
                    <button
                      onClick={() => removeFile(f.localId)}
                      className="flex items-center justify-center rounded-md w-7 h-7"
                      style={{ color: "var(--ink-faint)" }}
                      aria-label={`Remove ${f.name}`}
                    >
                      <X size={15} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="card p-5 flex items-start gap-3" style={{ background: "var(--info-light)" }}>
          <StatusPill tone="parsed">Tip</StatusPill>
          <p className="text-sm" style={{ color: "var(--ink)" }}>
            The backend runs in mock-OCR mode by default, so extracted data is randomized for
            testing — set <code>OCR_PROVIDER=tesseract</code> in the backend&apos;s .env once
            you&apos;re ready to parse real invoices.
          </p>
        </div>
      </div>
    </div>
  );
}
