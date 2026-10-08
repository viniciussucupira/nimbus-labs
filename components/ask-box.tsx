"use client";

import { useState, useSyncExternalStore } from "react";
import { MAX_QUESTION, MIN_QUESTION } from "@/lib/answers-rules";

const never = () => () => {};

/**
 * "A question before you buy?" on a product's page (lib/answers.ts): the
 * visitor types one, and is answered from what the page says, or told plainly
 * that the page does not say.
 *
 * Drawn only once the browser has taken the page over: it needs JavaScript to
 * ask, and a box that does nothing when pressed is worse than no box. The
 * page sells without it.
 */
export function AskBox({ handle, product, storeName }: { handle: string; product: string; storeName: string }) {
  const here = useSyncExternalStore(never, () => true, () => false);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<{ asked: string; text: string; known: boolean } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  if (!here) return null;

  const closed = `Questions are closed right now. Ask ${storeName} before you buy.`;
  const NOTES: Record<string, string> = {
    question: "Type your question first.",
    slow: "Too many questions just now. Try again in a few minutes.",
    closed,
    off: closed,
    failed: "That could not be answered just now. Try again in a moment.",
  };

  async function ask(event: React.FormEvent) {
    event.preventDefault();
    const asked = question.trim();
    if (busy) return;
    if (asked.length < MIN_QUESTION) {
      setNote(NOTES.question);
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      const response = await fetch("/api/store/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle, product, question: asked }),
      });
      const data = (await response.json().catch(() => ({}))) as { ok?: boolean; answer?: string; known?: boolean; error?: string };
      if (data.ok && data.answer) {
        setAnswer({ asked, text: data.answer, known: data.known === true });
        setQuestion("");
      } else {
        setNote(NOTES[data.error ?? ""] ?? NOTES.failed);
      }
    } catch {
      setNote(NOTES.failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="st-ask mt-4" aria-label="Ask a question about this product">
      <form onSubmit={ask}>
        <label htmlFor={`ask-${product}`} className="st-label">
          A question before you buy?
        </label>
        <div className="mt-2 flex gap-2">
          <input
            id={`ask-${product}`}
            className="st-field min-w-0 flex-1"
            maxLength={MAX_QUESTION}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Is it a PDF? How long do I have access?"
            autoComplete="off"
            enterKeyHint="send"
          />
          <button type="submit" className="btn st-btn-ghost shrink-0" disabled={busy} aria-busy={busy}>
            {busy ? "Reading…" : "Ask"}
          </button>
        </div>
      </form>
      <div aria-live="polite">
        {answer ? (
          <div className="st-ask-answer mt-3">
            <p className="st-muted text-xs font-semibold">{answer.asked}</p>
            <p className="mt-1 leading-relaxed">{answer.text}</p>
          </div>
        ) : null}
        {note ? (
          <p className="st-note mt-3 text-sm" role="status">
            {note}
          </p>
        ) : null}
      </div>
      <p className="st-muted mt-2 text-xs">
        {`Answered automatically, only from what this page says. Your question may be shown to ${storeName}, without anything about who you are, so leave personal details out.`}
      </p>
    </section>
  );
}
