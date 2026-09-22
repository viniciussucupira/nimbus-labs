import { headers } from "next/headers";
import type { Store } from "@/lib/store";
import { hasPixels, needsConsent, pixelNames } from "@/lib/pixels";
import { StoreBeacon } from "@/components/store-beacon";
import { type PixelEvent, StorePixels } from "@/components/store-pixels";

/**
 * What a store page carries besides the page: the visit count, on the store
 * page itself, and the creator's own ad pixels, on every page of the store
 * that has any. Whether a visitor is asked first is decided here, from the
 * country the request came from.
 */
export async function StoreTracking({
  store,
  countVisit = false,
  event = null,
}: {
  store: Store;
  countVisit?: boolean;
  event?: PixelEvent;
}) {
  const withPixels = hasPixels(store.pixels);
  const askFirst = withPixels ? needsConsent((await headers()).get("x-vercel-ip-country")) : true;
  return (
    <>
      {countVisit ? <StoreBeacon handle={store.handle} /> : null}
      {withPixels ? (
        <StorePixels
          handle={store.handle}
          storeName={store.name}
          pixels={store.pixels}
          names={pixelNames(store.pixels)}
          askFirst={askFirst}
          event={event}
        />
      ) : null}
    </>
  );
}
