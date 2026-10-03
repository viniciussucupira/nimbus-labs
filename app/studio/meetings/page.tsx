import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { ensureStatsId } from "@/lib/store";
import { studioPath, studioView } from "@/lib/studio-route";
import { StudioHeader } from "@/components/studio-header";
import { StudioStorePin } from "@/components/studio-store-pin";
import { MeetingConnections } from "@/components/meeting-connections";
import { ToastOnLoad } from "@/components/toast";
import { ACCOUNT_NAMES, meetView } from "@/lib/meet-connect";
import { configuredProviders, offeredProviders } from "@/lib/meet-providers";
import { MEET_NAMES, isMeetProvider } from "@/lib/call-setup";

export const metadata: Metadata = {
  title: "Video calls — Marktmorgen",
  robots: { index: false, follow: false },
};

type Params = { searchParams: Promise<{ [key: string]: string | string[] | undefined }> };

/** What the page says after a trip to Google or Zoom, by the word the callback sent back. */
function outcome(word: string, provider: string): { tone: "ok" | "warn" | "error"; text: string } | null {
  const name = isMeetProvider(provider) ? ACCOUNT_NAMES[provider] : "The account";
  switch (word) {
    case "connected":
      // A pure confirmation: a toast, and the address loses the word.
      return { tone: "ok", text: `${name} connected.` };
    case "declined":
      return { tone: "warn", text: `${name} was not connected: the permission was not given. Nothing was changed.` };
    case "scope":
      return {
        tone: "warn",
        text:
          provider === "google"
            ? "Google Calendar was not connected: the box that lets us add events to your calendar was left unchecked. Connect again and check it."
            : "Zoom was not connected: it did not give permission to make meetings. Connect again and allow everything it asks for.",
      };
    case "refused":
    case "account":
      return { tone: "error", text: `${name} did not complete the connection. Nothing was changed; try again in a moment.` };
    case "seal":
      return { tone: "error", text: "Access cannot be stored safely on this deployment yet, so nothing was connected." };
    case "expired":
      return { tone: "warn", text: "That connection attempt had expired or was started in another session. Start it again from this page." };
    case "limited":
      return { tone: "warn", text: "That is too many attempts in a few minutes. Wait a moment and try again." };
    case "host":
      return { tone: "warn", text: "Zoom did not give us the host link for that meeting just now. Start it from the Zoom app, signed in to the connected account." };
    case "error":
      return { tone: "error", text: "Something went wrong on our side. Nothing was changed; try again in a moment." };
    default:
      return null;
  }
}

/**
 * The store's Google Calendar and Zoom (lib/meet-connect.ts): connect one,
 * and each booking of a call set to it gets its own Google Meet or Zoom
 * meeting (lib/meet-links.ts). Only for the owner and Admins ("settings"),
 * and not there at all until the deployment has the app's keys.
 */
export default async function StudioMeetingsPage({ searchParams }: Params) {
  // Read first, so the page is drawn for each visit: whether it exists at
  // all is decided by the deployment's settings now, never at build time.
  const jar = await cookies();
  if (configuredProviders().length === 0) notFound();
  const query = await searchParams;
  const found = await studioView(jar, typeof query.store === "string" ? query.store : undefined, "settings");
  if (!found.ok) {
    if (found.reason === "signed_out") redirect("/signin");
    redirect(found.store ? studioPath(found.store, "team=forbidden") : "/studio");
  }
  const { view: access } = found;
  const loaded = access.store;
  const store = loaded.statsId ? loaded : ((await ensureStatsId(access.ref)) ?? loaded);
  const view = await meetView(store.statsId, store).catch((error) => {
    console.error("reading the meeting connections failed", error);
    return null;
  });
  // What the store is offered, and any account it has connected either way.
  const offered = view ? view.providers : offeredProviders(store);
  if (offered.length === 0) notFound();
  const said = outcome(typeof query.meet === "string" ? query.meet : "", typeof query.p === "string" ? query.p : "");
  const names = offered.map((p) => MEET_NAMES[p]);

  return (
    <div className="min-h-screen bg-paper text-ink">
      <StudioHeader
        current={store}
        role={access.role}
        stores={access.stores}
        owned={access.owned}
        action={{ href: studioPath(store), label: "Back to the studio", short: "Studio" }}
      />
      <StudioStorePin sid={store.sid}>
        <main id="content" className="container-page pb-20 pt-10 sm:pt-14">
          <p className="eyebrow">Video calls</p>
          <h1 className="t-h2 mt-3">{`${names.join(" and ")} links, made for your bookings`}</h1>
          <p className="mt-3 max-w-2xl text-ink-soft">
            {`Connect your own ${offered.map((p) => ACCOUNT_NAMES[p]).join(" or ")} account, and each call you set to use it gets a meeting on that account for every booking, with the link in the buyer's confirmation, reminders and calendar file. Nothing to copy and paste.`}
          </p>

          {said?.tone === "ok" ? <ToastOnLoad message={said.text} param="meet" /> : null}
          {said && said.tone !== "ok" ? (
            <p
              className={`notice mt-6 max-w-3xl ${said.tone === "warn" ? "notice-warn" : "notice-error"}`}
              role={said.tone === "error" ? "alert" : "status"}
            >
              {said.text}
            </p>
          ) : null}

          {view === null ? (
            <p className="notice notice-error mt-6" role="alert">
              We could not read your connections just now. Nothing was changed. Try again in a moment.
            </p>
          ) : (
            <MeetingConnections view={view} pin={store.sid ? `?store=${store.sid}` : ""} />
          )}
        </main>
      </StudioStorePin>
    </div>
  );
}
