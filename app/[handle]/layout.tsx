import type { Metadata, Viewport } from "next";
import { cache } from "react";
import { normaliseHandle, storeForPage } from "@/lib/store";
import { iconUrl, shortName, themeColour } from "@/lib/store-app";
import { StoreApp } from "@/components/store-app";

/**
 * Around every page of a creator's store: the store's own manifest, icon and
 * colour in the head, so a buyer can put the store on their home screen as
 * an app of its own (lib/store-app.ts), and the service worker that lets
 * them.
 *
 * Addresses without an "@" also pass through here and meet the not-found
 * page; for those this adds nothing, and the site's own head stands.
 */
const loadStore = cache(async (raw: string) => {
  const decoded = decodeURIComponent(raw);
  if (!decoded.startsWith("@")) return null;
  // The same read the page makes (storeForPage), so a visit asks Redis once.
  return storeForPage(normaliseHandle(decoded)).catch(() => null);
});

export async function generateMetadata({ params }: LayoutProps<"/[handle]">): Promise<Metadata> {
  const { handle } = await params;
  const store = await loadStore(handle);
  if (!store) return {};
  return {
    manifest: `/@${store.handle}/manifest.webmanifest`,
    applicationName: store.name,
    icons: {
      icon: [{ url: iconUrl(store, 192), sizes: "192x192", type: "image/png" }],
      apple: [{ url: iconUrl(store, 180), sizes: "180x180", type: "image/png" }],
    },
    appleWebApp: { capable: true, title: shortName(store.name), statusBarStyle: "default" },
  };
}

export async function generateViewport({ params }: LayoutProps<"/[handle]">): Promise<Viewport> {
  const { handle } = await params;
  const store = await loadStore(handle);
  return store ? { themeColor: themeColour(store) } : {};
}

export default function StoreLayout({ children }: LayoutProps<"/[handle]">) {
  return (
    <>
      {children}
      <StoreApp />
    </>
  );
}
