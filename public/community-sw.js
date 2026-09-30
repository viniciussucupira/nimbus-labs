// A community's own service worker, registered with the scope of that
// community alone (components/community-push-toggle.tsx). It does one thing
// and keeps nothing: it shows a member what happened to them, and opens the
// page it points at.
//
// It caches nothing at all. Everything behind a community is somebody's paid
// access and somebody else's writing, so none of it may be left on a device.
//
// What arrives is thin on purpose — who did what, and where to go, never the
// words anybody wrote. A notification is read on a lock screen, over a
// shoulder, on a device that may be borrowed.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Only a path inside a community is ever opened from one of these, whatever
// the payload says. The sender checks too; this checks again, because a
// service worker outlives the page that registered it.
const COMMUNITY_PATH = /^\/@[^/?#]+\/community(?:[/?#]|$)/;

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = typeof data.title === "string" && data.title ? data.title : "Something happened";
  const url = typeof data.url === "string" && COMMUNITY_PATH.test(data.url) ? data.url : "/";
  const options = {
    body: typeof data.body === "string" ? data.body : "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url },
  };
  // One per thread: a second answer on the same post replaces the first
  // rather than stacking up overnight.
  if (typeof data.tag === "string" && data.tag) {
    options.tag = `nimbus-cm-${data.tag}`;
    options.renotify = true;
  }
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = event.notification.data && typeof event.notification.data.url === "string" ? event.notification.data.url : "/";
  const target = new URL(COMMUNITY_PATH.test(path) ? path : "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((client) => COMMUNITY_PATH.test(new URL(client.url).pathname));
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
// rotated): the new one is handed back so the device keeps its place, rather
// than the member silently stopping hearing anything.
self.addEventListener("pushsubscriptionchange", (event) => {
  const old = event.oldSubscription;
  const key = old && old.options ? old.options.applicationServerKey : null;
  if (!old || !key) return;
  // The community this worker belongs to is its own scope: /@handle/community/
  const handle = self.registration.scope.replace(self.location.origin, "").split("/").filter(Boolean)[0] || "";
  event.waitUntil(
    self.registration.pushManager
      .subscribe({ userVisibleOnly: true, applicationServerKey: key })
      .then((subscription) =>
        fetch("/api/store/community/push", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            handle: decodeURIComponent(handle).replace(/^@/, ""),
            action: "renew",
            old: old.endpoint,
            subscription: subscription.toJSON(),
          }),
        }),
      )
      .catch(() => {}),
  );
});
