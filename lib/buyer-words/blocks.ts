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
  /** The picture viewer (components/picture-viewer.tsx). */
  viewerClose: "Close",
  viewerPrev: "Previous picture",
  viewerNext: "Next picture",
  viewerCount: (n: number, total: number) => `${n} of ${total}`,
  viewerOriginal: "Open the original",
  /** The link on another product's card (lib/sales-page.ts, ProductBlock). */
  productLink: "Take a look",
  /** Under a thing said elsewhere, the link to where it was said (lib/sales-page.ts, QuotesBlock). */
  quoteSource: (host: string) => `See it on ${host}`,
  /** The creator's profiles elsewhere, under their name on the store page (lib/store-socials.ts). */
  socialsLabel: "Elsewhere",
  socialEmail: "Email",
  socialWebsite: "Website",
  /** A profile link's full name, for screen readers: "Ana on Instagram". */
  socialOn: (name: string, network: string) => `${name} on ${network}`,
  /** A video that loads only when asked (components/video-embed.tsx). */
  videoPlay: (provider: string) => `Play · loads from ${provider}`,
  videoPlayLabel: (title: string, provider: string) => `Play the video: ${title}. It loads from ${provider}.`,
  videoFrame: (title: string, provider: string) => `${title} (video on ${provider})`,
  /** Under a video link played on the store page, the way to its own site. */
  videoOpen: (provider: string) => `Open on ${provider}`,
  /** Beside the store's stars under its name: the average is of every product's reviews. */
  storeRatingNote: "across every product",
  /** The button under the store's name that shares its address (components/store-share-button.tsx). */
  shareStore: "Share",
  shareCopied: "Link copied",
  shareStoreLabel: "Share this store",
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
  /** The picture viewer (components/picture-viewer.tsx). */
  viewerClose: "Cerrar",
  viewerPrev: "Foto anterior",
  viewerNext: "Foto siguiente",
  viewerCount: (n, total) => `${n} de ${total}`,
  viewerOriginal: "Abrir el original",
  /** The link on another product's card (lib/sales-page.ts, ProductBlock). */
  productLink: "Ver más",
  /** Under a thing said elsewhere, the link to where it was said (lib/sales-page.ts, QuotesBlock). */
  quoteSource: (host) => `Verlo en ${host}`,
  socialsLabel: "En otros sitios",
  socialEmail: "Correo",
  socialWebsite: "Sitio web",
  socialOn: (name, network) => `${name} en ${network}`,
  videoPlay: (provider) => `Reproducir · se carga desde ${provider}`,
  videoPlayLabel: (title, provider) => `Reproducir el vídeo: ${title}. Se carga desde ${provider}.`,
  videoFrame: (title, provider) => `${title} (vídeo en ${provider})`,
  videoOpen: (provider) => `Abrir en ${provider}`,
  storeRatingNote: "en todos los productos",
  shareStore: "Compartir",
  shareCopied: "Enlace copiado",
  shareStoreLabel: "Compartir esta tienda",
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
  /** The picture viewer (components/picture-viewer.tsx). */
  viewerClose: "Fermer",
  viewerPrev: "Photo précédente",
  viewerNext: "Photo suivante",
  viewerCount: (n, total) => `${n} sur ${total}`,
  viewerOriginal: "Ouvrir l'original",
  /** The link on another product's card (lib/sales-page.ts, ProductBlock). */
  productLink: "Découvrir",
  /** Under a thing said elsewhere, the link to where it was said (lib/sales-page.ts, QuotesBlock). */
  quoteSource: (host) => `Voir sur ${host}`,
  socialsLabel: "Ailleurs",
  socialEmail: "E-mail",
  socialWebsite: "Site web",
  socialOn: (name, network) => `${name} sur ${network}`,
  videoPlay: (provider) => `Lire · chargée depuis ${provider}`,
  videoPlayLabel: (title, provider) => `Lire la vidéo « ${title} », chargée depuis ${provider}.`,
  videoFrame: (title, provider) => `${title} (vidéo sur ${provider})`,
  videoOpen: (provider) => `Ouvrir sur ${provider}`,
  storeRatingNote: "sur tous les produits",
  shareStore: "Partager",
  shareCopied: "Lien copié",
  shareStoreLabel: "Partager cette boutique",
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
  /** The picture viewer (components/picture-viewer.tsx). */
  viewerClose: "Schließen",
  viewerPrev: "Vorheriges Bild",
  viewerNext: "Nächstes Bild",
  viewerCount: (n, total) => `${n} von ${total}`,
  viewerOriginal: "Original öffnen",
  /** The link on another product's card (lib/sales-page.ts, ProductBlock). */
  productLink: "Ansehen",
  /** Under a thing said elsewhere, the link to where it was said (lib/sales-page.ts, QuotesBlock). */
  quoteSource: (host) => `Auf ${host} ansehen`,
  socialsLabel: "Auch hier zu finden",
  socialEmail: "E-Mail",
  socialWebsite: "Website",
  socialOn: (name, network) => `${name} auf ${network}`,
  videoPlay: (provider) => `Abspielen · wird von ${provider} geladen`,
  videoPlayLabel: (title, provider) => `Video abspielen: ${title}. Es wird von ${provider} geladen.`,
  videoFrame: (title, provider) => `${title} (Video auf ${provider})`,
  videoOpen: (provider) => `Auf ${provider} öffnen`,
  storeRatingNote: "über alle Produkte",
  shareStore: "Teilen",
  shareCopied: "Link kopiert",
  shareStoreLabel: "Diesen Shop teilen",
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
  /** The picture viewer (components/picture-viewer.tsx). */
  viewerClose: "Chiudi",
  viewerPrev: "Foto precedente",
  viewerNext: "Foto successiva",
  viewerCount: (n, total) => `${n} di ${total}`,
  viewerOriginal: "Apri l'originale",
  /** The link on another product's card (lib/sales-page.ts, ProductBlock). */
  productLink: "Scopri",
  /** Under a thing said elsewhere, the link to where it was said (lib/sales-page.ts, QuotesBlock). */
  quoteSource: (host) => `Vedi su ${host}`,
  socialsLabel: "Altrove",
  socialEmail: "Email",
  socialWebsite: "Sito web",
  socialOn: (name, network) => `${name} su ${network}`,
  videoPlay: (provider) => `Riproduci · si carica da ${provider}`,
  videoPlayLabel: (title, provider) => `Riproduci il video: ${title}. Si carica da ${provider}.`,
  videoFrame: (title, provider) => `${title} (video su ${provider})`,
  videoOpen: (provider) => `Apri su ${provider}`,
  storeRatingNote: "su tutti i prodotti",
  shareStore: "Condividi",
  shareCopied: "Link copiato",
  shareStoreLabel: "Condividi questo negozio",
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
  /** The picture viewer (components/picture-viewer.tsx). */
  viewerClose: "Sluiten",
  viewerPrev: "Vorige foto",
  viewerNext: "Volgende foto",
  viewerCount: (n, total) => `${n} van ${total}`,
  viewerOriginal: "Origineel openen",
  /** The link on another product's card (lib/sales-page.ts, ProductBlock). */
  productLink: "Bekijken",
  /** Under a thing said elsewhere, the link to where it was said (lib/sales-page.ts, QuotesBlock). */
  quoteSource: (host) => `Bekijk op ${host}`,
  socialsLabel: "Ook te vinden op",
  socialEmail: "E-mail",
  socialWebsite: "Website",
  socialOn: (name, network) => `${name} op ${network}`,
  videoPlay: (provider) => `Afspelen · laadt van ${provider}`,
  videoPlayLabel: (title, provider) => `Speel de video af: ${title}. Hij laadt van ${provider}.`,
  videoFrame: (title, provider) => `${title} (video op ${provider})`,
  videoOpen: (provider) => `Openen op ${provider}`,
  storeRatingNote: "over alle producten",
  shareStore: "Delen",
  shareCopied: "Link gekopieerd",
  shareStoreLabel: "Deel deze winkel",
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
  /** The picture viewer (components/picture-viewer.tsx). */
  viewerClose: "Fechar",
  viewerPrev: "Foto anterior",
  viewerNext: "Próxima foto",
  viewerCount: (n, total) => `${n} de ${total}`,
  viewerOriginal: "Abrir o original",
  /** The link on another product's card (lib/sales-page.ts, ProductBlock). */
  productLink: "Ver mais",
  /** Under a thing said elsewhere, the link to where it was said (lib/sales-page.ts, QuotesBlock). */
  quoteSource: (host) => `Ver em ${host}`,
  socialsLabel: "Em outros lugares",
  socialEmail: "E-mail",
  socialWebsite: "Site",
  socialOn: (name, network) => `${name} no ${network}`,
  videoPlay: (provider) => `Reproduzir · carrega do ${provider}`,
  videoPlayLabel: (title, provider) => `Reproduzir o vídeo: ${title}. Ele carrega do ${provider}.`,
  videoFrame: (title, provider) => `${title} (vídeo no ${provider})`,
  videoOpen: (provider) => `Abrir no ${provider}`,
  storeRatingNote: "em todos os produtos",
  shareStore: "Partilhar",
  shareCopied: "Ligação copiada",
  shareStoreLabel: "Partilhar esta loja",
};

export const BLOCK_WORDS: Record<LanguageCode, BlockWords> = { en, es, fr, de, it, nl, pt };

/** The blocks' own words in the store's language; English for anything unknown. */
export function blockWords(language: unknown): BlockWords {
  return BLOCK_WORDS[parseLanguage(language)];
}
