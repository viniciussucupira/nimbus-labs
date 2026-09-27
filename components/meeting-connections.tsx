"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/toast";
import { Icon } from "@/components/icons";
import type { MeetProvider } from "@/lib/call-setup";
import type { MeetView } from "@/lib/meet-connect";

/** Each account as the studio describes it: what it makes, and what connecting it lets us do. */
const ACCOUNTS: Record<
  MeetProvider,
  { name: string; meeting: string; does: string[]; asks: string; limits: string }
> = {
  google: {
    name: "Google Calendar",
    meeting: "Google Meet",
    does: [
      "Makes an event with a Google Meet link on your primary calendar for each booking, with the buyer on its guest list. A group call or a live session gets one event per time, and buyers never see each other's addresses.",
      "Google emails nobody. Buyers get the Meet link in our booking email, reminders and calendar file, like every other call.",
      "Moves the event when a buyer moves their booking. After a full refund, deletes a one-to-one call's event, or takes the buyer off a group's guest list.",
    ],
    asks: "Google will ask to let Nimbus Labs see and edit events on your calendars, and to see your email address. We only ever touch the events we make, on your primary calendar.",
    limits: "How many people can join, and for how long, is Google's to decide by your plan: on a free personal account, a meeting of three or more people ends after 60 minutes.",
  },
  zoom: {
    name: "Zoom",
    meeting: "Zoom",
    does: [
      "Makes a scheduled Zoom meeting on your account for each booking; a group call or a live session gets one meeting per time.",
      "Buyers get its join link in our booking email, reminders and calendar file. You start it from Zoom, or with Start in Zoom next to the booking in your studio.",
      "Moves the meeting when a buyer moves their booking, and deletes a one-to-one call's meeting after a full refund.",
    ],
    asks: "Zoom will ask to let Nimbus Labs create, read, change and delete your meetings, and to see your profile. We only ever touch the meetings we make.",
    limits: "How many people can join, and for how long, is Zoom's to decide by your plan: on a free Zoom account, every meeting ends after 40 minutes.",
  },
};

const MESSAGES: Record<string, string> = {
  signed_out: "Your session ended. Log in again.",
  role: "Only the store's owner and Admins can do that.",
  limited: "That is too many changes in a minute. Wait a moment and try again.",
  server_error: "Something went wrong on our side. Nothing was changed; try again in a moment.",
};

// In UTC, said so: the server draws this first, and the browser must draw the same text.
function since(ms: number): string {
  return ms ? new Date(ms).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }) : "";
}

function when(ms: number): string {
  return `${new Date(ms).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC" })} UTC`;
}

/**
 * The store's Google Calendar and Zoom connections (lib/meet-connect.ts):
 * connect (a form that leaves for the provider's consent page), connect a
 * different account, or disconnect, with what each one does said plainly.
 * Only the providers this deployment has switched on are shown.
 */
