import type { NextRequest } from "next/server";
import { finishConnect } from "@/lib/meet-routes";

/**
 * Where Google Calendar sends the person back after the consent page: the redirect
 * address registered with it, https://marktmorgen.com/api/integrations/google/callback
 * (lib/meet-routes.ts checks the state, the session and the store).
 */
export async function GET(request: NextRequest) {
  return finishConnect(request, "google");
}
