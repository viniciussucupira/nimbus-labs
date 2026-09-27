import type { NextRequest } from "next/server";
import { SESSION_COOKIE, emailForSession } from "@/lib/auth";
import { storeForEmail } from "@/lib/store";
import { bookCsv, listAffiliates, readBook } from "@/lib/affiliates";

/**
 * The affiliate programme as a spreadsheet, for the creator's own records:
 * every credited sale with what it earns after refunds, and every payout the
 * creator wrote down. Only for the signed-in owner of the store.
 */
export async function GET(request: NextRequest) {
  const email = await emailForSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!email) return new Response("Log in first.", { status: 401 });
  const store = await storeForEmail(email);
  if (!store) return new Response("No store.", { status: 404 });
  try {
    const [book, people] = await Promise.all([readBook(store), listAffiliates(store)]);
    const day = new Date().toISOString().slice(0, 10);
    return new Response(bookCsv(book, people), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="affiliates-${store.handle}-${day}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("exporting the affiliate book failed", error);
    return new Response("Something went wrong on our side. Try again in a moment.", { status: 500 });
  }
}
