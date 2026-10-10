"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Action = { type: "link"; id: string } | { type: "product"; id: string } | { type: "kit" } | { type: "store"; on: boolean };

/** One button that acts on a notice (app/api/takedown), and says what it did. */
export function TakedownButton({ token, action, label, danger = false }: { token: string; action: Action; label: string; danger?: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [said, setSaid] = useState("");
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={state !== "idle"}
        aria-busy={state === "busy"}
        onClick={async () => {
          setState("busy");
          try {
            const response = await fetch("/api/takedown", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, action }) });
            const data = (await response.json().catch(() => ({}))) as { ok?: boolean; done?: string; error?: string };
            if (data.ok) {
              setState("done");
              setSaid(`Done: ${data.done} The creator was emailed.`);
              router.refresh();
              return;
            }
            setState("idle");
            setSaid(data.error === "nothing" ? "Nothing to do: it is already down." : "It did not work. Try again.");
          } catch {
            setState("idle");
            setSaid("It did not work. Try again.");
          }
        }}
        className={`btn btn-sm ${danger ? "btn-danger-solid" : "btn-secondary"}`}
      >
        {state === "busy" ? "Working…" : label}
      </button>
      {said ? <span role="status" className="text-sm text-ink-soft">{said}</span> : null}
    </span>
  );
}
