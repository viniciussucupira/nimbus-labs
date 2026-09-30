import { apiError, apiOk, apiStore } from "@/lib/api-guard";
import { leads } from "@/lib/api-read";

/**
 * GET /api/v1/leads?cursor=&agreed=true — the creator's list: the same rows as
 * the studio's CSV export. `agreed=true` keeps only those who agreed to hear
 * from the creator and have not unsubscribed — the ones it is fair to email.
 */
export async function GET(request: Request) {
  const store = await apiStore(request);
  if (store instanceof Response) return store;
  const params = new URL(request.url).searchParams;
  try {
    return apiOk(await leads(store, params.get("cursor"), params.get("agreed") === "true"));
  } catch (error) {
    console.error("api: leads failed", error);
    return apiError(502, "unavailable", "The list could not be read just now. Try again in a moment.");
  }
}
