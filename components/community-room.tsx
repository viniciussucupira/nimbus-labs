"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { type ChatRefusal, MAX_CHAT_TEXT, refusalWords } from "@/lib/community-chat";

type Message = { i: number; a: string; text: string; at: number };

const REFUSALS = new Set<string>([
  "off", "empty", "links", "slow", "hourly", "creatorOnly", "muted", "full", "name", "out", "unknown",
]);
const isRefusal = (value: unknown): value is ChatRefusal => typeof value === "string" && REFUSALS.has(value);

/**
 * The room, as it is read and written.
 *
 * It asks for what is new every few seconds and stops asking while the tab is
 * in the background — a room nobody is looking at costs nothing, which is the
 * only reason asking this often is reasonable at all. There is no socket held
 * open, and the page says as much rather than claiming a word it has not
 * earned.
 *
 * Three things it does that matter more than they look:
 *
 *   - It scrolls to the newest message only when the reader was already at the
 *     bottom. Dragging somebody away from what they are reading because
 *     somebody else typed is the commonest thing wrong with a chat room.
 *   - It says what the server said. A cooldown, a muted member, a web address
 *     in a room that does not take them: each is shown in its own words rather
 *     than as "something went wrong".
 *   - It sends with the box emptied and puts the words back if the send fails,
 *     so nothing anybody typed is lost to a dropped connection.
 */
