/**
 * What one unit costs within each price option (lib/option-units.ts;
 * components/store-product.tsx). Checked: read only when every name is a
 * count and the same word, with a single one among them; the price per unit
 * and the saving are the sums of the creator's own prices; anything else
 * shows nothing; every store language says it.
 */
import { unitLines } from "@/lib/option-units";
import { wordsIn } from "@/lib/buyer-words";
import { LANGUAGE_CODES } from "@/lib/store-language";
import { done, is, part } from "./check";

const o = (id: string, label: string, priceCents: number) => ({ id, label, priceCents });

part("Read from the names");
const weeks = unitLines([o("a", "1 week", 2700), o("b", "5 weeks", 3900)]);
is("one week at $27 and five at $39: $7.80 a week, 71% less", weeks.get("b"), { perUnitCents: 780, unit: "week", savePercent: 71 });
is("nothing under the single one", weeks.has("a"), false);
is("in another language, the same", unitLines([o("a", "1 semana", 1000), o("b", "4 semanas", 3000)]).get("b"), { perUnitCents: 750, unit: "semana", savePercent: 25 });
is("and in German", unitLines([o("a", "1 Woche", 1000), o("b", "3 Wochen", 2400)]).get("b")?.unit, "Woche");
is("a saving under five percent is not said", unitLines([o("a", "1 call", 10000), o("b", "2 calls", 19500)]).get("b")?.savePercent, 0);

part("Nothing when the names do not say");
for (const [label, list] of [
  ["names that are not counts", [o("a", "Personal", 1000), o("b", "Commercial", 3000)]],
  ["two different words", [o("a", "1 course", 1000), o("b", "3 calls", 3000)]],
  ["no single one to say per", [o("a", "2 weeks", 1000), o("b", "5 weeks", 2000)]],
  ["one of them not a count", [o("a", "1 week", 1000), o("b", "Lifetime", 5000)]],
  ["the same count twice", [o("a", "1 week", 1000), o("b", "1 week", 900)]],
  ["a free single one", [o("a", "1 week", 0), o("b", "5 weeks", 3000)]],
] as const) {
  is(label, unitLines([...list]).size, 0);
}

part("Said in every store language");
is("each language has the words", LANGUAGE_CODES.map((code) => {
  const w = wordsIn(code);
  return w.perUnit("$7.80", "week").includes("$7.80") && w.unitSaving(71).includes("71");
}), LANGUAGE_CODES.map(() => true));
done();
