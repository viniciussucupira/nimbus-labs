import { apiError, apiOk, apiStore } from "@/lib/api-guard";
import { products } from "@/lib/api-read";

/** GET /api/v1/products?cursor= — every product, in the creator's order. */
export async function GET(request: Request) {
  const store = await apiStore(request);
  if (store instanceof Response) return store;
  try {
    return apiOk(await products(store, new URL(request.url).searchParams.get("cursor")));
  } catch (error) {
    console.error("api: products failed", error);
    return apiError(502, "unavailable", "Products could not be read just now. Try again in a moment.");
  }
}
