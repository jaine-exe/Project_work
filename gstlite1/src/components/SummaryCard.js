import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";

const TONE_BG = {
  primary: "var(--primary-light)",
  info: "var(--info-light)",
  gold: "var(--gold-light)",
  danger: "var(--danger-light)",
};
const TONE_FG = {
  primary: "var(--primary-dark)",
  info: "var(--info)",
  gold: "var(--gold)",
  danger: "var(--danger)",
};

export default function SummaryCard({ label, value, trend, trendDirection, tone = "primary" }) {
  const TrendIcon =
    trendDirection === "up" ? ArrowUpRight : trendDirection === "down" ? ArrowDownRight : Minus;
  const trendGood =
    (tone === "danger" && trendDirection !== "up") ||
    (tone !== "danger" && trendDirection !== "down");

  return (
    <div className="card p-5 flex flex-col gap-4 animate-fade-up">
      <div className="flex items-start justify-between">
        <p className="text-[13px] font-medium" style={{ color: "var(--ink-soft)" }}>
          {label}
        </p>
        <span
          className="flex items-center justify-center rounded-full w-8 h-8"
          style={{ background: TONE_BG[tone] }}
        >
          <TrendIcon size={14} style={{ color: TONE_FG[tone] }} />
        </span>
      </div>
      <div>
        <p className="font-display text-2xl font-bold" style={{ color: "var(--ink)" }}>
          {value}
        </p>
        <p
          className="text-xs font-medium mt-1"
          style={{ color: trendGood ? "var(--success)" : "var(--danger)" }}
        >
          {trend}
        </p>
      </div>
    </div>
  );
}
