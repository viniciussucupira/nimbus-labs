"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";

/*
 * The confirmation toast: a small violet box, bottom right, that says an
 * action the person just took has worked. It is for successes that would
 * otherwise be invisible, off-screen or ambiguous, and for nothing else.
 * Errors, and anything the person has to read or keep, stay inline next to
 * the control that caused them.
 *
 * `toast()` works from any client component without a provider: it fires a
 * window event that the one Toaster, mounted in the root layout, listens for.
 */

const EVENT = "nimbus:toast";
const FLASH_KEY = "nimbus:flash-toast";
const SHOWN_FOR = 5000;

// Effects run children first, so a page that confirms something on arrival
// can call toast() a moment before the Toaster in the layout is listening.
// That one message waits here instead of being lost.
let listening = false;
let waiting: string | null = null;

/** Shows a confirmation now. One short sentence, ending with a full stop. */
export function toast(message: string): void {
  if (typeof window === "undefined") return;
  if (!listening) waiting = message;
  window.dispatchEvent(new CustomEvent<string>(EVENT, { detail: message }));
}

/** Shows a confirmation after the next page load, for an action that ends in a navigation. */
export function flashToast(message: string): void {
  try {
    window.sessionStorage.setItem(FLASH_KEY, message);
  } catch {
    /* Storage refused: the page still works, just without the confirmation. */
  }
}

function takeFlash(): string | null {
  try {
    const message = window.sessionStorage.getItem(FLASH_KEY);
    if (message) window.sessionStorage.removeItem(FLASH_KEY);
    return message;
  } catch {
    return null;
  }
}

const reducedMotion = () =>
  typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

type Current = { id: number; message: string };

/** Mounted once, in the root layout. */
export function Toaster() {
  const [current, setCurrent] = useState<Current | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const next = useRef(0);
  const timer = useRef<number | undefined>(undefined);
  const remaining = useRef(SHOWN_FOR);
  const deadline = useRef(0);
  const hovered = useRef(false);
  const focused = useRef(false);
  const leaving = useRef(false);
  // Where focus was before it moved into the toast, so closing it from the
  // keyboard puts the person back where they were rather than on <body>.
  const returnTo = useRef<HTMLElement | null>(null);

  const stopTimer = useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = undefined;
  }, []);

  const dismiss = useCallback(() => {
    stopTimer();
    const element = box.current;
    if (!element || leaving.current) return;
    leaving.current = true;
    const hadFocus = element.contains(document.activeElement);
    const finish = () => {
      const id = Number(element.dataset.id);
      setCurrent((shown) => (shown && shown.id === id ? null : shown));
      if (hadFocus && returnTo.current?.isConnected) returnTo.current.focus();
      returnTo.current = null;
    };
    const animation = element.animate(
      reducedMotion()
        ? [{ opacity: 1 }, { opacity: 0 }]
        : [
            { opacity: 1, transform: "translateY(0)" },
            { opacity: 0, transform: "translateY(4px)" },
          ],
      { duration: 160, easing: "ease-in", fill: "forwards" },
    );
    animation.onfinish = finish;
    animation.oncancel = finish;
  }, [stopTimer]);

  const startTimer = useCallback(() => {
    stopTimer();
    if (hovered.current || focused.current || leaving.current) return;
    deadline.current = Date.now() + remaining.current;
    timer.current = window.setTimeout(dismiss, remaining.current);
  }, [dismiss, stopTimer]);

  const pauseTimer = useCallback(() => {
    if (timer.current === undefined) return;
    stopTimer();
    remaining.current = Math.max(0, deadline.current - Date.now());
  }, [stopTimer]);

  useEffect(() => {
    const show = (event: Event) => {
      const message = (event as CustomEvent<string>).detail;
      if (typeof message !== "string" || !message) return;
      waiting = null;
      next.current += 1;
      setCurrent({ id: next.current, message });
    };
    window.addEventListener(EVENT, show);
    listening = true;
    const early = waiting ?? takeFlash();
    waiting = null;
    if (early) toast(early);
    return () => {
      listening = false;
      window.removeEventListener(EVENT, show);
    };
  }, []);

  // A new toast replaces the one showing: fresh timer, fresh entrance.
  useLayoutEffect(() => {
    if (!current) return;
    leaving.current = false;
    hovered.current = false;
    focused.current = false;
    remaining.current = SHOWN_FOR;
    box.current?.animate(
      reducedMotion()
        ? [{ opacity: 0 }, { opacity: 1 }]
        : [
            { opacity: 0, transform: "translateY(8px)" },
            { opacity: 1, transform: "translateY(0)" },
          ],
      { duration: 200, easing: "ease-out" },
    );
    startTimer();
    return stopTimer;
  }, [current, startTimer, stopTimer]);

  return (
    <div className="nb-toast-region">
      {/* Always in the page, empty when idle, so each message is announced. */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {current ? <span key={current.id}>{current.message}</span> : null}
      </div>
      {current ? (
        <div
          key={current.id}
          ref={box}
          data-id={current.id}
          className="nb-toast"
          onPointerEnter={() => {
            hovered.current = true;
            pauseTimer();
          }}
          onPointerLeave={() => {
            hovered.current = false;
            startTimer();
          }}
          onFocus={(event) => {
            if (!focused.current) {
              const from = event.relatedTarget;
              returnTo.current = from instanceof HTMLElement && !event.currentTarget.contains(from) ? from : null;
            }
            focused.current = true;
            pauseTimer();
          }}
          onBlur={(event) => {
            if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
            focused.current = false;
            startTimer();
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              dismiss();
            }
          }}
        >
          <span className="nb-toast-icon" aria-hidden="true">
            <Icon name="check" size={14} strokeWidth={2.5} />
          </span>
          {/* Read out by the live region above; hidden here so it is not read twice. */}
          <p className="nb-toast-text" aria-hidden="true">
            {current.message}
          </p>
          <button type="button" className="nb-toast-close" aria-label="Dismiss" onClick={dismiss}>
            <Icon name="close" size={16} strokeWidth={2} />
          </button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Turns a success-only notice that arrives in the address (like
 * /signin?status=out) into a toast, then takes the parameter off the address
 * so a reload or a shared link does not say it again.
 */
export function ToastOnLoad({ message, param }: { message: string; param: string }) {
  useEffect(() => {
    toast(message);
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete(param);
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    } catch {
      /* The address stays as it was; the confirmation was still shown. */
    }
  }, [message, param]);
  return null;
}
