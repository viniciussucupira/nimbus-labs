/**
 * The few words a sales page's blocks add themselves (components/sales-blocks.tsx):
 * the two sides of "who it is for", a bonus's number, a tick's meaning, and
 * what each counted number is (lib/sales-page.ts, FactsBlock). Everything
 * else on a block is the creator's own words.
 *
 * Browser-safe: plain data and small functions.
 */
import { type LanguageCode, parseLanguage } from "@/lib/store-language";

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
/** French counts 0 and 1 as singular. */
const frPlural = (n: number, one: string, many: string) => (n < 2 ? one : many);

const en = {
  fitYes: "This is for you if",
  fitNo: "This is not for you if",
  stepN: (n: number) => `Step ${n}`,
  bonusN: (n: number) => `Bonus ${n}`,
  cellYes: "Yes",
  cellNo: "No",
  /** The second column's name when the creator left it empty. */
  compareOther: "Another way",
  lessons: (n: number) => plural(n, "lesson", "lessons"),
  episodes: (n: number) => plural(n, "episode", "episodes"),
  products: (n: number) => plural(n, "product inside", "products inside"),
  minutes: (n: number) => plural(n, "minute per call", "minutes per call"),
  bought: (n: number) => plural(n, "time bought", "times bought"),
  rating: (count: number) => `average from ${count} ${plural(count, "review", "reviews")}`,
  outOfFive: "out of 5",
};

export type BlockWords = typeof en;

const es: BlockWords = {
  fitYes: "Es para ti si",
  fitNo: "No es para ti si",
  stepN: (n) => `Paso ${n}`,
  bonusN: (n) => `Bonus ${n}`,
  cellYes: "Sí",
  cellNo: "No",
  compareOther: "Otra opción",
  lessons: (n) => plural(n, "lección", "lecciones"),
  episodes: (n) => plural(n, "episodio", "episodios"),
  products: (n) => plural(n, "producto incluido", "productos incluidos"),
  minutes: (n) => plural(n, "minuto por llamada", "minutos por llamada"),
  bought: (n) => plural(n, "compra", "compras"),
  rating: (count) => `media de ${count} ${plural(count, "reseña", "reseñas")}`,
  outOfFive: "de 5",
};

const fr: BlockWords = {
  fitYes: "C'est pour vous si",
  fitNo: "Ce n'est pas pour vous si",
  stepN: (n) => `Étape ${n}`,
  bonusN: (n) => `Bonus n° ${n}`,
  cellYes: "Oui",
  cellNo: "Non",
  compareOther: "Une autre voie",
  lessons: (n) => frPlural(n, "leçon", "leçons"),
  episodes: (n) => frPlural(n, "épisode", "épisodes"),
  products: (n) => frPlural(n, "produit inclus", "produits inclus"),
  minutes: (n) => frPlural(n, "minute par appel", "minutes par appel"),
  bought: (n) => frPlural(n, "achat", "achats"),
  rating: (count) => `moyenne de ${count} ${frPlural(count, "avis", "avis")}`,
  outOfFive: "sur 5",
};

const de: BlockWords = {
  fitYes: "Das ist für Sie, wenn",
  fitNo: "Das ist nicht für Sie, wenn",
  stepN: (n) => `Schritt ${n}`,
  bonusN: (n) => `Extra ${n}`,
  cellYes: "Ja",
  cellNo: "Nein",
  compareOther: "Ein anderer Weg",
  lessons: (n) => plural(n, "Lektion", "Lektionen"),
  episodes: (n) => plural(n, "Folge", "Folgen"),
  products: (n) => plural(n, "Produkt enthalten", "Produkte enthalten"),
  minutes: (n) => plural(n, "Minute pro Gespräch", "Minuten pro Gespräch"),
  bought: (n) => plural(n, "Mal gekauft", "Mal gekauft"),
  rating: (count) => `Durchschnitt aus ${count} ${plural(count, "Bewertung", "Bewertungen")}`,
  outOfFive: "von 5",
};

const it: BlockWords = {
  fitYes: "Fa per te se",
  fitNo: "Non fa per te se",
  stepN: (n) => `Passo ${n}`,
  bonusN: (n) => `Extra ${n}`,
  cellYes: "Sì",
  cellNo: "No",
  compareOther: "Un'altra strada",
  lessons: (n) => plural(n, "lezione", "lezioni"),
  episodes: (n) => plural(n, "episodio", "episodi"),
  products: (n) => plural(n, "prodotto incluso", "prodotti inclusi"),
  minutes: (n) => plural(n, "minuto a chiamata", "minuti a chiamata"),
  bought: (n) => plural(n, "acquisto", "acquisti"),
  rating: (count) => `media di ${count} ${plural(count, "recensione", "recensioni")}`,
  outOfFive: "su 5",
};

const nl: BlockWords = {
  fitYes: "Dit is voor jou als",
  fitNo: "Dit is niet voor jou als",
  stepN: (n) => `Stap ${n}`,
  bonusN: (n) => `Extra ${n}`,
  cellYes: "Ja",
  cellNo: "Nee",
  compareOther: "Een andere manier",
  lessons: (n) => plural(n, "les", "lessen"),
  episodes: (n) => plural(n, "aflevering", "afleveringen"),
  products: (n) => plural(n, "product inbegrepen", "producten inbegrepen"),
  minutes: (n) => plural(n, "minuut per gesprek", "minuten per gesprek"),
  bought: (n) => plural(n, "keer gekocht", "keer gekocht"),
  rating: (count) => `gemiddelde van ${count} ${plural(count, "beoordeling", "beoordelingen")}`,
  outOfFive: "van 5",
};

const pt: BlockWords = {
  fitYes: "É para si se",
  fitNo: "Não é para si se",
  stepN: (n) => `Passo ${n}`,
  bonusN: (n) => `Bónus ${n}`,
  cellYes: "Sim",
  cellNo: "Não",
  compareOther: "Outro caminho",
  lessons: (n) => plural(n, "aula", "aulas"),
  episodes: (n) => plural(n, "episódio", "episódios"),
  products: (n) => plural(n, "produto incluído", "produtos incluídos"),
  minutes: (n) => plural(n, "minuto por chamada", "minutos por chamada"),
  bought: (n) => plural(n, "compra", "compras"),
  rating: (count) => `média de ${count} ${plural(count, "avaliação", "avaliações")}`,
  outOfFive: "em 5",
};

export const BLOCK_WORDS: Record<LanguageCode, BlockWords> = { en, es, fr, de, it, nl, pt };

/** The blocks' own words in the store's language; English for anything unknown. */
export function blockWords(language: unknown): BlockWords {
  return BLOCK_WORDS[parseLanguage(language)];
}
