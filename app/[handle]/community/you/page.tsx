import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { normaliseHandle, storeForPage } from "@/lib/store";
import { lookStyle } from "@/lib/store-look";
import { communityViewer } from "@/lib/community-access";
import { canAnnounceByEmail } from "@/lib/community-mail";
import { MAX_DISPLAY_NAME } from "@/lib/community-text";
import { Carry, CommunityBar, NOTICES } from "@/components/community-parts";

type Params = { params: Promise<{ handle: string }>; searchParams: Promise<{ [key: string]: string | string[] | undefined }> };

export const metadata: Metadata = {
  title: "You — Nimbus Labs",
  robots: { index: false, follow: false },
};

/** A member's own choices: the name they are seen by, the directory, the emails. */
export default async function CommunityYouPage({ params, searchParams }: Params) {
  const { handle: raw } = await params;
  const decoded = decodeURIComponent(raw);
  if (!decoded.startsWith("@")) notFound();
  const store = await storeForPage(normaliseHandle(decoded));
  if (!store) notFound();
  const viewer = await communityViewer(store, await cookies());
  if (viewer.state === "off" || !store.community) redirect(`/@${store.handle}`);
  const home = `/@${store.handle}/community`;
  if (viewer.state !== "in") redirect(home);
  const query = await searchParams;
  const notice = NOTICES[typeof query.n === "string" ? query.n : ""] ?? null;
  const member = viewer.member;

  return (
    <div className={`st-page st-theme-${store.look.theme} relative min-h-screen`} style={lookStyle(store.look) as React.CSSProperties}>
      <CommunityBar store={store} config={viewer.config} tab="you" signedIn />
      <main id="content" className="mx-auto max-w-xl px-4 pb-16 pt-6">
        <h1 className="font-display text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">You</h1>
        {notice ? <p className={`cm-flash mt-4 ${notice.tone === "warn" ? "cm-flash-warn" : ""}`} role="status">{notice.text}</p> : null}

        {viewer.owner ? (
          <div className="st-card mt-6 p-6">
            <p className="font-bold">You run this community</p>
            <p className="st-muted mt-2 text-sm">
              {`Everything you write shows as ${store.name}, with a Creator badge. Spaces, who gets in, members and reports are in the studio.`}
            </p>
            <Link href="/studio/community" className="btn st-btn mt-4">Open the studio</Link>
          </div>
        ) : !member ? (
          <p className="cm-flash cm-flash-warn mt-6">{NOTICES.full.text}</p>
        ) : (
          <form action="/api/store/community" method="post" className="st-card mt-6 space-y-5 p-6">
            <Carry store={store} action="profile" from="you" />
            <div>
              <label htmlFor="you-name" className="st-label">The name other members see</label>
              <input id="you-name" name="name" defaultValue={member.n} maxLength={MAX_DISPLAY_NAME} autoComplete="nickname" placeholder="Your first name, or a nickname" className="st-field mt-2" />
              <p className="st-muted mt-1 text-sm">Needed to post or comment. Your email address is never shown to other members.</p>
            </div>
            <label className="flex min-h-6 items-start gap-3">
              <input type="checkbox" name="dir" value="1" defaultChecked={member.dir} className="mt-0.5 h-5 w-5 shrink-0" />
              <span>
                <span className="block font-semibold">List me in the member directory</span>
                <span className="st-muted block text-sm">By this name, with the month you joined. Off unless you tick it.</span>
              </span>
            </label>
            <label className="flex min-h-6 items-start gap-3">
              <input type="checkbox" name="mail" value="1" defaultChecked={member.mail} className="mt-0.5 h-5 w-5 shrink-0" />
              <span>
                <span className="block font-semibold">{`Email me ${store.name}'s announcements and event reminders`}</span>
                <span className="st-muted block text-sm">
                  {canAnnounceByEmail(store)
                    ? `Announcements when ${store.name} sends one, and a reminder a day and an hour before each live event you RSVP to. To ${viewer.email}; every email has a one-click way to stop.`
                    : `A reminder a day and an hour before each live event you RSVP to, and announcements if ${store.name} starts emailing them. To ${viewer.email}; every email has a one-click way to stop.`}
                </span>
              </span>
            </label>
            <button type="submit" className="btn st-btn">Save</button>
          </form>
        )}

        <div className="st-card mt-6 p-6">
          <p className="font-bold">This device</p>
          <p className="st-muted mt-2 text-sm">
            {viewer.owner
              ? "You are signed in to Nimbus Labs here, which is how you come in."
              : `Let in here as ${viewer.email}. A link from your inbox keeps a device in for 90 days. Signing out here also closes ${store.name}'s courses on this device until you ask for a new link.`}
          </p>
          {!viewer.owner ? (
            <form action="/api/store/community" method="post" className="mt-4">
              <Carry store={store} action="signout" from="you" />
              <button type="submit" className="cm-pill">Sign out on this device</button>
            </form>
          ) : null}
        </div>
      </main>
    </div>
  );
}
