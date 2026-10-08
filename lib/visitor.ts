import { headers } from "next/headers";
import type { Store } from "@/lib/store";
import { readCountry } from "@/lib/fair-price";

/**
 * The country the visitor's connection is in, as Vercel reads it at its edge
 * and hands the request on (the x-vercel-ip-country header, which a visitor
 * cannot set themselves there). "" off Vercel or when it does not know.
 */
export async function visitorCountry(): Promise<string> {
  return readCountry((await headers()).get("x-vercel-ip-country"));
}

/**
 * The store as this visitor sees it: with their country, so a fair price for
 * it is shown wherever a price is (lib/fair-price.ts). A copy, never saved.
 */
export async function forVisitor<T extends Store>(store: T): Promise<T> {
  return { ...store, visitorCountry: await visitorCountry() };
}
