/**
 * The words of a store's cart (lib/cart-rules.ts), in every language a store
 * sells in. Browser-safe: the cart is kept and shown in the visitor's browser.
 */
import { type LanguageCode, parseLanguage } from "@/lib/store-language";

const S = " ";

const en = {
  add: "Add to cart",
  added: "In your cart: remove",
  full: (max: number) => `A cart holds up to ${max} products.`,
  open: (count: number) => `Cart, ${count} ${count === 1 ? "product" : "products"}`,
  title: "Your cart",
  remove: (title: string) => `Remove ${title}`,
  total: "Total",
  checkout: (total: string) => `Check out · ${total}`,
  note: "You pay once, on Stripe's secure page. Each product is handed over exactly as if you had bought it on its own.",
  empty: "Your cart is empty.",
  gone: "Not available in a cart right now: buy it from its own page.",
  loading: "Checking the prices…",
  close: "Close",
  changed: "Something in your cart changed since you added it. Look it over and check out again.",
  error: "The payment page could not be opened. Nothing was charged. Try again in a moment.",
};

export type CartWords = typeof en;

const es: CartWords = {
  add: "Añadir al carrito",
  added: "En tu carrito: quitar",
  full: (max) => `Un carrito admite hasta ${max} productos.`,
  open: (count) => `Carrito, ${count} ${count === 1 ? "producto" : "productos"}`,
  title: "Tu carrito",
  remove: (title) => `Quitar ${title}`,
  total: "Total",
  checkout: (total) => `Pagar · ${total}`,
  note: "Pagas una sola vez, en la página segura de Stripe. Cada producto se entrega igual que si lo compraras por separado.",
  empty: "Tu carrito está vacío.",
  gone: "No está disponible en un carrito ahora mismo: cómpralo desde su propia página.",
  loading: "Comprobando los precios…",
  close: "Cerrar",
  changed: "Algo de tu carrito cambió desde que lo añadiste. Revísalo y vuelve a pagar.",
  error: "No se pudo abrir la página de pago. No se cobró nada. Inténtalo de nuevo en un momento.",
};

const fr: CartWords = {
  add: "Ajouter au panier",
  added: `Dans votre panier${S}: retirer`,
  full: (max) => `Un panier contient jusqu'à ${max} produits.`,
  open: (count) => `Panier, ${count} ${count <= 1 ? "produit" : "produits"}`,
  title: "Votre panier",
  remove: (title) => `Retirer ${title}`,
  total: "Total",
  checkout: (total) => `Payer · ${total}`,
  note: "Vous payez une seule fois, sur la page sécurisée de Stripe. Chaque produit est remis exactement comme s'il était acheté seul.",
  empty: "Votre panier est vide.",
  gone: `Pas disponible dans un panier pour l'instant${S}: achetez-le depuis sa propre page.`,
  loading: "Vérification des prix…",
  close: "Fermer",
  changed: "Quelque chose a changé dans votre panier depuis votre ajout. Vérifiez-le et payez de nouveau.",
  error: "La page de paiement n'a pas pu s'ouvrir. Rien n'a été débité. Réessayez dans un instant.",
};

const de: CartWords = {
  add: "In den Warenkorb",
  added: "Im Warenkorb: entfernen",
  full: (max) => `Ein Warenkorb fasst bis zu ${max} Produkte.`,
  open: (count) => `Warenkorb, ${count} ${count === 1 ? "Produkt" : "Produkte"}`,
  title: "Ihr Warenkorb",
  remove: (title) => `${title} entfernen`,
  total: "Gesamt",
  checkout: (total) => `Zur Kasse · ${total}`,
  note: "Sie bezahlen einmal, auf der sicheren Seite von Stripe. Jedes Produkt wird genau so übergeben, als hätten Sie es einzeln gekauft.",
  empty: "Ihr Warenkorb ist leer.",
  gone: "Gerade nicht im Warenkorb erhältlich: Kaufen Sie es auf seiner eigenen Seite.",
  loading: "Preise werden geprüft…",
  close: "Schließen",
  changed: "Seit dem Hinzufügen hat sich etwas in Ihrem Warenkorb geändert. Prüfen Sie ihn und gehen Sie erneut zur Kasse.",
  error: "Die Zahlungsseite konnte nicht geöffnet werden. Es wurde nichts berechnet. Versuchen Sie es gleich noch einmal.",
};

