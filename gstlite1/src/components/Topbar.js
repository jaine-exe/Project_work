import { Bell, Search } from "lucide-react";
import { readiness } from "@/lib/mock-data";

export default function Topbar({ title, subtitle, action }) {
  return (
    <header
      className="sticky top-0 z-20 flex items-center justify-between gap-4 px-5 md:px-8 py-4 backdrop-blur"
      style={{ background: "rgba(244,246,245,0.85)", borderBottom: "1px solid var(--border-soft)" }}
    >
      <div className="min-w-0">
        <h1 className="font-display text-xl md:text-[22px] font-bold truncate" style={{ color: "var(--ink)" }}>
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm mt-0.5" style={{ color: "var(--ink-soft)" }}>
            {subtitle}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {action}
        <div
          className="hidden lg:flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium"
          style={{ background: "var(--warning-light)", color: "var(--warning)" }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--warning)" }} />
          GSTR-1 due in {readiness.daysToDeadline} days
        </div>

        <button
          className="hidden sm:flex items-center justify-center rounded-full h-9 w-9 border transition-colors"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
          aria-label="Search"
        >
          <Search size={16} color="var(--ink-soft)" />
        </button>

        <button
          className="relative flex items-center justify-center rounded-full h-9 w-9 border"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
          aria-label="Notifications"
        >
          <Bell size={16} color="var(--ink-soft)" />
          <span
            className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full"
            style={{ background: "var(--danger)" }}
          />
        </button>
      </div>
    </header>
  );
}
