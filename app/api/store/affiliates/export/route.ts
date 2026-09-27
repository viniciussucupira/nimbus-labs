import type { NextRequest } from "next/server";
import { creatorFrom } from "@/lib/studio-route";
import { bookCsv, listAffiliates, readBook } from "@/lib/affiliates";

/**
 * The affiliate programme as a spreadsheet, for the creator's own records:
 * every credited sale with what it earns after refunds, and every payout the
 * creator wrote down. Only for the owner of the store, and an Admin: it
 * carries every affiliate's address (lib/team-roles.ts, "export").
 */
export async function GET(request: NextRequest) {
  const creator = await creatorFrom(request, "export");
  if (creator instanceof Response) return creator;
  const { store } = creator;
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
