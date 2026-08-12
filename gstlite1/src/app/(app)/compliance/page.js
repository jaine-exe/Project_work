"use client";

import { useEffect, useState } from "react";
import Topbar from "@/components/Topbar";
import StatusPill from "@/components/StatusPill";
import { compliance as complianceApi } from "@/lib/api";
import { AlertOctagon, AlertTriangle, Info, ArrowRight, Scale, Loader2 } from "lucide-react";
import Link from "next/link";

const SEVERITY_META = {
  high: { icon: AlertOctagon, color: "var(--danger)", label: "High" },
  medium: { icon: AlertTriangle, color: "var(--warning)", label: "Medium" },
  low: { icon: Info, color: "var(--info)", label: "Low" },
};

const FILTERS = ["all", "high", "medium", "low"];

export default function CompliancePage() {
  const [filter, setFilter] = useState("all");
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: reset loading state for a new fetch
    setLoading(true);
    setError("");

    complianceApi
      .issues(filter)
      .then((data) => {
        if (!cancelled) setIssues(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Couldn't load compliance issues");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [filter]);

  const counts = {
    high: issues.filter((i) => i.severity === "high").length,
    medium: issues.filter((i) => i.severity === "medium").length,
    low: issues.filter((i) => i.severity === "low").length,
  };

  return (
    <div>
      <Topbar title="Compliance report" subtitle="Every flag, explained against the actual GST rule that triggered it" />

      <div className="px-5 md:px-8 py-6 flex flex-col gap-6">
        <div className="grid grid-cols-3 gap-4 max-w-xl">
          {Object.entries(counts).map(([sev, count]) => {
            const meta = SEVERITY_META[sev];
            const Icon = meta.icon;
            return (
              <div key={sev} className="card p-4 flex items-center gap-3">
                <span
                  className="flex items-center justify-center rounded-full w-9 h-9 shrink-0"
                  style={{ background: `color-mix(in srgb, ${meta.color} 14%, white)` }}
                >
                  <Icon size={16} style={{ color: meta.color }} />
                </span>
                <div>
                  <p className="font-display text-lg font-bold leading-none">{count}</p>
                  <p className="text-xs mt-1" style={{ color: "var(--ink-soft)" }}>
                    {meta.label} severity
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="rounded-full px-4 py-1.5 text-xs font-semibold capitalize transition-colors"
              style={{
                background: filter === f ? "var(--primary)" : "var(--surface)",
                color: filter === f ? "white" : "var(--ink-soft)",
                border: filter === f ? "1px solid var(--primary)" : "1px solid var(--border)",
              }}
            >
              {f === "all" ? "All issues" : f}
            </button>
          ))}
        </div>

        {loading && (
          <div className="card p-10 flex items-center justify-center gap-2">
            <Loader2 size={16} className="animate-spin" style={{ color: "var(--ink-faint)" }} />
            <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
              Loading compliance issues…
            </p>
          </div>
        )}

        {error && !loading && (
          <div className="card p-5" style={{ background: "var(--danger-light)" }}>
            <p className="text-sm" style={{ color: "var(--danger)" }}>
              {error} — is the backend running at{" "}
              {process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"}?
            </p>
          </div>
        )}

        {!loading && !error && (
          <div className="flex flex-col gap-4">
            {issues.map((issue) => {
              const meta = SEVERITY_META[issue.severity];
              const Icon = meta.icon;
              return (
                <div key={issue.id} className="card p-5 animate-fade-up">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex items-start gap-3">
                      <span
                        className="flex items-center justify-center rounded-full w-9 h-9 shrink-0 mt-0.5"
                        style={{ background: `color-mix(in srgb, ${meta.color} 14%, white)` }}
                      >
                        <Icon size={16} style={{ color: meta.color }} />
                      </span>
                      <div>
                        <h3 className="font-display font-bold text-[15px]">{issue.title}</h3>
                      </div>
                    </div>
                    <StatusPill tone={issue.severity}>{meta.label} risk</StatusPill>
                  </div>

                  <p className="text-sm leading-relaxed mb-3" style={{ color: "var(--ink)" }}>
                    {issue.description}
                  </p>

                  <div
                    className="rounded-lg p-3.5 mb-3 flex items-start gap-2.5"
                    style={{ background: "var(--primary-light)" }}
                  >
                    <ArrowRight size={15} className="mt-0.5 shrink-0" style={{ color: "var(--primary-dark)" }} />
                    <p className="text-sm" style={{ color: "var(--primary-dark)" }}>
                      <span className="font-semibold">Suggested fix — </span>
                      {issue.suggestion}
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="flex items-center gap-1.5 text-xs font-medium" style={{ color: "var(--ink-faint)" }}>
                      <Scale size={13} />
                      {issue.rule_reference}
                    </p>
                    <Link
                      href="/chat"
                      className="text-xs font-semibold flex items-center gap-1"
                      style={{ color: "var(--primary)" }}
                    >
                      Ask AI advisor <ArrowRight size={12} />
                    </Link>
                  </div>
                </div>
              );
            })}

            {issues.length === 0 && (
              <div className="card p-10 text-center">
                <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
                  No issues at this severity. Upload some invoices to see compliance checks run.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
