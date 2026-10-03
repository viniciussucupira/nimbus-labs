/**
 * Who is offered Zoom before Zoom has approved the app.
 *
 * Zoom's reviewer wrote (1 October 2026) that the Video calls page had no
 * place to authorize Zoom: Zoom was offered only to a preview store and to
 * stores signed up with a zoom.us or zoom.com address, and the reviewer's was
 * neither. What is checked:
 *
 *   - a store is not offered Zoom before approval, a preview store and a
 *     store with a Zoom address are, on a subdomain too, and an address that
 *     only looks like one is not;
 *   - the review link (`?zoom=review`), and the address Zoom's listing opens
 *     (`?from=zoom`), offer it to any store, on that visit;
 *   - ZOOM_LIVE=1 opens it to every store;
 *   - nothing is offered that the deployment has not switched on;
 *   - the route that starts a connection lets the review link's form through
 *     and nothing else, and a consent that is declined comes back to a page
 *     that still carries the word, so the card is there to try again from.
 */
import { NextRequest } from "next/server";
import { SESSION_COOKIE, openSession } from "@/lib/auth";
import { meetView } from "@/lib/meet-connect";
import { arrivedForZoom, isZoomReview, offeredProviders } from "@/lib/meet-providers";
import { finishConnect, startConnect } from "@/lib/meet-routes";
import { claimHandle } from "@/lib/store";
import { store as redis } from "./redis-stub";
import { done, is, part } from "./check";

const HOST = "marktmorgen.com";

function post(path: string, session: string): NextRequest {
  return new NextRequest(`https://${HOST}${path}`, {
    method: "POST",
    headers: { host: HOST, origin: `https://${HOST}`, cookie: `${SESSION_COOKIE}=${session}` },
  });
}

function get(path: string, session: string): NextRequest {
  return new NextRequest(`https://${HOST}${path}`, { headers: { host: HOST, cookie: `${SESSION_COOKIE}=${session}` } });
}