export function CommunityRoom({
  handle,
  first,
  names: firstNames,
  cursor: firstCursor,
  me,
  canWrite,
  owner,
  creatorOnly,
  slow,
  links,
}: {
  handle: string;
  first: Message[];
  names: Record<string, string>;
  cursor: number;
  /** This reader's own key, so their messages sit on their side. */
  me: string;
  canWrite: boolean;
  owner: boolean;
  creatorOnly: boolean;
  slow: number;
  links: boolean;
}) {
  const [messages, setMessages] = useState<Message[]>(first);
  const [names, setNames] = useState<Record<string, string>>(firstNames);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  // Emptying the room asks twice rather than opening a browser dialog: a
  // dialog stops everything on the page until it is answered, and this is a
  // thing done in a hurry.
  const [emptying, setEmptying] = useState(false);
  const cursor = useRef(firstCursor);
  const list = useRef<HTMLUListElement>(null);
  const atBottom = useRef(true);

  const look = useCallback(async () => {
    try {
      const response = await fetch(`/api/store/community/chat?handle=${encodeURIComponent(handle)}&since=${cursor.current}`, {
        credentials: "same-origin",
      });
      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        messages?: Message[];
        cursor?: number;
        names?: Record<string, string>;
      };
      if (!data.ok || !data.messages?.length) return;
      cursor.current = data.cursor ?? cursor.current;
      setNames((held) => ({ ...held, ...data.names }));
      setMessages((held) => {
        const known = new Set(held.map((m) => m.i));
        const added = data.messages!.filter((m) => !known.has(m.i));
        return added.length ? [...held, ...added].slice(-500) : held;
      });
    } catch {
      // A look that failed is a look; the next one is a few seconds away and
      // there is nothing useful to say about one dropped request.
    }
  }, [handle]);

  useEffect(() => {
    let timer: number | undefined;
    const tick = () => {
      // Nothing is asked for while nobody is looking.
      if (!document.hidden) void look();
      timer = window.setTimeout(tick, document.hidden ? 30_000 : 4_000);
    };
    timer = window.setTimeout(tick, 4_000);
    // Coming back to the tab asks right away rather than waiting.
    const onShow = () => {
      if (!document.hidden) void look();
    };
    document.addEventListener("visibilitychange", onShow);
    return () => {
      if (timer) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, [look]);

  useEffect(() => {
    const box = list.current;
    if (box && atBottom.current) box.scrollTop = box.scrollHeight;
  }, [messages]);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const words = text.trim();
    if (!words || sending) return;
    setSending(true);
    setError(null);
    setText("");
    try {
      const response = await fetch("/api/store/community/chat", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle, action: "say", text: words }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        wait?: number;
        message?: Message;
        name?: string;
      };
      if (!data.ok || !data.message) {
        // Back in the box: nothing anybody typed is lost to a refusal.
        setText(words);
        // Every reason has its own sentence, in one place beside the refusals
        // themselves (lib/community-chat.ts). Anything unrecognised is the
        // honest generic one rather than a guess.
        setError(refusalWords(isRefusal(data.error) ? data.error : "unknown", slow, data.wait));
        return;
      }
      cursor.current = Math.max(cursor.current, data.message.i);
      if (data.name) setNames((held) => ({ ...held, [data.message!.a]: data.name! }));
      setMessages((held) => (held.some((m) => m.i === data.message!.i) ? held : [...held, data.message!]));
      atBottom.current = true;
    } catch {
      setText(words);
      setError("That did not send. Try again in a moment.");
    } finally {
      setSending(false);
    }
  }

  /** Takes one message out of the room. The creator's, on anything in it. */
  async function remove(i: number) {
    setError(null);
    try {
      const response = await fetch("/api/store/community/chat", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle, action: "unsay", number: i }),
      });
      const data = (await response.json().catch(() => ({}))) as { ok?: boolean };
      if (!data.ok) {
        setError("That message could not be removed.");
        return;
      }
      setMessages((held) => held.filter((m) => m.i !== i));
    } catch {
      setError("That message could not be removed.");
    }
  }

  /** Empties it. What a creator does after a bad night. */
  async function empty() {
    setError(null);
    try {
      const response = await fetch("/api/store/community/chat", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle, action: "clear" }),
      });
      const data = (await response.json().catch(() => ({}))) as { ok?: boolean };
      if (!data.ok) {
        setError("The room could not be emptied.");
        return;
      }
      setMessages([]);
      setEmptying(false);
    } catch {
      setError("The room could not be emptied.");
    }
  }

  const when = (at: number) =>
    new Date(at * 1000).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  return (
    <div className="mt-5">
      <ul
        ref={list}
        className="cm-room"
        onScroll={(e) => {
          const box = e.currentTarget;
          atBottom.current = box.scrollHeight - box.scrollTop - box.clientHeight < 60;
        }}
      >
        {messages.length === 0 ? (
          <li className="st-muted p-4 text-center text-sm">Nothing said yet.</li>
        ) : (
          messages.map((message) => {
            const mine = message.a === me;
            return (
              <li key={message.i} className={`flex ${mine ? "justify-end" : "justify-start"} px-3 py-1`}>
                <div className={`cm-dm-bubble ${mine ? "cm-dm-mine" : ""}`}>
                  {!mine ? (
                    <p className="text-xs font-bold">{names[message.a] ?? "A member"}</p>
                  ) : null}
                  <p className="cm-text text-[0.9375rem]">{message.text}</p>
                  <p className="st-muted mt-0.5 flex items-center justify-end gap-2 text-[0.6875rem] font-semibold">
                    {owner ? (
                      <button
                        type="button"
                        className="cm-quiet-link cm-mini cm-danger"
                        onClick={() => void remove(message.i)}
                      >
                        Remove
                      </button>
                    ) : null}
                    <span>{when(message.at)}</span>
                  </p>
                </div>
              </li>
            );
          })
        )}
      </ul>

      {canWrite && (!creatorOnly || owner) ? (
        <form onSubmit={send} className="mt-3">
          <label htmlFor="room-text" className="sr-only">Say something</label>
          <div className="flex gap-2">
            <input
              id="room-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={MAX_CHAT_TEXT}
              placeholder="Say something…"
              className="st-field min-w-0 flex-1 !min-h-[44px] !py-2"
              autoComplete="off"
            />
            <button type="submit" className="btn st-btn" disabled={sending || !text.trim()}>Send</button>
          </div>
        </form>
      ) : (
        <p className="st-muted mt-3 text-sm">
          {creatorOnly && !owner ? "Only the creator writes in this room." : "You can read here, but not write."}
        </p>
      )}

      {error ? <p className="cm-flash cm-flash-warn mt-3" role="status">{error}</p> : null}

      {owner && messages.length ? (
        <p className="mt-3">
          {emptying ? (
            <span className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold">Empty the room, for everybody?</span>
              <button type="button" className="cm-pill cm-danger" onClick={() => void empty()}>Yes, empty it</button>
              <button type="button" className="cm-quiet-link cm-mini text-xs font-semibold" onClick={() => setEmptying(false)}>
                Keep it
              </button>
            </span>
          ) : (
            <button type="button" className="cm-quiet-link cm-mini text-xs font-semibold" onClick={() => setEmptying(true)}>
              Empty the room
            </button>
          )}
        </p>
      ) : null}

      <p className="st-muted mt-3 text-xs">
        {[
          "This page checks for new messages every few seconds, and stops while it is in the background.",
          slow > 0 ? `One message every ${slow} seconds.` : "",
          links ? "" : "Web addresses are not written here.",
          `The last ${500} messages are kept.`,
        ]
          .filter(Boolean)
          .join(" ")}
      </p>
    </div>
  );
}
