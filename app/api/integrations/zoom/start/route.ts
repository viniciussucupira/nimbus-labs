import type { NextRequest } from "next/server";
import { startConnect } from "@/lib/meet-routes";

/**
 * Starts connecting the store to Zoom: the studio's form posts here and
 * the person is sent to the consent page (lib/meet-routes.ts). Not found
 * until the deployment has the app's keys.
 */
export async function POST(request: NextRequest) {
  return startConnect(request, "zoom");
}