const it: CartWords = {
  add: "Aggiungi al carrello",
  added: "Nel carrello: rimuovi",
  full: (max) => `Un carrello contiene fino a ${max} prodotti.`,
  open: (count) => `Carrello, ${count} ${count === 1 ? "prodotto" : "prodotti"}`,
  title: "Il tuo carrello",
  remove: (title) => `Rimuovi ${title}`,
  total: "Totale",
  checkout: (total) => `Paga · ${total}`,
  note: "Paghi una volta sola, sulla pagina sicura di Stripe. Ogni prodotto viene consegnato esattamente come se lo comprassi da solo.",
  empty: "Il tuo carrello è vuoto.",
  gone: "Al momento non disponibile in un carrello: compralo dalla sua pagina.",
  loading: "Controllo dei prezzi…",
  close: "Chiudi",
  changed: "Qualcosa nel tuo carrello è cambiato da quando l'hai aggiunto. Controllalo e paga di nuovo.",
  error: "Non è stato possibile aprire la pagina di pagamento. Non è stato addebitato nulla. Riprova tra poco.",
};

const nl: CartWords = {
  add: "In winkelwagen",
  added: "In je winkelwagen: verwijderen",
  full: (max) => `Een winkelwagen bevat tot ${max} producten.`,
  open: (count) => `Winkelwagen, ${count} ${count === 1 ? "product" : "producten"}`,
  title: "Je winkelwagen",
  remove: (title) => `${title} verwijderen`,
  total: "Totaal",
  checkout: (total) => `Afrekenen · ${total}`,
  note: "Je betaalt één keer, op de beveiligde pagina van Stripe. Elk product wordt precies zo geleverd als wanneer je het los koopt.",
  empty: "Je winkelwagen is leeg.",
  gone: "Nu niet beschikbaar in een winkelwagen: koop het op zijn eigen pagina.",
  loading: "Prijzen controleren…",
  close: "Sluiten",
  changed: "Er is iets in je winkelwagen veranderd sinds je het toevoegde. Bekijk het en reken opnieuw af.",
  error: "De betaalpagina kon niet worden geopend. Er is niets afgeschreven. Probeer het zo opnieuw.",
};

const pt: CartWords = {
  add: "Adicionar ao carrinho",
  added: "No seu carrinho: remover",
  full: (max) => `Um carrinho leva até ${max} produtos.`,
  open: (count) => `Carrinho, ${count} ${count === 1 ? "produto" : "produtos"}`,
  title: "O seu carrinho",
  remove: (title) => `Remover ${title}`,
  total: "Total",
  checkout: (total) => `Pagar · ${total}`,
  note: "Paga uma única vez, na página segura da Stripe. Cada produto é entregue exatamente como se o comprasse em separado.",
  empty: "O seu carrinho está vazio.",
  gone: "Não está disponível num carrinho neste momento: compre-o na sua própria página.",
  loading: "A verificar os preços…",
  close: "Fechar",
  changed: "Algo no seu carrinho mudou desde que o adicionou. Reveja-o e pague novamente.",
  error: "Não foi possível abrir a página de pagamento. Nada foi cobrado. Tente novamente daqui a pouco.",
};

export const CART_WORDS: Record<LanguageCode, CartWords> = { en, es, fr, de, it, nl, pt };

export function cartWords(language: unknown): CartWords {
  return CART_WORDS[parseLanguage(language)];
}
