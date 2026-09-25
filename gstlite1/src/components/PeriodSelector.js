"use client";

import { Calendar, ChevronDown } from "lucide-react";

export function formatPeriodName(periodStr) {
  if (!periodStr) return "";
  if (periodStr.toLowerCase() === "all") return "All Periods";
  const parts = periodStr.split("-");
  if (parts.length === 2) {
    const year = parts[0];
    const month = parseInt(parts[1], 10);
    const months = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    if (month >= 1 && month <= 12) {
      return `${months[month - 1]} ${year}`;
    }
  }
  return periodStr;
}

export default function PeriodSelector({
  periods = [],
  selectedPeriod,
  onChange,
  className = "",
  showAllOption = true,
}) {
  const displayList = [...periods];
  if (showAllOption && !displayList.includes("all")) {
    displayList.push("all");
  }

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <div
        className="flex items-center gap-2 rounded-lg border px-3 py-1.5 transition-shadow"
        style={{
          background: "var(--surface)",
          borderColor: "var(--border)",
        }}
      >
        <Calendar size={14} style={{ color: "var(--primary)" }} />
        <span className="text-xs font-semibold uppercase tracking-wider hidden sm:inline" style={{ color: "var(--ink-faint)" }}>
          Period:
        </span>
        <div className="relative flex items-center">
          <select
            value={selectedPeriod || ""}
            onChange={(e) => onChange(e.target.value)}
            className="appearance-none bg-transparent pr-6 text-xs md:text-sm font-semibold cursor-pointer outline-none font-mono-data"
            style={{ color: "var(--ink)" }}
          >
            {displayList.map((p) => (
              <option key={p} value={p}>
                {p === "all" ? "All Periods" : `${formatPeriodName(p)} (${p})`}
              </option>
            ))}
          </select>
          <ChevronDown
            size={12}
            className="pointer-events-none absolute right-0"
            style={{ color: "var(--ink-faint)" }}
          />
        </div>
      </div>
    </div>
  );
}
