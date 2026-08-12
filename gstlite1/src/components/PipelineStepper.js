import { pipelineStages } from "@/lib/mock-data";
import { Check } from "lucide-react";

// The signature element: a stage pipeline echoing the product's real
// architecture (upload -> parse -> validate -> risk-score -> file).
export default function PipelineStepper({ currentStage = "validated", compact = false }) {
  const currentIndex = pipelineStages.findIndex((s) => s.key === currentStage);

  return (
    <div className={compact ? "flex items-center" : "flex items-center w-full"}>
      {pipelineStages.map((stage, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        const isLast = i === pipelineStages.length - 1;
        return (
          <div key={stage.key} className={compact ? "flex items-center" : "flex items-center flex-1 last:flex-none"}>
            <div className="flex flex-col items-center gap-1.5">
              <div
                className="flex items-center justify-center rounded-full transition-colors"
                style={{
                  width: compact ? 20 : 28,
                  height: compact ? 20 : 28,
                  background: done
                    ? "var(--primary)"
                    : active
                    ? "var(--surface)"
                    : "var(--surface-sunken)",
                  border: active ? "2px solid var(--primary)" : "2px solid transparent",
                }}
              >
                {done ? (
                  <Check size={compact ? 12 : 14} color="white" strokeWidth={3} />
                ) : (
                  <span
                    className="text-[11px] font-semibold"
                    style={{ color: active ? "var(--primary)" : "var(--ink-faint)" }}
                  >
                    {i + 1}
                  </span>
                )}
              </div>
              {!compact && (
                <span
                  className="text-[11px] font-medium whitespace-nowrap"
                  style={{ color: active ? "var(--ink)" : "var(--ink-faint)" }}
                >
                  {stage.label}
                </span>
              )}
            </div>
            {!isLast && (
              <div
                className={compact ? "h-[2px] w-4 mx-1 rounded-full" : "h-[2px] flex-1 mx-1.5 rounded-full mb-4"}
                style={{ background: done ? "var(--primary)" : "var(--border)" }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
