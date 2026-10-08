import { headers } from "next/headers";
import type { Store } from "@/lib/store";
import { hasPixels, needsConsent, pixelNames } from "@/lib/pixels";
import { StoreBeacon } from "@/components/store-beacon";
import { AffiliateClick } from "@/components/affiliate-click";
import { type PixelEvent, StorePixels } from "@/components/store-pixels";

/**
 * What a store page carries besides the page: the visit count, on the store
 * page itself, the count of a click on an affiliate's link, on any page of a
 * store with affiliates, and the creator's own ad pixels, on every page of
 * the store that has any. Whether a visitor is asked first, for the pixels and
 * for remembering an affiliate's link, is decided here, from the country the
 * request came from.
 */
export async function StoreTracking({
  store,
  countVisit = false,
  presence = false,
  product = "",
  event = null,
}: {
  store: Store;
  countVisit?: boolean;
  /** A page of the store other than its front one: somebody who opens it is a visit (lib/traffic.ts), and nothing else is counted. */
  presence?: boolean;
  /** A product's own page: which product, so the people who open it are counted for it (lib/stats.ts). */
  product?: string;
  event?: PixelEvent;
}) {
  const withPixels = hasPixels(store.pixels);
  const askFirst = withPixels || store.affiliates.enabled ? needsConsent((await headers()).get("x-vercel-ip-country")) : true;
  return (
    <>
      {countVisit ? <StoreBeacon handle={store.handle} /> : presence ? <StoreBeacon handle={store.handle} front={false} product={product} /> : null}
      {store.affiliates.enabled ? (
        <AffiliateClick handle={store.handle} storeName={store.name} days={store.affiliates.days} askFirst={askFirst} />
      ) : null}
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
