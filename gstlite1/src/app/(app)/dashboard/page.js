"use client";

import { useEffect, useState } from "react";
import Topbar from "@/components/Topbar";
import SummaryCard from "@/components/SummaryCard";
import ReadinessRing from "@/components/ReadinessRing";
import PipelineStepper from "@/components/PipelineStepper";
import StatusPill from "@/components/StatusPill";
import {
  compliance as complianceApi,
  gst as gstApi,
  invoices as invoicesApi,
  auth as authApi,
} from "@/lib/api";
import { UploadCloud, MessageCircleMore, ArrowRight, AlertTriangle, Loader2 } from "lucide-react";
import Link from "next/link";

const CURRENT_PERIOD = "2026-07";

const STATUS_TO_STAGE = {
  uploaded: "uploaded",
  parsed: "parsed",
  validated: "risk",
  flagged: "risk",
  filed: "filed",
  failed: "risk",
};

export default function DashboardPage() {
  const [readiness, setReadiness] = useState(null);
  const [summary, setSummary] = useState(null);
  const [invoiceList, setInvoiceList] = useState([]);
  const [issues, setIssues] = useState([]);
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: reset loading state for a new fetch
    setLoading(true);
    setError("");

    Promise.all([
      complianceApi.readiness(),
      gstApi.summary(CURRENT_PERIOD),
      invoicesApi.list(),
      complianceApi.issues("high"),
      authApi.me(),
    ])
      .then(([readinessData, summaryData, invoicesData, issuesData, me]) => {
        if (cancelled) return;
        setReadiness(readinessData);
        setSummary(summaryData);
        setInvoiceList(invoicesData.invoices);
        setIssues(issuesData);
        setBusiness(me.business);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Couldn't load dashboard data");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const recentInvoices = invoiceList.slice(0, 5);
  const topIssues = issues.slice(0, 2);

  const summaryCards = summary
    ? [
        {
          label: "Output tax liability",
          value: `₹${summary.output_tax_liability.toLocaleString("en-IN")}`,
          trend: "This period",
          trendDirection: "flat",
          tone: "primary",
        },
        {
          label: "Input tax credit (ITC)",
          value: `₹${summary.input_tax_credit.toLocaleString("en-IN")}`,
          trend: "This period",
          trendDirection: "flat",
          tone: "info",
        },
        {
          label: "Net payable",
          value: `₹${summary.net_payable.toLocaleString("en-IN")}`,
          trend: "This period",
          trendDirection: "flat",
          tone: "gold",
        },
        {
          label: "Flagged invoices",
          value: String(summary.flagged_invoice_count),
          trend: summary.flagged_invoice_count > 0 ? "Needs review" : "All clear",
          trendDirection: summary.flagged_invoice_count > 0 ? "up" : "flat",
          tone: "danger",
        },
      ]
    : [];

  // Pick a representative pipeline stage across in-flight invoices for the hero card
  const heroStage =
    invoiceList.find((i) => !["validated", "flagged", "filed"].includes(i.status))?.status ||
    invoiceList[0]?.status ||
    "uploaded";

  if (loading) {
    return (
      <div>
        <Topbar title="Dashboard" />
        <div className="px-5 md:px-8 py-6">
          <div className="card p-10 flex items-center justify-center gap-2">
            <Loader2 size={16} className="animate-spin" style={{ color: "var(--ink-faint)" }} />
            <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
              Loading your dashboard…
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <Topbar title="Dashboard" />
        <div className="px-5 md:px-8 py-6">
          <div className="card p-5" style={{ background: "var(--danger-light)" }}>
            <p className="text-sm" style={{ color: "var(--danger)" }}>
              {error} — is the backend running at{" "}
              {process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"}?
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Topbar
        title={`Welcome back${business ? `, ${business.name.split(" ")[0]}` : ""}`}
        subtitle={business ? `${business.gstin} · ${business.state} · Filing period ${CURRENT_PERIOD}` : ""}
      />

      <div className="px-5 md:px-8 py-6 flex flex-col gap-6">
        {/* Top row: readiness + actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="card p-6 lg:col-span-2 flex flex-col sm:flex-row items-center gap-6">
            <ReadinessRing score={readiness?.score ?? 100} />
            <div className="flex-1 text-center sm:text-left">
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--gold)" }}>
                Filing readiness
              </p>
              <h3 className="font-display text-xl font-bold mt-1">{readiness?.label || "No invoices yet"}</h3>
              <p className="text-sm mt-1.5 mb-4" style={{ color: "var(--ink-soft)" }}>
                {readiness?.high_risk_count > 0
                  ? `${readiness.high_risk_count} high-risk invoice${readiness.high_risk_count === 1 ? "" : "s"} ${
                      readiness.high_risk_count === 1 ? "is" : "are"
                    } blocking a clean filing. Resolve them to raise your score.`
                  : "Upload invoices to start building your filing readiness score."}
              </p>
              {invoiceList.length > 0 && (
                <div className="max-w-md mx-auto sm:mx-0">
                  <PipelineStepper currentStage={STATUS_TO_STAGE[heroStage] || "uploaded"} />
                </div>
              )}
            </div>
          </div>

          <div className="card p-6 flex flex-col justify-between gap-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--ink-faint)" }}>
                Filing period
              </p>
              <p className="text-sm mt-3" style={{ color: "var(--ink)" }}>
                Current period: <span className="font-mono-data">{CURRENT_PERIOD}</span>
              </p>
              <p className="text-sm mt-2" style={{ color: "var(--ink-soft)" }}>
                {invoiceList.length} invoice{invoiceList.length === 1 ? "" : "s"} uploaded this period.
              </p>
            </div>
            <Link
              href="/upload"
              className="flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white"
              style={{ background: "var(--primary)" }}
            >
              <UploadCloud size={16} />
              Upload invoices
            </Link>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          {summaryCards.map((c) => (
            <SummaryCard key={c.label} {...c} />
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Recent invoices */}
          <div className="card lg:col-span-2 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border-soft)" }}>
              <h3 className="font-display font-bold text-[15px]">Recent invoices</h3>
              <Link href="/gst-summary" className="text-xs font-semibold flex items-center gap-1" style={{ color: "var(--primary)" }}>
                View all <ArrowRight size={13} />
              </Link>
            </div>
            {recentInvoices.length === 0 ? (
              <div className="p-10 text-center">
                <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
                  No invoices yet — upload your first one to get started.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ color: "var(--ink-faint)" }}>
                      <th className="text-left font-medium px-5 py-2.5 text-xs">Invoice</th>
                      <th className="text-left font-medium px-3 py-2.5 text-xs">Vendor</th>
                      <th className="text-right font-medium px-3 py-2.5 text-xs">Amount</th>
                      <th className="text-left font-medium px-3 py-2.5 text-xs">Status</th>
                      <th className="text-left font-medium px-5 py-2.5 text-xs">Risk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentInvoices.map((inv) => (
                      <tr key={inv.id} style={{ borderTop: "1px solid var(--border-soft)" }}>
                        <td className="px-5 py-3 font-mono-data text-xs" style={{ color: "var(--ink)" }}>
                          {inv.display_id}
                        </td>
                        <td className="px-3 py-3" style={{ color: "var(--ink)" }}>
                          {inv.vendor_name || "—"}
                        </td>
                        <td className="px-3 py-3 text-right font-mono-data" style={{ color: "var(--ink)" }}>
                          {inv.amount ? `₹${inv.amount.toLocaleString("en-IN")}` : "—"}
                        </td>
                        <td className="px-3 py-3">
                          <StatusPill tone={inv.status} />
                        </td>
                        <td className="px-5 py-3">
                          <StatusPill tone={inv.risk} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* AI advisor + top issues */}
          <div className="flex flex-col gap-5">
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={15} style={{ color: "var(--danger)" }} />
                <h3 className="font-display font-bold text-[15px]">Needs your attention</h3>
              </div>
              {topIssues.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
                  No high-risk issues right now.
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {topIssues.map((issue) => (
                    <div key={issue.id} className="rounded-lg p-3" style={{ background: "var(--danger-light)" }}>
                      <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
                        {issue.title}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              <Link
                href="/compliance"
                className="mt-4 flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold w-full"
                style={{ background: "var(--surface-sunken)", color: "var(--ink)" }}
              >
                Review full report <ArrowRight size={13} />
              </Link>
            </div>

            <div className="card p-5" style={{ background: "var(--primary-dark)" }}>
              <div className="flex items-center gap-2 mb-2">
                <MessageCircleMore size={16} color="white" />
                <h3 className="font-display font-bold text-[15px] text-white">Ask the AI advisor</h3>
              </div>
              <p className="text-sm mb-4" style={{ color: "var(--ink-on-dark-soft)" }}>
                Not sure why an invoice was flagged? Ask in plain language and get an
                answer grounded in GST law.
              </p>
              <Link
                href="/chat"
                className="flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold w-full"
                style={{ background: "white", color: "var(--primary-dark)" }}
              >
                Open AI chat <ArrowRight size={13} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
