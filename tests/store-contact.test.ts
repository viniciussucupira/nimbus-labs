/**
 * The contact form on a store page (lib/store-contact.ts, added 9 October
 * 2026). Checked: off until switched on, and never on the demo store; a
 * message goes to the creator only, with Reply set to the visitor; nothing
 * is ever sent to the address a visitor types; a bad address or too few
 * words are refused before anything is sent; one connection and one store
 * are limited.
 */
import { claimHandle, ensureStatsId, setContact, storeForEmail } from "@/lib/store";
import { contactOpen, sendContact, MAX_PER_DAY } from "@/lib/store-contact";
import { HOUSE_OWNER } from "@/lib/house-store";
import { store as redis } from "./redis-stub";
import { done, is, part } from "./check";

type Sent = { to: string[] | string; subject: string; text: string; reply_to?: string };
const sent: Sent[] = [];
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = new URL(String(input));
  if (url.hostname === "api.resend.com") {
    sent.push(JSON.parse(String(init?.body)) as Sent);
    return new Response(JSON.stringify({ id: `email_${sent.length}` }));
  }
  return new Response("{}", { status: 404 });
}) as typeof fetch;

async function main(): Promise<void> {
  redis.clear();
  process.env.RESEND_API_KEY = "re_test_contact_only";
  const owner = "maker@example.com";
  await claimHandle(owner, "makershop", "Maker Shop", "");
  await ensureStatsId(owner);
  const message = "Hello! Could we work together on a cookbook for a magazine?";
  const send = async (over: Partial<{ email: string; message: string; ip: string; name: string }> = {}) =>
    sendContact({ store: (await storeForEmail(owner))!, name: over.name ?? "Dana", email: over.email ?? "dana@example.com", message: over.message ?? message, ip: over.ip ?? "1.1.1.1" });

  part("Off until switched on");
  is("closed, and nothing sent", [await send(), sent.length], ["closed", 0]);
  await setContact(owner, { on: true });
  const store = (await storeForEmail(owner))!;
  is("open now; never on the demo store", [contactOpen(store), contactOpen({ ...store, email: HOUSE_OWNER })], [true, false]);

  part("Refused before anything is sent");
  is("a bad address, too few words", [await send({ email: "dana@" }), await send({ message: "Hi there" }), sent.length], ["email", "short", 0]);

  part("To the creator only, with Reply to the visitor");
  is("sent", await send(), "sent");
  const mail = sent.at(-1)!;
  is("to the creator, Reply to the visitor, with the message and where it came from", [
    [mail.to].flat(),
    mail.reply_to,
    mail.subject,
    mail.text.includes(message) && mail.text.includes("marktmorgen.com/@makershop"),
  ], [["maker@example.com"], "dana@example.com", "Message from Dana via your store", true]);
  is("nothing ever went to the visitor's address", sent.some((m) => [m.to].flat().includes("dana@example.com")), false);

  part("Limited");
  const fromOne = [await send({ message: `${message} 2` }), await send({ message: `${message} 3` }), await send({ message: `${message} 4` })];
  is("three an hour from one connection", fromOne, ["sent", "sent", "limited"]);
  const results: string[] = [];
  for (let n = 0; n < MAX_PER_DAY + 2; n++) results.push(await send({ ip: `9.9.${n}.1`, message: `${message} #${n}` }));
  is(`at most ${MAX_PER_DAY} a day to one store`, results.filter((r) => r === "sent").length, MAX_PER_DAY - 3);
  done();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
