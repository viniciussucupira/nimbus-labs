"use client";

import { useEffect, useState } from "react";

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallApp() {
  const [deferred, setDeferred] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);

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
      setInstalled(true);
      setDeferred(null);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    const ua = window.navigator.userAgent;
    setIsIos(/iPad|iPhone|iPod/.test(ua) && !("MSStream" in window));
    if (window.matchMedia("(display-mode: standalone)").matches) setInstalled(true);

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
    <div className="reveal rounded-3xl border-2 border-white/20 bg-white/10 p-6 backdrop-blur">
      <p className="font-display text-xl font-extrabold">
        Install it like an app — on Android and on iPhone
      </p>
      <p className="mt-2 text-white/80">
        Your store works as an installable app on both, with its own icon on the
        home screen and no app store in the way. Stan&apos;s creator app is on
        the iPhone only: their own help centre says it is{" "}
        <span className="font-semibold text-white">
          &ldquo;currently only available on iPhone and iPad&rdquo;
        </span>
        .
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {installed ? (
          <p className="rounded-full bg-mint-brand px-5 py-2.5 font-bold text-ink">
            Installed on this device ✓
          </p>
        ) : deferred ? (
          <button
            type="button"
            onClick={install}
            className="rounded-full bg-white px-6 py-3 font-bold text-violet-deep shadow-lg transition hover:-translate-y-0.5 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Install the app
          </button>
        ) : (
          <p className="rounded-full bg-white/15 px-5 py-2.5 text-sm font-semibold">
            {isIos
              ? "On iPhone: tap Share, then “Add to Home Screen”."
              : "On Android: open the browser menu and tap “Install app” or “Add to home screen”."}
          </p>
        )}
        <p className="text-sm text-white/60">
          Native apps in the App Store and Google Play are on the roadmap, and
          this page will say so the day they exist — not before.
        </p>
      </div>
    </div>
  );
}
