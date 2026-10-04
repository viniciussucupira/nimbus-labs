import type { NextRequest } from "next/server";
import { cronAllowed } from "@/lib/request-guard";
import { isRedisConfigured, redisPipeline } from "@/lib/redis";
import { NIMBUS_FROM, isSenderConfigured, sendEmail } from "@/lib/email";
import {
  DELIVERY_ALLOWANCE_BYTES,
  FREE_PAUSE_ABOVE_BYTES,
  bytesWords,
  ownersOf,
  storesOverAllowance,
} from "@/lib/delivery";
import { SUPPORT_EMAIL } from "@/lib/creator-research";
import { SITE_URL } from "@/lib/site-url";
import { directoryReadiness } from "@/lib/directory-index";

/**
 * The daily run that writes to a creator who has gone past the allowance.
 *
 * Section 5 of the Terms promises that a store far above the published
 * limits is written to first, with the figures, and given time to answer,
 * before anything is limited. That promise was the last thing in this system
 * that needed a person: everything else — the pause on free downloads, the
 * brake on storage — acts by itself, while the letter sat waiting for
 * somebody to notice and write it.
 *
 * A promise that depends on somebody noticing is not a promise. So the
 * letter is sent from here, to the creator, by name, with their own number
 * in it, the morning after they cross. Nobody has to be watching, and the
 * clause in the Terms is kept by the machine that made it necessary.
 *
 * Once per store per calendar month. A store that is over stays over until
 * the counter rolls, and a mail every morning for three weeks is how a
 * notice stops being read.
 *
 * Nothing in here blocks or limits anything. It writes.
 */
export const maxDuration = 60;

const TOLD = "nl:usage-watch:told";
/** Set once, the first day the directory question is worth deciding. */
const DIRECTORY_TOLD = "nl:dir:asked";

export async function GET(request: NextRequest) {
  if (!(await cronAllowed(request))) {
    return new Response("Unauthorized", { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  if (!isRedisConfigured()) {
    return Response.json({ ok: false, error: "unavailable" }, { status: 503 });
  }

  // Whether enough creators have agreed to be listed for a public directory of
  // affiliate programmes to be worth opening (lib/directory-index.ts). Read
  // daily so the answer arrives on its own, rather than waiting for somebody
  // to remember to go and count. It opens nothing and publishes nothing.
  const directory = await directoryReadiness().catch(() => null);
  if (directory) {
    console.log(`directory-watch: ${directory.listed}/${directory.needed} listed`);
    if (directory.ready && isSenderConfigured()) {
      // Once, ever. A number crossed is news the first morning and noise
      // every morning after it.
      const [first] = await redisPipeline([["SET", DIRECTORY_TOLD, "1", "NX"]]);
      if (first !== null) {
        await sendEmail({
          from: NIMBUS_FROM,
          to: SUPPORT_EMAIL,
          subject: `${directory.listed} creators have agreed to be listed`,
          text: [
            directory.words,
            "",
            "Nothing has been published and no page exists. This is only the figure",
            "arriving on its own, so the decision is made with it in front of you",
            "rather than remembered.",
            "",
            "Worth knowing before deciding: running a public catalogue of other",
            "people's products is a different business from hosting their stores. It",
            "brings duties toward the people listed in it, and in the European Union",
            "duties that apply to online marketplaces specifically, and neither",
            "switches off again afterward.",
          ].join("\n"),
        }).catch((error) => console.error("sending the directory notice failed", error));
      }
    }
  }

  const over = await storesOverAllowance();
  const allowance = bytesWords(DELIVERY_ALLOWANCE_BYTES);

  console.log(
    over.length === 0
      ? "usage-watch: every store inside the delivery allowance"
      : `usage-watch: ${over.length} over ${allowance} — ${over.map((s) => `${s.folder} ${bytesWords(s.bytes)}`).join(", ")}`,
  );

  const [seenRaw] = await redisPipeline([["GET", TOLD]]);
  const seen = new Set<string>(typeof seenRaw === "string" ? (JSON.parse(seenRaw) as string[]) : []);
  const fresh = over.filter((s) => !seen.has(s.folder));
  if (fresh.length === 0) {
    return Response.json(
      { ok: true, over: over.length, told: 0, directory: directory ? { listed: directory.listed, ready: directory.ready } : null },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const owners = await ownersOf(fresh.map((s) => s.folder));
  let told = 0;
  const unknown: string[] = [];

  for (let i = 0; i < fresh.length; i += 1) {
    const store = fresh[i];
    const email = owners[i];
    if (!email) {
      unknown.push(store.folder);
      continue;
    }
    if (!isSenderConfigured()) break;
    const sent = await sendEmail({
      from: NIMBUS_FROM,
      to: email,
      replyTo: SUPPORT_EMAIL,
      subject: `Your store has sent out ${bytesWords(store.bytes)} this month`,
      text: [
        `Your store has handed out ${bytesWords(store.bytes)} of files so far this month. The`,
        `subscription covers ${allowance} a month, so you are past it.`,
        "",
        "Nothing has been stopped, and nothing will be stopped for this. Your buyers",
        "are getting what they paid for, at any number — we do not take money for a",
        "sale and then not complete it.",
        "",
        "Two things are worth knowing.",
        "",
        `Free downloads — copies given away rather than bought — pause on their own if a`,
        `store passes ${bytesWords(FREE_PAUSE_ABOVE_BYTES)} in a month, and start again when the month turns.`,
        "Anything anyone has bought is never affected by that.",
        "",
        "And if your store stays far above the allowance month after month, we will",
        "want to talk about a plan that fits what you are doing. This email is that",
        "conversation starting, which is what our Terms say we do before anything",
        "else happens. You have time, and you have a person to answer: reply to this",
        `email, or write to ${SUPPORT_EMAIL}.`,
        "",
        "If this is a surprise, it is worth checking whether a free product of yours",
        "has been shared somewhere you did not expect. Your studio shows the month's",
        "total under your plan.",
        "",
        `${SITE_URL}/studio`,
      ].join("\n"),
    }).catch((error) => {
      console.error("sending the allowance notice failed", error);
      return false;
    });
    if (sent !== false) told += 1;
  }

  /*
    A store whose owner we cannot name is the one case left that a person has
    to look at — and it can only happen to a store that has delivered files
    without ever uploading one through the studio, which should not occur.
    It is said out loud rather than passed over in silence.
  */
  if (unknown.length > 0 && isSenderConfigured()) {
    await sendEmail({
      from: NIMBUS_FROM,
      to: SUPPORT_EMAIL,
      subject: `${unknown.length} store(s) over the allowance could not be written to`,
      text: [
        "These folders are past the delivery allowance, and we have no address on",
        "file for whoever owns them, so the notice our Terms promise could not be",
        "sent automatically:",
        "",
        ...unknown.map((f) => `  ${f}`),
      ].join("\n"),
    }).catch((error) => console.error("sending the unknown-owner notice failed", error));
  }

  await redisPipeline([
    ["SET", TOLD, JSON.stringify([...new Set([...seen, ...over.map((s) => s.folder)])]), "EX", 40 * 86_400],
  ]);

  return Response.json(
    { ok: true, over: over.length, told, unknown: unknown.length },
    { headers: { "Cache-Control": "no-store" } },
  );
}
