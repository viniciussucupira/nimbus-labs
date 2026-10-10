/**
 * The studio's help assistant (lib/help-ask.ts, lib/ai.ts answerHelp; added
 * 10 October 2026). Checked: a question finds the help center's answers it is
 * about, by their words, whatever their form; a question about nothing finds
 * none; the model is given those answers only and told to add nothing; and
 * the sources it names are the help center's own anchors.
 */
import { claimHandle, ensureStatsId, setSubscription, storeForEmail } from "@/lib/store";
import { pickHelp, stem, words } from "@/lib/help-ask";
import { answerHelp } from "@/lib/ai";
import { HELP_SECTIONS, answerId } from "@/lib/help-content";
import { store as redis } from "./redis-stub";
import { done, is, part } from "./check";

type Sent = { model: string; system: string; messages: { content: string }[] };
const asked: Sent[] = [];
let reply = "";
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = new URL(String(input));
  if (url.hostname === "api.anthropic.com") {
    asked.push(JSON.parse(String(init?.body)) as Sent);
    return new Response(JSON.stringify({ content: [{ type: "text", text: reply }] }));
  }
  return new Response("{}", { status: 404 });
}) as typeof fetch;

async function main(): Promise<void> {
  redis.clear();
  process.env.ANTHROPIC_API_KEY = "sk-ant-test-only-a-stand-in-0123456789";

  part("Finding the answers a question is about");
  is("words are reduced to their stems, without the little ones", words("How do I upload files to my courses?"), ["upload", "file", "course"]);
  is("so each form of a word meets the others", [stem("payments"), stem("payment"), stem("refunds"), stem("uploaded"), stem("countries"), stem("boxes")], ["payment", "payment", "refund", "upload", "country", "box"]);
  const files = pickHelp("What files can I sell and how big can they be?");
  is("a question about files finds the answer about files first", files[0]?.q, "What file can I sell, and how big?");
  is("at most six, each an anchor of the help center", [files.length <= 6, files.every((p) => HELP_SECTIONS.some((s) => s.items.some((i) => answerId(i.q) === p.id)))], [true, true]);
  is("a question about nothing here finds nothing", pickHelp("zzz qqq"), []);

  part("Answered from those answers only");
  const owner = "help@example.com";
  await claimHandle(owner, "helpshop", "Help Shop", "");
  await ensureStatsId(owner);
  await setSubscription(owner, { customerId: "cus_Help0001", subscriptionId: "sub_Help0001", active: true });
  reply = JSON.stringify({ answer: "Up to 5 GB, in the formats listed.", used: [1, 1, 9] });
  const answered = await answerHelp((await storeForEmail(owner))!, "What files can I sell?", files);
  is("the answer, and the sources it used, once each, only real ones", answered.ok && answered.value, { answer: "Up to 5 GB, in the formats listed.", sources: [{ id: files[0].id, q: files[0].q }] });
  is("told to answer only from them and to add nothing, by the smaller model", [
    asked[0].messages[0].content.includes(files[0].q),
    /Answer ONLY from the help center answers given/.test(asked[0].system),
    asked[0].model.includes("haiku"),
  ], [true, true, true]);
  is("with nothing to answer from, nothing is asked", (await answerHelp((await storeForEmail(owner))!, "Anything?", [])).ok, false);
  done();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
