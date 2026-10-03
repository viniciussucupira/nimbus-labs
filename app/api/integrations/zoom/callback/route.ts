import type { NextRequest } from "next/server";
import { finishConnect } from "@/lib/meet-routes";

/**
 * Where Zoom sends the person back after the consent page: the redirect
 * address registered with it, https://marktmorgen.com/api/integrations/zoom/callback
 * (lib/meet-routes.ts checks the state, the session and the store).
 */
export async function GET(request: NextRequest) {
  return finishConnect(request, "zoom");
}
