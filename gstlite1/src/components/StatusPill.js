const TONES = {
  low: { bg: "var(--success-light)", fg: "var(--success)", label: "Low risk" },
  medium: { bg: "var(--warning-light)", fg: "var(--warning)", label: "Medium risk" },
  high: { bg: "var(--danger-light)", fg: "var(--danger)", label: "High risk" },
  unscored: { bg: "var(--surface-sunken)", fg: "var(--ink-soft)", label: "Not scored" },

  uploaded: { bg: "var(--surface-sunken)", fg: "var(--ink-soft)", label: "Uploaded" },
  parsed: { bg: "var(--info-light)", fg: "var(--info)", label: "Parsed" },
  validated: { bg: "var(--success-light)", fg: "var(--success)", label: "Validated" },
  flagged: { bg: "var(--danger-light)", fg: "var(--danger)", label: "Flagged" },
  filed: { bg: "var(--primary-light)", fg: "var(--primary-dark)", label: "Filed" },
};

export default function StatusPill({ tone = "unscored", children }) {
  const t = TONES[tone] || TONES.unscored;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap"
      style={{ background: t.bg, color: t.fg }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: t.fg }}
        aria-hidden="true"
      />
      {children || t.label}
    </span>
  );
}
