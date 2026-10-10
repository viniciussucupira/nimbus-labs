/**
 * The studio's help assistant (added 10 October 2026): a creator asks how to
 * do something in plain words, and is answered from the help center's own
 * answers (lib/help-content.ts) — the ones that fit the question are found
 * here, by their words, and only those are given to the model
 * (lib/ai.ts, answerHelp), which may say nothing they do not say. Each answer
 * comes back with the help center's own links, so the creator can read the
 * whole thing. Stan's Stanley answers questions about Stan; this answers them
 * from what the help center says today, and says when it does not know.
 */
import { HELP_SECTIONS, answerId } from "@/lib/help-content";

export type HelpPassage = { id: string; q: string; a: string; section: string };

const STOP = new Set(
  "a an and are as at be by can do does for from how i if in is it its me my of on or our so that the this to was what when where which who why will with you your yours".split(" "),
);

/** A word's plain stem: lower case, without the endings that only change its form. */
export function stem(word: string): string {
  let w = word;
  if (w.length > 5 && /ings?$/.test(w)) w = w.replace(/ings?$/, "");
  else if (w.length > 4 && /ie[sd]$/.test(w)) w = w.replace(/ie[sd]$/, "y");
  else if (/(ch|sh|ss|x|z)es$/.test(w)) w = w.slice(0, -2);
  else if (w.length > 3 && /[^s]s$/.test(w)) w = w.slice(0, -1);
  else if (w.length > 5 && /ed$/.test(w)) w = w.slice(0, -2);
  return w.slice(0, 12);
}

export function words(text: string): string[] {
  return (text.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").match(/[a-z0-9]+/g) ?? [])
    .filter((w) => w.length > 1 && !STOP.has(w))
    .map(stem)
    .filter(Boolean);
}

let passages: (HelpPassage & { qWords: Set<string>; aWords: Set<string> })[] | null = null;

function allPassages() {
  passages ??= HELP_SECTIONS.flatMap((section) =>
    section.items.map((item) => {
      const a = item.a.join("\n\n");
      return { id: answerId(item.q), q: item.q, a, section: section.title, qWords: new Set(words(`${item.q} ${section.title}`)), aWords: new Set(words(a)) };
    }),
  );
  return passages;
}

/**
 * The help answers that fit a question best, most fitting first: a word of
 * the question in an answer's own question counts three times what it does in
 * the answer's text. At most `most`, and only those that share a word.
 */
export function pickHelp(question: string, most = 6): HelpPassage[] {
  const asked = [...new Set(words(question))];
  if (asked.length === 0) return [];
  return allPassages()
    .map((p) => ({ p, score: asked.reduce((sum, w) => sum + (p.qWords.has(w) ? 3 : 0) + (p.aWords.has(w) ? 1 : 0), 0) }))
    .filter((x) => x.score > 0)
    .sort((x, y) => y.score - x.score)
    .slice(0, most)
    .map(({ p }) => ({ id: p.id, q: p.q, a: p.a, section: p.section }));
}
