import type { NextRequest } from "next/server";
import { getDemoFile } from "@/lib/demo-file";
import { getDemoOrder } from "@/lib/demo-store";

const MESSAGES = {
  unpaid: [402, "This order has not been paid yet."],
  processing: [402, "This payment is still being confirmed by the bank. Try again once it clears."],
  expired: [410, "This download link has expired."],
  invalid: [404, "We could not find this order."],
  unavailable: [503, "The demo store is not set up yet."],
  error: [502, "We could not check this order right now. Please try again."],
} as const;

// Sends the file only after Stripe confirms the payment for this session.
export async function GET(request: NextRequest) {
  const sessionId =
    request.nextUrl.searchParams.get("session_id") ?? undefined;
  const order = await getDemoOrder(sessionId);

  if (order.state !== "paid") {
    const [status, message] = MESSAGES[order.state];
    return new Response(message, {
      status,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  const fileName = order.option.file;
  const file = getDemoFile(fileName);
  return new Response(file.buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(file.byteLength),
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
