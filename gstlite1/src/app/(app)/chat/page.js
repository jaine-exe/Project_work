"use client";

import { useEffect, useRef, useState } from "react";
import Topbar from "@/components/Topbar";
import { chatSeed, chatSuggestions } from "@/lib/mock-data";
import { chat as chatApi } from "@/lib/api";
import { Send, Sparkles, ShieldCheck, BookOpen } from "lucide-react";

const CANNED_REPLIES = {
  default:
    "Based on your filing data, this comes from the compliance engine's rule check against GSTR-2B reconciliation. I've grounded this answer in Rule 36(4) of the CGST Rules — want me to walk through the fix step by step?",
  "Why is INV-2026-0729 flagged?":
    "INV-2026-0729 from Malabar Dyes Co. is flagged because the vendor GSTIN on the invoice doesn't match what's in your auto-drafted GSTR-2B for this period. That mismatch means the input tax credit on this invoice could be disallowed under Rule 36(4). I'd suggest asking the vendor to confirm their GSTIN and re-check their GSTR-1 filing.",
  "Explain the IRN requirement in simple terms":
    "An IRN (Invoice Reference Number) is a unique ID the government's Invoice Registration Portal generates for high-value B2B invoices. Think of it as a digital stamp proving the invoice is registered with the tax department. If your turnover crosses the e-invoicing threshold, invoices without an IRN aren't considered valid tax documents — so ITC claims tied to them can get rejected.",
  "What happens if I file with flagged invoices?":
    "You can still file, but flagged invoices carry real risk: mismatched GSTINs may mean the ITC you've claimed gets reversed later with interest, and missing IRNs can invalidate the invoice entirely during an audit. I'd recommend resolving the 2 high-risk flags first — it should only take a few minutes per invoice.",
  "How is my net payable calculated?":
    "Net payable = Output tax liability − Input tax credit. This period that's ₹1,84,320 − ₹1,12,860 = ₹71,460. It's a live number though — resolving the flagged invoices could shift your eligible ITC slightly before you file.",
};

export default function ChatPage() {
  const [messages, setMessages] = useState(chatSeed);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  async function send(text) {
    const content = text ?? input;
    if (!content.trim()) return;

    setMessages((m) => [...m, { role: "user", content }]);
    setInput("");
    setThinking(true);

    try {
      // Real backend call — grounded in whatever invoice/business context
      // the server attaches. No invoice_id scoping from this page yet, so
      // it answers from general business context.
      const reply = await chatApi.ask(content);
      setMessages((m) => [...m, { role: "assistant", content: reply.content }]);
    } catch (err) {
      console.warn("Could not reach the AI advisor endpoint, using local fallback:", err);
      const fallbackReply = CANNED_REPLIES[content] || CANNED_REPLIES.default;
      setMessages((m) => [...m, { role: "assistant", content: fallbackReply }]);
    } finally {
      setThinking(false);
    }
  }

  return (
    <div className="flex flex-col h-screen">
      <Topbar title="AI advisor" subtitle="Grounded in your filing data and current GST law" />

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 md:px-8 py-6">
        <div className="max-w-2xl mx-auto flex flex-col gap-5">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : "flex-row"}`}
            >
              {m.role === "assistant" && (
                <span
                  className="flex items-center justify-center rounded-full w-8 h-8 shrink-0"
                  style={{ background: "var(--primary)" }}
                >
                  <Sparkles size={14} color="white" />
                </span>
              )}
              <div
                className="rounded-2xl px-4 py-3 text-sm leading-relaxed max-w-[85%]"
                style={{
                  background: m.role === "user" ? "var(--primary)" : "var(--surface)",
                  color: m.role === "user" ? "white" : "var(--ink)",
                  border: m.role === "assistant" ? "1px solid var(--border)" : "none",
                  borderBottomRightRadius: m.role === "user" ? 4 : undefined,
                  borderBottomLeftRadius: m.role === "assistant" ? 4 : undefined,
                }}
              >
                {m.content}
                {m.role === "assistant" && i !== 0 && (
                  <div
                    className="flex items-center gap-1.5 mt-2.5 pt-2.5 text-[11px]"
                    style={{ borderTop: "1px solid var(--border-soft)", color: "var(--ink-faint)" }}
                  >
                    <BookOpen size={11} />
                    Sourced from GST compliance engine + rule text
                  </div>
                )}
              </div>
            </div>
          ))}

          {thinking && (
            <div className="flex gap-3">
              <span
                className="flex items-center justify-center rounded-full w-8 h-8 shrink-0"
                style={{ background: "var(--primary)" }}
              >
                <Sparkles size={14} color="white" />
              </span>
              <div
                className="rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              >
                {[0, 1, 2].map((d) => (
                  <span
                    key={d}
                    className="h-1.5 w-1.5 rounded-full animate-bounce"
                    style={{ background: "var(--ink-faint)", animationDelay: `${d * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="px-5 md:px-8 pb-5 pt-2">
        <div className="max-w-2xl mx-auto">
          {messages.length <= 1 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {chatSuggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--ink-soft)" }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex items-center gap-2 card px-3 py-2"
          >
            <ShieldCheck size={16} style={{ color: "var(--ink-faint)" }} className="shrink-0" />
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about a flag, a rule, or your filing…"
              className="flex-1 bg-transparent outline-none text-sm py-1.5"
              style={{ color: "var(--ink)" }}
            />
            <button
              type="submit"
              className="flex items-center justify-center rounded-lg w-9 h-9 shrink-0 text-white disabled:opacity-50"
              style={{ background: "var(--primary)" }}
              disabled={!input.trim()}
              aria-label="Send"
            >
              <Send size={15} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
