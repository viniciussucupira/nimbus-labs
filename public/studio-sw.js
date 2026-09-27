// The studio's own service worker, registered with the scope /studio
// (components/studio-app.tsx). It does two things and keeps nothing:
//
//   - it makes the studio installable as an app of its own, and when a studio
//     page cannot load because the device is offline, it answers with a short
//     note drawn here. No studio page, answer or file is ever cached: all of
//     it is the creator's private data, so none of it may be left on a device.
//   - it shows the creator's notifications (lib/phone-alerts.ts) and opens the
//     studio page a notification points to, and nothing outside the studio.

const OFFLINE_PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Offline — Nimbus Studio</title>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#fbfaf7;color:#16142b;font:16px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:24px;box-sizing:border-box}
  main{max-width:26rem;text-align:center}
  h1{font-size:1.375rem;margin:0 0 .5rem}
  p{margin:0 0 1.25rem;color:#4b4866}
  a{display:inline-block;min-height:44px;line-height:44px;padding:0 1.25rem;border-radius:999px;background:#0d0b24;color:#fff;text-decoration:none;font-weight:600}
</style></head>
<body><main><h1>You are offline</h1>
<p>The studio needs a connection: nothing of your store is kept on this device. It opens again as soon as you are back online.</p>
<a href="/studio">Try again</a></main></body></html>`;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  // Only a page being opened, and only to say "offline" when it cannot be.
  if (request.mode !== "navigate" || request.method !== "GET") return;
  event.respondWith(
    fetch(request).catch(
      () =>
        new Response(OFFLINE_PAGE, {
          status: 503,
          headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
        }),
    ),
  );
});

const STUDIO_PATH = /^\/studio(?:[/?#]|$)/;
// Several of these may wait on the lock screen at once and each is worth
// seeing; only the ones below replace an older one of the same kind.
const COLLAPSED = new Set(["report", "affiliate", "test"]);

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = typeof data.title === "string" && data.title ? data.title : "Nimbus Studio";
  const url = typeof data.url === "string" && STUDIO_PATH.test(data.url) ? data.url : "/studio";
  const options = {
    body: typeof data.body === "string" ? data.body : "",
    icon: "/icons/icon-192.png",
    data: { url },
  };
  if (typeof data.tag === "string" && COLLAPSED.has(data.tag)) {
    options.tag = `nimbus-${data.tag}`;
    options.renotify = true;
  }
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = event.notification.data && typeof event.notification.data.url === "string" ? event.notification.data.url : "/studio";
  const target = new URL(STUDIO_PATH.test(path) ? path : "/studio", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((client) => new URL(client.url).pathname.startsWith("/studio"));
      if (open) {
        return open
          .focus()
          .then((client) => (client && "navigate" in client ? client.navigate(target) : client))
          .catch(() => self.clients.openWindow(target));
      }
      return self.clients.openWindow(target);
    }),
  );
});

// The browser replaced the subscription by itself (it expired, or keys were
// rotated): the new one is handed to the studio so the device keeps its place.
self.addEventListener("pushsubscriptionchange", (event) => {
  const old = event.oldSubscription;
  const key = old && old.options ? old.options.applicationServerKey : null;
  if (!old || !key) return;
  event.waitUntil(
    self.registration.pushManager
      .subscribe({ userVisibleOnly: true, applicationServerKey: key })
      .then((subscription) =>
        fetch("/api/store/phone", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "renew", old: old.endpoint, subscription: subscription.toJSON() }),
        }),
      )
      .catch(() => {}),
  );
});
