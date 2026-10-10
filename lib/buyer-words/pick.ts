/**
 * The words of a bundle its buyer builds (lib/bundle-rules.ts, picks): "any
 * 3 of these 8", in every language a store sells in. Browser-safe: the
 * choosing is done on the page.
 */
import { type LanguageCode, parseLanguage } from "@/lib/store-language";

const en = {
  fact: (pick: number, count: number) => `Choose any ${pick} of these ${count} products`,
  legend: (pick: number) => `Choose ${pick}`,
  chosen: (have: number, pick: number) => `${have} of ${pick} chosen`,
  onItsOwn: (price: string) => `${price} on its own`,
  worth: (worth: string, price: string) => `${worth} of products for ${price}`,
  button: (pick: number, price: string) => `Buy your ${pick} for ${price}`,
  chooseFirst: (pick: number) => `Choose ${pick} to continue`,
  again: (pick: number) => `Choose exactly ${pick} products, then press the button again.`,
  each: "Each one is handed over exactly as when it is bought on its own.",
};

export type PickWords = typeof en;

const es: PickWords = {
  fact: (pick, count) => `Elige ${pick} de estos ${count} productos`,
  legend: (pick) => `Elige ${pick}`,
  chosen: (have, pick) => `${have} de ${pick} elegidos`,
  onItsOwn: (price) => `${price} por separado`,
  worth: (worth, price) => `${worth} en productos por ${price}`,
  button: (pick, price) => `Compra tus ${pick} por ${price}`,
  chooseFirst: (pick) => `Elige ${pick} para continuar`,
  again: (pick) => `Elige exactamente ${pick} productos y vuelve a pulsar el botón.`,
  each: "Cada uno se entrega igual que si lo compraras por separado.",
};

const fr: PickWords = {
  fact: (pick, count) => `Choisissez ${pick} produits parmi ces ${count}`,
  legend: (pick) => `Choisissez-en ${pick}`,
  chosen: (have, pick) => `${have} sur ${pick} choisis`,
  onItsOwn: (price) => `${price} à l'unité`,
  worth: (worth, price) => `${worth} de produits pour ${price}`,
  button: (pick, price) => `Acheter vos ${pick} pour ${price}`,
  chooseFirst: (pick) => `Choisissez-en ${pick} pour continuer`,
  again: (pick) => `Choisissez exactement ${pick} produits, puis appuyez de nouveau sur le bouton.`,
  each: "Chacun est remis exactement comme s'il était acheté seul.",
};

const de: PickWords = {
  fact: (pick, count) => `Wählen Sie ${pick} dieser ${count} Produkte`,
  legend: (pick) => `Wählen Sie ${pick}`,
  chosen: (have, pick) => `${have} von ${pick} gewählt`,
  onItsOwn: (price) => `${price} einzeln`,
  worth: (worth, price) => `Produkte im Wert von ${worth} für ${price}`,
  button: (pick, price) => `Ihre ${pick} für ${price} kaufen`,
  chooseFirst: (pick) => `Wählen Sie ${pick}, um fortzufahren`,
  again: (pick) => `Wählen Sie genau ${pick} Produkte und drücken Sie dann erneut auf die Schaltfläche.`,
  each: "Jedes wird genau so übergeben, als hätten Sie es einzeln gekauft.",
};

const it: PickWords = {
  fact: (pick, count) => `Scegli ${pick} di questi ${count} prodotti`,
  legend: (pick) => `Scegline ${pick}`,
  chosen: (have, pick) => `${have} su ${pick} scelti`,
  onItsOwn: (price) => `${price} da solo`,
  worth: (worth, price) => `${worth} di prodotti a ${price}`,
  button: (pick, price) => `Compra i tuoi ${pick} a ${price}`,
  chooseFirst: (pick) => `Scegline ${pick} per continuare`,
  again: (pick) => `Scegli esattamente ${pick} prodotti, poi premi di nuovo il pulsante.`,
  each: "Ognuno viene consegnato esattamente come se lo comprassi da solo.",
};

const nl: PickWords = {
  fact: (pick, count) => `Kies er ${pick} uit deze ${count} producten`,
  legend: (pick) => `Kies er ${pick}`,
  chosen: (have, pick) => `${have} van ${pick} gekozen`,
  onItsOwn: (price) => `${price} los`,
  worth: (worth, price) => `${worth} aan producten voor ${price}`,
  button: (pick, price) => `Koop je ${pick} voor ${price}`,
  chooseFirst: (pick) => `Kies er ${pick} om verder te gaan`,
  again: (pick) => `Kies precies ${pick} producten en druk dan opnieuw op de knop.`,
  each: "Elk wordt precies zo geleverd als wanneer je het los koopt.",
};

const pt: PickWords = {
  fact: (pick, count) => `Escolha ${pick} destes ${count} produtos`,
  legend: (pick) => `Escolha ${pick}`,
  chosen: (have, pick) => `${have} de ${pick} escolhidos`,
  onItsOwn: (price) => `${price} em separado`,
  worth: (worth, price) => `${worth} em produtos por ${price}`,
  button: (pick, price) => `Comprar os seus ${pick} por ${price}`,
  chooseFirst: (pick) => `Escolha ${pick} para continuar`,
  again: (pick) => `Escolha exatamente ${pick} produtos e carregue novamente no botão.`,
  each: "Cada um é entregue exatamente como se o comprasse em separado.",
};

export const PICK_WORDS: Record<LanguageCode, PickWords> = { en, es, fr, de, it, nl, pt };

export function pickWords(language: unknown): PickWords {
  return PICK_WORDS[parseLanguage(language)];
}
