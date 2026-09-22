"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Icon } from "@/components/icons";

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * Two facts that belong to the browser, not to React: whether this is an
 * iPhone, and whether the page is already running as an installed app.
 *
 * They are read with useSyncExternalStore rather than written into state from
 * an effect. Setting state inside an effect makes React render the component
 * twice on every visit for something that was knowable the first time, and on
 * the home page this component sits below the buyer path, where a second
 * render costs a frame for nothing.
 */
const NEVER_CHANGES = () => () => {};
const STANDALONE = "(display-mode: standalone)";

const subscribeToDisplayMode = (notify: () => void) => {
  const query = window.matchMedia(STANDALONE);
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
};

const onServer = () => false;

export function InstallApp() {
  const [deferred, setDeferred] = useState<InstallEvent | null>(null);
  const [justInstalled, setJustInstalled] = useState(false);

  const isIos = useSyncExternalStore(
    NEVER_CHANGES,
    () => /iPad|iPhone|iPod/.test(window.navigator.userAgent) && !("MSStream" in window),
    onServer,
  );
  const standalone = useSyncExternalStore(
    subscribeToDisplayMode,
    () => window.matchMedia(STANDALONE).matches,
    onServer,
  );
  const installed = standalone || justInstalled;

  useEffect(() => {
    // Register the service worker: this is what makes the site installable.
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as InstallEvent);
    };
    const onInstalled = () => {
      setJustInstalled(true);
      setDeferred(null);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  };

  return (
    <div className="reveal mt-4 flex flex-col gap-5 rounded-[var(--r-lg)] border border-line bg-paper p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7">
      <div className="flex gap-4">
        <span className="icon-tile">
          <Icon name="phone" size={22} />
        </span>
        <div className="max-w-2xl">
          <p className="font-semibold text-ink">Install it like an app, on Android and on iPhone</p>
          <p className="mt-1.5 text-[0.9375rem] text-ink-soft">
            Your store installs with its own icon on the home screen, with no app store in the way. Stan&apos;s creator
            app is on Apple devices only: their help centre says it is &ldquo;currently only available on iPhone and
            iPad&rdquo;. Native apps are on our list, and this line will say so the day they exist.
          </p>
        </div>
      </div>
      <div className="shrink-0">
        {installed ? (
          <p className="tag tag-live h-9 px-3 text-sm">Installed on this device</p>
        ) : deferred ? (
          <button type="button" onClick={install} className="btn btn-primary">
            Install the app
          </button>
        ) : (
          <p className="max-w-[16rem] text-sm text-ink-mute">
            {isIos
              ? "On iPhone: tap Share, then “Add to Home Screen”."
              : "On Android: open the browser menu and tap “Install app”."}
          </p>
        )}
      </div>
    </div>
  );
}
