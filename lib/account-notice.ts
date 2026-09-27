/**
 * Telling a creator, by email, when something that decides where their money
 * or their buyers go has just changed.
 *
 * Signing in is passwordless, so the account is exactly as safe as the inbox
 * and the sessions it opens. Someone who got hold of a session — a borrowed
 * laptop, a cookie that walked off — would go for the few settings that
 * matter: the Stripe account sales are paid into, the currency every price
 * is charged in, the domain the store is served on, the webhooks and the
 * email platform that send buyers' details somewhere, the people let onto
 * the store's team (lib/team.ts), and the devices told about every sale. So
 * each change to one of those sends the creator a plain notice at their
 * sign-in address, saying what changed and when, and what to do if it was
 * not them. It carries no link that signs anybody in; it says where to go.
 *
 * Best effort by design: a notice that could not be sent never undoes or
 * blocks the change itself, which the creator made on purpose far more
 * often than not.
 */
import { NIMBUS_FROM, isSenderConfigured, sendEmail } from "@/lib/email";
import { SITE_URL } from "@/lib/site-url";
import type { Store } from "@/lib/store";

export type AccountChange =
  | { kind: "stripe-connected" }
  | { kind: "stripe-disconnected" }
  | { kind: "domain-added"; name: string }
  | { kind: "domain-removed"; name: string }
  | { kind: "webhook-added"; where: string }
  | { kind: "webhook-removed"; where: string }
  | { kind: "team-joined"; who: string; role: string }
  | { kind: "team-role"; who: string; from: string; to: string }
  | { kind: "currency-changed"; from: string; to: string }
  | { kind: "email-platform-connected"; name: string }
  | { kind: "email-platform-removed"; name: string }
  | { kind: "phone-added"; label: string };

const SUPPORT = "support@nimbuslabsai.com";

function describe(change: AccountChange): { subject: string; line: string } {
  switch (change.kind) {
    case "stripe-connected":
      return {
        subject: "A Stripe account was connected to your store",
        line: "A Stripe account was connected to your store. Sales are now paid into it.",
      };
    case "stripe-disconnected":
      return {
        subject: "Your store's Stripe account was disconnected",
        line: "The Stripe account your store was paid into was disconnected. Your store cannot take payments until one is connected again.",
      };
    case "domain-added":
      return {
        subject: `${change.name} was added to your store`,
        line: `The domain ${change.name} was added to your store, so your store will be served there once its DNS points to us.`,
      };
    case "domain-removed":
      return {
        subject: `${change.name} was removed from your store`,
        line: `The domain ${change.name} was removed from your store. Your store is still at its nimbuslabsai.com address.`,
      };
    case "webhook-added":
      return {
        subject: "A webhook was added to your store",
        line: `A webhook was added to your store. From now on, the events it chose — which can include buyers' names and email addresses — are sent to ${change.where}.`,
      };
    case "webhook-removed":
      return {
        subject: "A webhook was removed from your store",
        line: `The webhook that sent your store's events to ${change.where} was removed.`,
      };
    case "team-joined":
      return {
        subject: `${change.who} joined your store's team`,
        line: `${change.who} accepted your invitation and joined your store's team as ${change.role}. They can now open your store in their studio with that role.`,
      };
    case "team-role":
      return {
        subject: `${change.who}'s role on your store changed`,
        line: `The role of ${change.who} on your store's team changed from ${change.from} to ${change.to}. It counts from their next click.`,
      };
    case "currency-changed":
      return {
        subject: `Your store now charges in ${change.to.toUpperCase()}`,
        line: `Your store's currency was changed from ${change.from.toUpperCase()} to ${change.to.toUpperCase()}. Every price kept its number, so a price of 49 is now 49 ${change.to.toUpperCase()}, and every checkout from now on charges in ${change.to.toUpperCase()}.`,
      };
    case "email-platform-connected":
      return {
        subject: `${change.name} was connected to your store`,
        line: `An API key for ${change.name} was saved in your studio. From now on, people who agree to hear from you — their email addresses, and buyers' first names — are sent to that ${change.name} account.`,
      };
    case "email-platform-removed":
      return {
        subject: `${change.name} was disconnected from your store`,
        line: `Your store no longer sends anybody to ${change.name}, and the API key saved for it was deleted.`,
      };
    case "phone-added":
      return {
        subject: "A new device gets your store's notifications",
        line: `Notifications were turned on for a new device (${change.label}). It is told about sales, bookings, reports and affiliate applications, as chosen in your studio.`,
      };
  }
}

/** Sends the notice for one change. Never throws; false when nothing was sent. */
export async function noticeCreator(store: Pick<Store, "email" | "handle">, change: AccountChange): Promise<boolean> {
  if (!isSenderConfigured()) return false;
  const { subject, line } = describe(change);
  const when = new Date().toISOString().replace("T", " ").slice(0, 16);
  try {
    return await sendEmail({
      from: NIMBUS_FROM,
      to: store.email,
      replyTo: SUPPORT,
      subject,
      text: [
        `${line}`,
        "",
        `Store: ${SITE_URL}/@${store.handle}`,
        `When: ${when} UTC`,
        "",
        "If this was you, there is nothing to do.",
        "",
        "If it was not you: log in at",
        `${SITE_URL}/signin`,
        "with this email address, choose “Log out of all devices” at the foot of your studio, put the setting back, and reply to this email so we can help.",
        "",
        "Nimbus Labs sends this notice every time your Stripe account, your store's currency, your domain, your webhooks, your email platform or your team change, and when a new device gets your notifications.",
      ].join("\n"),
    });
  } catch (error) {
    console.error("sending an account notice failed", error);
    return false;
  }
}