async function main(): Promise<void> {
  process.env.GOOGLE_OAUTH_CLIENT_ID = "g-id";
  process.env.GOOGLE_OAUTH_CLIENT_SECRET = "g-secret";
  process.env.ZOOM_CLIENT_ID = "z-id";
  process.env.ZOOM_CLIENT_SECRET = "z-secret";
  process.env.ZOOM_WEBHOOK_SECRET_TOKEN = "z-token";
  delete process.env.ZOOM_LIVE;
  redis.clear();

  part("Before approval");
  is("any store: Google only", offeredProviders({ sid: "sidharbor01", email: "owner@example.com" }), ["google"]);
  is("a store id alone: Google only", offeredProviders("sidharbor01"), ["google"]);
  is("the preview store: both", offeredProviders("dc83ed016f0d4a83b71461bca159d8f5"), ["google", "zoom"]);
  is("a zoom.us address: both", offeredProviders({ sid: "s1", email: "tester@zoom.us" }), ["google", "zoom"]);
  is("a zoom.com address: both", offeredProviders({ sid: "s1", email: "Tester@Zoom.com" }), ["google", "zoom"]);
  is("a subdomain of zoom.us: both", offeredProviders({ sid: "s1", email: "tester@test.zoom.us" }), ["google", "zoom"]);
  is("an address that only ends like one: Google only", offeredProviders({ sid: "s1", email: "tester@notzoom.us" }), ["google"]);
  is("zoom.us inside a longer name: Google only", offeredProviders({ sid: "s1", email: "tester@zoom.us.example.com" }), ["google"]);

  part("The review link");
  is("review: any store is offered both", offeredProviders({ sid: "sidharbor01", email: "owner@example.com" }, true), ["google", "zoom"]);
  is("the word is read exactly", [isZoomReview("review"), isZoomReview("Review"), isZoomReview("1"), isZoomReview(["review"]), isZoomReview(undefined), isZoomReview(null)], [true, false, false, false, false, false]);

  is(
    "the listing's address counts too, and nothing else does",
    [arrivedForZoom({ from: "zoom" }), arrivedForZoom({ zoom: "review" }), arrivedForZoom({ from: "google" }), arrivedForZoom({ from: ["zoom"] }), arrivedForZoom({})],
    [true, true, false, false, false],
  );

  part("The routes");
  const claimed = await claimHandle("owner@example.com", "harbor", "Harbor Kitchen", "");
  if (!claimed.ok) throw new Error("no store");
  const shop = claimed.store;
  const session = await openSession("owner@example.com");
  const pin = `store=${shop.sid}`;

  is("the page's view without the word: Google only", (await meetView(shop.statsId ?? null, shop)).providers, ["google"]);
  is("the page's view with the word: both", (await meetView(shop.statsId ?? null, shop, true)).providers, ["google", "zoom"]);

  const shut = await startConnect(post(`/api/integrations/zoom/start?${pin}`, session), "zoom");
  is("Zoom's form without the word: not found", shut.status, 404);
  const wrong = await startConnect(post(`/api/integrations/zoom/start?${pin}&zoom=1`, session), "zoom");
  is("another word: not found", wrong.status, 404);

  const open = await startConnect(post(`/api/integrations/zoom/start?${pin}&zoom=review`, session), "zoom");
  const consent = new URL(open.headers.get("location") ?? "https://none.invalid/");
  is("with the word: sent to Zoom's consent page", [open.status, consent.origin + consent.pathname], [303, "https://zoom.us/oauth/authorize"]);
  is("with the address Zoom is given for the way back", consent.searchParams.get("redirect_uri"), `https://${HOST}/api/integrations/zoom/callback`);

  const google = await startConnect(post(`/api/integrations/google/start?${pin}&zoom=review`, session), "google");
  is("Google's form is not changed by the word", [google.status, new URL(google.headers.get("location") ?? "https://none.invalid/").hostname], [303, "accounts.google.com"]);

  const state = consent.searchParams.get("state") ?? "";
  const declined = await finishConnect(get(`/api/integrations/zoom/callback?state=${state}&error=access_denied`, session), "zoom");
  is(
    "declined on Zoom's page: back to Video calls, the word kept",
    [declined.status, declined.headers.get("location")],
    [303, `https://${HOST}/studio/meetings?${pin}&meet=declined&p=zoom&zoom=review`],
  );

  const googleState = new URL(google.headers.get("location") ?? "https://none.invalid/").searchParams.get("state") ?? "";
  const googleDeclined = await finishConnect(get(`/api/integrations/google/callback?state=${googleState}&error=access_denied`, session), "google");
  is(
    "declined on Google's page: back to Video calls, no word added",
    googleDeclined.headers.get("location"),
    `https://${HOST}/studio/meetings?${pin}&meet=declined&p=google`,
  );

  part("Open to everyone");
  process.env.ZOOM_LIVE = "1";
  is("ZOOM_LIVE=1: any store is offered both", offeredProviders("sidharbor01"), ["google", "zoom"]);
  const live = await startConnect(post(`/api/integrations/zoom/start?${pin}`, session), "zoom");
  const liveState = new URL(live.headers.get("location") ?? "https://none.invalid/").searchParams.get("state") ?? "";
  const liveDeclined = await finishConnect(get(`/api/integrations/zoom/callback?state=${liveState}&error=access_denied`, session), "zoom");
  is("once it is open, the way back carries no word", liveDeclined.headers.get("location"), `https://${HOST}/studio/meetings?${pin}&meet=declined&p=zoom`);
  delete process.env.ZOOM_LIVE;

  part("Only what is switched on");
  delete process.env.ZOOM_WEBHOOK_SECRET_TOKEN;
  is("Zoom without its keys: not offered, review or not", offeredProviders("sidharbor01", true), ["google"]);
  const off = await startConnect(post(`/api/integrations/zoom/start?${pin}&zoom=review`, session), "zoom");
  is("and its route is not found", off.status, 404);
  delete process.env.GOOGLE_OAUTH_CLIENT_ID;
  is("nothing switched on: nothing offered", offeredProviders("dc83ed016f0d4a83b71461bca159d8f5", true), []);

  done();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
