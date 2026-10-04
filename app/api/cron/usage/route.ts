import type { NextRequest } from "next/server";
import { cronAllowed } from "@/lib/request-guard";
import { isRedisConfigured, redisPipeline } from "@/lib/redis";
import { NIMBUS_FROM, isSenderConfigured, sendEmail } from "@/lib/email";
import { DELIVERY_ALLOWANCE_BYTES, bytesWords, storesOverAllowance } from "@/lib/delivery";
import { SUPPORT_EMAIL } from "@/lib/creator-research";

/**
 * The daily look at what the month is costing us.
 *
 * Storage is cheap and delivery is not. A store handing out a two-gigabyte
 * file a thousand times in a month moves two terabytes, which costs us more
 * than seventy times what that store pays — and nothing in the code stops
 * it, deliberately: somebody paid the creator for that file, and cutting
 * their buyer off to protect our margin would be taking money for a sale and
 * then not completing it.
 *
 * So the answer is not a door. It is knowing. The creator has always been
 * able to see they were over, in their own studio; we could not, and the
 * first we would have heard of a runaway store was the invoice, a month late
 * and already paid. This closes that: once a day, if any store is past the
 * published allowance, the inbox hears about it by name, with the number.
 *
 * It sends nothing on a quiet day, so an email from it always means
 * something.
 */
export const maxDuration = 60;

const LAST = "nl:usage-watch:last";

export async function GET(request: NextRequest) {
  if (!(await cronAllowed(request))) {
    return new Response("Unauthorized", { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  if (!isRedisConfigured()) {
    return Response.json({ ok: false, error: "unavailable" }, { status: 503 });
  }

  const over = await storesOverAllowance();
  const allowance = bytesWords(DELIVERY_ALLOWANCE_BYTES);

  // In the logs every run, said or not, so a quiet month is visible too.
  console.log(
    over.length === 0
      ? "usage-watch: every store inside the delivery allowance"
      : `usage-watch: ${over.length} store(s) over ${allowance} — ${over.map((s) => `${s.folder} ${bytesWords(s.bytes)}`).join(", ")}`,
  );

  /*
    Once per store per month. A store that is over stays over until the
    counter rolls, and a mail every morning for three weeks about a creator
    we have already spoken to is how an alert stops being read.
  */
  const [seenRaw] = await redisPipeline([["GET", LAST]]);
  const seen = new Set<string>(typeof seenRaw === "string" ? (JSON.parse(seenRaw) as string[]) : []);
  const fresh = over.filter((s) => !seen.has(s.folder));

  if (fresh.length > 0 && isSenderConfigured()) {
    await sendEmail({
      from: NIMBUS_FROM,
      to: SUPPORT_EMAIL,
      subject:
        fresh.length === 1
          ? `A store is past ${allowance} of downloads this month`
          : `${fresh.length} stores are past ${allowance} of downloads this month`,
      text: [
        `These stores have sent out more than the ${allowance} a month the subscription covers.`,
        "Nothing has been blocked and nothing should be: their buyers paid for those files.",
        "This is the week to talk to them.",
        "",
        ...fresh.map((s) => `  ${s.folder}   ${bytesWords(s.bytes)} this month`),
        "",
        `At published rates, delivery costs about $0.05 a gigabyte, and about $0.11 for files`,
        `over 512 MB, which are never cached. ${bytesWords(fresh[0].bytes)} is roughly`,
        `$${Math.round((fresh[0].bytes / (1024 * 1024 * 1024)) * 0.11)} at the higher rate.`,
        "",
        "Each store is named once a month, not once a day.",
      ].join("\n"),
    }).catch((error) => console.error("sending the usage watch failed", error));
  }

  await redisPipeline([
    ["SET", LAST, JSON.stringify([...new Set([...seen, ...over.map((s) => s.folder)])]), "EX", 40 * 86_400],
  ]);

  return Response.json(
    { ok: true, over: over.length, told: fresh.length },
    { headers: { "Cache-Control": "no-store" } },
  );
}
