/**
 * Search, mentions and polls: the rules a reader of the code would have to
 * take on trust.
 *
 * The mention case worth keeping is the email address. In the first draft
 * `ana@example.com` read as a mention of `@example.com`; nothing in the types
 * or in the reading of it showed that, and one day somebody holds that handle
 * and is told about a conversation they were never in.
 */
import { queryWords, words } from "@/lib/community-search";
import { MAX_MENTIONS, mentionsIn, slug, withMentions } from "@/lib/community-mentions";
import { MAX_POLL_OPTIONS, cleanChoice, parsePoll, pollClosed, pollWhen } from "@/lib/community-polls";
import { segments } from "@/lib/community-text";
import { done, is, part } from "./check";

part("Search reads words, not letters");
is("accents fold, so café finds cafe", words("Café"), ["cafe"]);
is("case and punctuation go", words("Refunds, Payouts!"), ["refunds", "payouts"]);
is("words too common to narrow anything are dropped", words("how to get the refund"), ["how", "get", "refund"]);
is("a single letter carries nothing", words("a 5 10 ok"), ["10", "ok"]);
is("a very long run is a hash, not a word", words("a".repeat(25)), []);
is("a query does not repeat itself", queryWords("refund refund payout"), ["refund", "payout"]);
is("a query of only common words asks for nothing", queryWords("the and to of"), []);

part("A mention names one person, or nobody");
is("a name becomes a handle", slug("Ana Silva"), "ana-silva");
is("accents fold there too", slug("João Gonçalves"), "joao-goncalves");
is("a name too short gives none", slug("A"), "");
is("the creator's cannot be taken", slug("creator"), "");
is("the handles in a text, once each", mentionsIn("@bia @bia @BIA"), ["bia"]);
is("at most ten are acted on", mentionsIn(Array.from({ length: 20 }, (_, i) => `@p${i}x`).join(" ")).length, MAX_MENTIONS);
is("an email address is not a mention", mentionsIn("write to ana@example.com"), []);
is("one at the start of a sentence counts", mentionsIn("@bia look at this"), ["bia"]);
is("one after a bracket counts", mentionsIn("(@bia)"), ["bia"]);
const known = new Map([["bia", "k1"]]);
const parts = withMentions(segments("hi @bia and @nobody"), known);
is("only a handle that names somebody is marked", parts.filter((p) => p.kind === "mention").map((p) => p.text), ["@bia"]);
is("one that names nobody stays as written", parts.filter((p) => p.kind === "text").map((p) => p.text), ["hi ", " and @nobody"]);

part("A poll counts once, and can be taken back");
is("fewer than two answers is not a poll", parsePoll({ options: ["just one"] }), null);
is("empty answers are left out", parsePoll({ options: ["a", "  ", "b"] })?.options.map((o) => o.text), ["a", "b"]);
is("twelve is the most it holds", parsePoll({ options: Array.from({ length: 20 }, (_, i) => `r${i}`) })?.options.length, MAX_POLL_OPTIONS);
const single = parsePoll({ options: ["a", "b", "c"] })!;
const many = parsePoll({ options: ["a", "b", "c"], multi: true })!;
is("one answer means one", cleanChoice(single, ["2", "3"]), ["2"]);
is("several means several", cleanChoice(many, ["1", "3"]), ["1", "3"]);
is("an answer that is not there is ignored", cleanChoice(many, ["1", "99"]), ["1"]);
is("choosing nothing takes the vote back", cleanChoice(many, []), []);
const now = 1_800_000_000;
is("no end date never closes", pollClosed({ ...single, ends: 0 }, now), false);
is("past its end it is closed", pollClosed({ ...single, ends: now - 1 }, now), true);
is("the closing line reads in days", pollWhen({ ...single, ends: now + 3 * 86_400 }, now), "Closes in 3 days");
is("and in the singular", pollWhen({ ...single, ends: now + 86_400 }, now), "Closes in 1 day");

done();