export function MeetingConnections({ view, pin }: { view: MeetView; pin: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<MeetProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function disconnect(provider: MeetProvider) {
    setBusy(provider);
    setError(null);
    try {
      const response = await fetch("/api/integrations/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disconnect", provider }),
      });
      const data = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (data.ok) {
        toast(`${ACCOUNTS[provider].name} disconnected.`);
        router.refresh();
        return;
      }
      setError(MESSAGES[data.error ?? ""] ?? MESSAGES.server_error);
    } catch {
      setError(MESSAGES.server_error);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <div className="grid min-w-0 gap-6">
        {view.providers.map((provider) => {
          const info = ACCOUNTS[provider];
          const connection = view.connected[provider] ?? null;
          const start = `/api/integrations/${provider}/start${pin}`;
          return (
            <section key={provider} className="card p-6 sm:p-8" aria-labelledby={`meet-${provider}-title`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-lilac text-violet-deep">
                    <Icon name={provider === "google" ? "calendar" : "video"} size={18} />
                  </span>
                  <div className="min-w-0">
                    <h2 id={`meet-${provider}-title`} className="text-lg font-semibold tracking-[-0.02em] text-ink">
                      {info.name}
                    </h2>
                    {connection ? (
                      <p className="text-sm text-ink-soft">
                        <span className="break-all">{connection.account}</span>
                        <span className="whitespace-nowrap">{` · since ${since(connection.connectedAt)}`}</span>
                      </p>
                    ) : (
                      <p className="text-sm text-ink-soft">{`${info.meeting} links for every booking`}</p>
                    )}
                  </div>
                </div>
                <span className={`tag ${connection && !connection.broken ? "tag-live" : ""}`}>
                  {connection ? (connection.broken ? "Needs connecting again" : "Connected") : "Not connected"}
                </span>
              </div>

              {connection?.broken ? (
                <p className="notice notice-warn mt-4" role="status">
                  {`${connection.broken}. Until it is connected again, bookings of calls set to ${info.meeting} get your own link, or a private video room.`}
                </p>
              ) : null}

              <ul className="mt-4 space-y-2 text-sm text-ink-soft">
                {info.does.map((line) => (
                  <li key={line} className="flex items-start gap-2">
                    <Icon name="check" size={16} className="mt-0.5 shrink-0 text-mint-deep" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-sm text-ink-soft">{info.limits}</p>

              <div className="mt-5 flex flex-wrap items-center gap-2">
                {!connection || connection.broken ? (
                  <form action={start} method="post">
                    <button type="submit" className="btn btn-primary">
                      {connection ? `Connect ${info.name} again` : `Connect ${info.name}`}
                    </button>
                  </form>
                ) : (
                  <form action={start} method="post">
                    <button type="submit" className="btn btn-secondary btn-sm">
                      <Icon name="refresh" size={16} />
                      Use a different account
                    </button>
                  </form>
                )}
                {connection ? (
                  <button
                    type="button"
                    onClick={() => disconnect(provider)}
                    disabled={busy !== null}
                    aria-busy={busy === provider}
                    className="btn btn-ghost btn-sm"
                  >
                    <Icon name="trash" size={16} />
                    {busy === provider ? "Disconnecting…" : "Disconnect"}
                  </button>
                ) : null}
              </div>
              <p className="mt-3 text-xs text-ink-soft">{info.asks}</p>
            </section>
          );
        })}
        {error ? (
          <p className="notice notice-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      <div className="grid min-w-0 gap-6">
        <section className="card p-6 sm:p-8" aria-labelledby="meet-next-title">
          <h2 id="meet-next-title" className="text-lg font-semibold tracking-[-0.02em] text-ink">
            Then choose it for a call or a live event
          </h2>
          <p className="mt-2 text-sm text-ink-soft">
            Under Products, open a call&apos;s hours or sessions and pick it in <span className="font-semibold text-ink">Where the call happens</span>.
            Calls you do not change keep the link or room they have.
          </p>
          <p className="mt-2 text-sm text-ink-soft">
            If a meeting cannot be made when someone books, they get your own link, or a private video room when you have none, so
            no booking waits. We try again over the next hours, and if it works while there are more than two hours to go, you
            and they are emailed the new link.
          </p>
          <p className="mt-2 text-sm text-ink-soft">
            A community live event can use it too: pick it under <span className="font-semibold text-ink">Where</span> when you schedule one.
            It gets one meeting, with nobody on its guest list, and members see its link only on the event&apos;s page, 15 minutes before
            the start. If it cannot be made, the event uses its private video room.
          </p>
        </section>

        <section className="card p-6 sm:p-8" aria-labelledby="meet-log-title">
          <h2 id="meet-log-title" className="text-lg font-semibold tracking-[-0.02em] text-ink">
            Recent problems
          </h2>
          {view.problems.length ? (
            <ul className="mt-3 divide-y divide-line text-sm">
              {view.problems.map((p, i) => (
                <li key={`${p.at}-${i}`} className="py-2.5">
                  <span className="block break-words font-semibold text-ink">{p.what}</span>
                  <span className="block break-words text-ink-soft">{`${p.error} · ${when(p.at)}`}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-ink-soft">None. A meeting that could not be made, moved or removed is listed here.</p>
          )}
        </section>
      </div>
    </div>
  );
}
