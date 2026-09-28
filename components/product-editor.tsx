"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CallEditor, type MeetAccount } from "@/components/call-editor";
import { CourseToggle } from "@/components/course-toggle";
import { BundleToggle } from "@/components/bundle-toggle";
import { CheckoutExtras, bumpChoices } from "@/components/checkout-extras";
import type { BumpChoice, ProductPaging } from "@/lib/catalog";
import { CheckoutFieldsEditor } from "@/components/checkout-fields-editor";
import { ProductImageEditor } from "@/components/product-image-editor";
import { LicenceKeyEditor } from "@/components/licence-key-editor";
import { PdfStampToggle } from "@/components/pdf-stamp-toggle";
import { toast } from "@/components/toast";
import { uploadPresigned } from "@vercel/blob/client";
import {
  MAX_PRODUCTS,
  MAX_SUMMARY_LENGTH,
  MAX_TITLE_LENGTH,
  isFree,
  type Product,
} from "@/lib/store";
import { type Currency, fieldPrefix, formatMoney, moneyField, priceExample, priceBounds, rangeWords, readMoney } from "@/lib/money";
import { StoreCurrency, useStoreCurrency } from "@/components/store-currency";
import {
  ACCEPT_ATTRIBUTE,
  MAX_FILE_BYTES,
  MULTIPART_ABOVE_BYTES,
  maxFileLabel,
  fileFolder,
  readableSize,
  safeFileName,
  type ProductFile,
} from "@/lib/product-file";
import {
  MAX_OPTIONS,
  MAX_OPTION_LABEL_LENGTH,
} from "@/lib/product-option";
import { LINK_PROBLEMS, type LinkProblem, linkHost } from "@/lib/product-link";
import {
  INTERVALS,
  type Interval,
  MAX_MEMBER_PAYMENTS,
  MAX_TRIAL_DAYS,
  MIN_MEMBER_PAYMENTS,
  MIN_TRIAL_DAYS,
  everyLabel,
  intervalAdjective,
  intervalName,
  membershipPrice,
} from "@/lib/product-recurring";
import { MAX_ABOUT_LENGTH } from "@/lib/product-about";
import { imageUrl } from "@/lib/product-image";
import { StoreField, useStudioHref, useStudioStore } from "@/components/studio-store-pin";
import { STUDIO_MESSAGES } from "@/lib/studio-messages";

/** The sentences about amounts, in the store's own currency (lib/money.ts). */
const optionPrice = (currency: Currency) => `Type an amount ${rangeWords(currency)}, like ${priceExample(currency, 39)}.`;
const productPrice = (currency: Currency) =>
  `Type 0 to give it away, or an amount ${rangeWords(currency)}, like ${priceExample(currency)}.`;
const pwywFree = (currency: Currency) =>
  `Something free has no price to choose. Give it a lowest price of at least ${formatMoney(priceBounds(currency).min, currency)}.`;
const pwywSuggested = (currency: Currency) =>
  `Type a suggested price between the lowest price and ${formatMoney(priceBounds(currency).max, currency)}, like ${priceExample(currency, 15)}.`;

/** What to say when a price option is refused, over and above the shared set. */
const OPTION_MESSAGES: Record<string, string> = {
  free: "This one is free, so it has no prices to add. Give it a price first.",
  unknown: "That price is no longer on this product.",
  none: "This account has no store yet.",
  signed_out: "Your session ended. Log in again.",
  unavailable: "Stores are not switched on yet, so nothing was saved.",
  call: "This is a paid call, so it has one price. Stop selling it as a call first to add others.",
  course: "A course is sold at one price, so it cannot have several.",
  bundle: "A bundle has one price for everything in it, so it cannot have several.",
  store_full: "Your store has reached the most it can hold. Remove something, or shorten a long list of choices, to make room.",
};

/** Why a price the buyer chooses was refused, in words the creator can act on. */
const PWYW_MESSAGES: Record<string, string> = {
  recurring: "A membership charges the same amount each time, so its buyers cannot choose it. Stripe lets a buyer choose the amount of a one-off payment only.",
  options: "This product has several prices already. Take them off first: the buyer would be choosing twice.",
  call: "A paid call is booked for a time at a set price, so it cannot be pay what you want.",
  plan: "This product offers a payment plan. Stop offering it first: a plan needs a set total to divide.",
  bump: "This product offers another one at checkout. Stop offering it first: Stripe lets a chosen amount be the only thing in its checkout.",
};

const MESSAGES: Record<string, string> = {
  ...STUDIO_MESSAGES,
  title: "Give it a name before saving.",
  trial: `Type a free trial of ${MIN_TRIAL_DAYS} to ${MAX_TRIAL_DAYS} days, or leave it empty for none.`,
  payments: `Type ${MIN_MEMBER_PAYMENTS} to ${MAX_MEMBER_PAYMENTS} payments, or leave it empty for a membership that runs until it is canceled.`,
  store_full: "Your store has reached the most it can hold. Remove something, or shorten a long list of choices, to make room.",
  free: "Something free is given once, for an email address, so it cannot be a membership or have several prices. Take those off first.",
  unknown: "That is no longer on your store.",
  call: "This is a paid call, so it has one price, charged once, and delivers a time rather than a file. Stop selling it as a call first to change that.",
  course: "This is a course: it cannot be free, and it delivers its lessons rather than a file or a link of its own. Its lessons are changed from its own page.",
  bundle: "This is a bundle: one sale, at one price, of the products in it. It cannot be free, a membership, pay what you want, have several prices or a file of its own. Change what is in it on its bundle page.",
  too_big: `That file is over ${maxFileLabel()}, the largest one file can be.`,
  wrong_type: "That kind of file is not one a store can sell here.",
  none: "This account has no store yet.",
  signed_out: "Your session ended. Log in again.",
  unavailable: "Stores are not switched on yet, so nothing was saved.",
  server_error: "Something went wrong on our side. Try again in a moment.",
};

type Draft = {
  title: string;
  summary: string;
  price: string;
  /** "" means a single sale. Anything else is how often it charges. */
  every: "" | Interval;
  /** Days free before a membership's first payment. "" is none. */
  trial: string;
  /** Payments before a membership ends by itself. "" is until cancelled. */
  payments: string;
  /** Whether the buyer chooses the price, from `price` up. */
  pwyw: boolean;
  /** The amount suggested to a buyer who chooses. */
  suggested: string;
  /** The long description, on the product's own page. */
  about: string;
};

const EMPTY: Draft = {
  title: "",
  summary: "",
  price: "",
  every: "",
  trial: "",
  payments: "",
  pwyw: false,
  suggested: "",
  about: "",
};

/** What the form sends for a draft, add or edit alike. */
function payloadOf(draft: Draft): Record<string, unknown> {
  return {
    title: draft.title,
    summary: draft.summary,
    price: draft.price,
    every: draft.every,
    trial: draft.every ? draft.trial.trim() : "",
    payments: draft.every ? draft.payments.trim() : "",
    pwyw: draft.pwyw && !draft.every ? draft.suggested.trim() || draft.price.trim() : null,
    about: draft.about,
  };
}

/** Whether what was typed in the price field means free. */
function typedFree(price: string): boolean {
  return /^0+(\.0{1,2})?$/.test(price.trim());
}

async function send(payload: Record<string, unknown>, currency: Currency): Promise<string | null> {
  try {
    const response = await fetch("/api/store/product", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await response.json()) as {
      ok?: boolean;
      error?: string;
      limit?: number;
      reason?: string;
    };
    if (data.ok) return null;
    if (data.error === "link") {
      // The server says which way the link was wrong; the creator gets that
      // sentence rather than a generic failure they cannot act on.
      return (
        LINK_PROBLEMS[data.reason as LinkProblem] ?? LINK_PROBLEMS.shape
      );
    }
    if (data.error === "too_many") {
      return `A store lists up to ${(data.limit ?? MAX_PRODUCTS).toLocaleString("en-US")} things, and yours is full. Remove one to add another.`;
    }
    if (data.error === "pwyw") {
      const why = (data as { pwyw?: string }).pwyw ?? "";
      if (why === "free") return pwywFree(currency);
      return why === "suggested" || !PWYW_MESSAGES[why] ? pwywSuggested(currency) : PWYW_MESSAGES[why];
    }
    if (data.error === "price") return productPrice(currency);
    return MESSAGES[data.error ?? ""] ?? MESSAGES.server_error;
  } catch {
    return MESSAGES.server_error;
  }
}

/** The form used both for adding something and for changing it. */
function ProductForm({
  draft,
  setDraft,
  busy,
  error,
  submitLabel,
  onSubmit,
  onCancel,
  product,
  loadingAbout = false,
}: {
  draft: Draft;
  setDraft: (draft: Draft) => void;
  busy: boolean;
  error: string | null;
  submitLabel: string;
  onSubmit: () => void;
  onCancel: () => void;
  /** The product being changed; absent when adding one. */
  product?: Product;
  /** Whether the long description is still being read. */
  loadingAbout?: boolean;
}) {
  const id = product?.id ?? "new";
  const currency = useStoreCurrency();
  const prefix = fieldPrefix(currency);
  const free = typedFree(draft.price);
  // Said before the box is ticked rather than after saving: what else on the
  // product would stop a buyer from choosing the price.
  const pwywBlocked = product
    ? product.options.length > 0
      ? PWYW_MESSAGES.options
      : product.call
        ? PWYW_MESSAGES.call
        : product.plan
          ? PWYW_MESSAGES.plan
          : product.bump
            ? PWYW_MESSAGES.bump
            : null
    : null;
  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (!busy) onSubmit();
      }}
      className="space-y-4 rounded-2xl border-2 border-violet-brand/30 bg-white p-4"
    >
      <div>
        <label
          htmlFor={`product-title-${id}`}
          className="field-label"
        >
          What you are selling
        </label>
        <input
          id={`product-title-${id}`}
          name="title"
          type="text"
          required
          maxLength={MAX_TITLE_LENGTH}
          value={draft.title}
          onChange={(event) =>
            setDraft({ ...draft, title: event.target.value })
          }
          placeholder="The Weeknight Recipe Pack"
          className="field mt-2"
        />
      </div>

      <div>
        <label
          htmlFor={`product-summary-${id}`}
          className="field-label"
        >
          What the buyer gets, in short
        </label>
        <textarea
          id={`product-summary-${id}`}
          name="summary"
          rows={3}
          maxLength={MAX_SUMMARY_LENGTH}
          value={draft.summary}
          onChange={(event) =>
            setDraft({ ...draft, summary: event.target.value })
          }
          placeholder="Forty recipes, each one on a single page, as a PDF."
          className="field mt-2"
        />
        <p className="mt-1 text-sm text-ink-soft">
          {`On the card on your page. ${MAX_SUMMARY_LENGTH - draft.summary.length} characters left.`}
        </p>
      </div>

      <div>
        <label htmlFor={`product-about-${id}`} className="field-label">
          The full description <span className="font-normal text-ink-soft">(optional)</span>
        </label>
        <textarea
          id={`product-about-${id}`}
          name="about"
          rows={7}
          maxLength={MAX_ABOUT_LENGTH}
          value={draft.about}
          disabled={loadingAbout}
          aria-busy={loadingAbout}
          onChange={(event) => setDraft({ ...draft, about: event.target.value })}
          placeholder={"What is inside, who it is for, and what happens after they buy.\n\n- One point per line, starting with a dash, makes a list.\n- Web addresses become links."}
          className="field mt-2"
        />
        <p className="mt-1 text-sm text-ink-soft">
          {loadingAbout
            ? "Reading what you wrote…"
            : `On this product's own page, which the card links to. A blank line starts a new paragraph. ${(MAX_ABOUT_LENGTH - draft.about.length).toLocaleString("en-US")} characters left.`}
        </p>
      </div>

      <div>
        <label
          htmlFor={`product-price-${id}`}
          className="field-label"
        >
          {draft.pwyw && !draft.every && !free ? "Lowest price" : "Price"}
        </label>
        <div className="card mt-2 flex items-center pl-4 transition focus-within:border-violet-brand">
          <span className="whitespace-nowrap text-ink-soft">{prefix}</span>
          <input
            id={`product-price-${id}`}
            name="price"
            type="text"
            inputMode={currency === "jpy" ? "numeric" : "decimal"}
            required
            value={draft.price}
            onChange={(event) =>
              setDraft({
                ...draft,
                price: event.target.value,
                // Free is given once, so a schedule would be left behind
                // pointing at nothing. It goes when the price goes to zero.
                every: typedFree(event.target.value) ? "" : draft.every,
                pwyw: typedFree(event.target.value) ? false : draft.pwyw,
              })
            }
            placeholder={currency === "jpy" ? "2700" : "27"}
            className="w-full rounded-r-2xl bg-transparent px-2 py-3 text-ink outline-none placeholder:text-ink-soft/50"
          />
        </div>
        <p className="mt-1 text-sm text-ink-soft">
          {typedFree(draft.price)
            ? "Free. A visitor types their email and we send them a link to it; their address joins your list once they use that link, marked with whether they agreed to hear from you."
            : `Your store charges in ${currency.toUpperCase()}: buyers pay exactly this, in ${currency.toUpperCase()}. The currency is chosen under Ways to pay. Type 0 to give it away for an email address instead.`}
        </p>
      </div>

      {free || draft.every ? null : (
        <div className="rounded-2xl border border-line bg-paper p-4">
          <label htmlFor={`product-pwyw-${id}`} className="flex min-h-[24px] cursor-pointer items-start gap-3">
            <input
              id={`product-pwyw-${id}`}
              type="checkbox"
              checked={draft.pwyw}
              disabled={Boolean(pwywBlocked) && !draft.pwyw}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  pwyw: event.target.checked,
                  suggested: draft.suggested || draft.price,
                })
              }
              className="mt-1 h-4 w-4 shrink-0 accent-[var(--violet)]"
            />
            <span>
              <span className="block font-semibold text-ink">Let buyers pay what they want</span>
              <span className="mt-0.5 block text-sm text-ink-soft">
                {pwywBlocked && !draft.pwyw
                  ? pwywBlocked
                  : "The price above becomes the lowest they can pay. They type the amount on Stripe's payment page."}
              </span>
            </span>
          </label>
          {draft.pwyw ? (
            <div className="mt-3 pl-7">
              <label htmlFor={`product-suggested-${id}`} className="field-label">
                Suggested price
              </label>
              <div className="card mt-2 flex max-w-[14rem] items-center pl-4 transition focus-within:border-violet-brand">
                <span className="whitespace-nowrap text-ink-soft">{prefix}</span>
                <input
                  id={`product-suggested-${id}`}
                  type="text"
                  inputMode={currency === "jpy" ? "numeric" : "decimal"}
                  value={draft.suggested}
                  onChange={(event) => setDraft({ ...draft, suggested: event.target.value })}
                  placeholder={currency === "jpy" ? "1500" : "15"}
                  className="w-full rounded-r-2xl bg-transparent px-2 py-3 text-ink outline-none placeholder:text-ink-soft/50"
                />
              </div>
              <p className="mt-2 text-sm text-ink-soft">
                {`What the amount box starts at. Buyers can pay up to ${formatMoney(priceBounds(currency).max, currency)}.`} Discount codes are not offered on it, and it
                cannot have several prices, a payment plan or a product offered at checkout: Stripe lets a buyer choose
                the amount of one item, paid once. A limited quantity, an offer after paying, sales tax and questions at
                checkout all work with it.
              </p>
            </div>
          ) : null}
        </div>
      )}

      {typedFree(draft.price) ? null : (
      <div>
        <label
          htmlFor={`product-every-${id}`}
          className="field-label"
        >
          How often it charges
        </label>
        <select
          id={`product-every-${id}`}
          name="every"
          value={draft.every}
          onChange={(event) =>
            setDraft({
              ...draft,
              every: event.target.value as "" | Interval,
              // A membership charges a set amount, so nobody chooses it.
              pwyw: event.target.value ? false : draft.pwyw,
            })
          }
          className="field mt-2"
        >
          <option value="">Once — a single sale</option>
          {INTERVALS.map((interval) => (
            <option key={interval} value={interval}>
              {`${intervalName(interval)} \u2014 charged once ${everyLabel(interval)}`}
            </option>
          ))}
        </select>
        <p className="mt-1 text-sm text-ink-soft">
          {draft.every
            ? `A membership. The member is charged once ${everyLabel(
                draft.every,
              )} on your own Stripe account until it is canceled. Members can cancel it themselves from your store's membership page, linked in their confirmation email and under the membership on your page, and you can cancel it in your Stripe dashboard. A file or course delivered here closes when the membership ends; access to a link that leads somewhere else is yours to take back.`
            : "Most things are sold once. Pick a schedule to make this a membership instead."}
        </p>
        {draft.every ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor={`product-trial-${id}`} className="field-label">
                Free trial, in days <span className="font-normal text-ink-soft">(optional)</span>
              </label>
              <input
                id={`product-trial-${id}`}
                type="number"
                inputMode="numeric"
                min={MIN_TRIAL_DAYS}
                max={MAX_TRIAL_DAYS}
                step={1}
                value={draft.trial}
                onChange={(event) => setDraft({ ...draft, trial: event.target.value })}
                placeholder="None"
                className="field mt-2"
              />
              <p className="mt-1 text-sm text-ink-soft">
                {`${MIN_TRIAL_DAYS} to ${MAX_TRIAL_DAYS}. The card is asked for at the start and nothing is charged until the trial ends.`}
              </p>
            </div>
            <div>
              <label htmlFor={`product-payments-${id}`} className="field-label">
                Ends after, in payments <span className="font-normal text-ink-soft">(optional)</span>
              </label>
              <input
                id={`product-payments-${id}`}
                type="number"
                inputMode="numeric"
                min={MIN_MEMBER_PAYMENTS}
                max={MAX_MEMBER_PAYMENTS}
                step={1}
                value={draft.payments}
                onChange={(event) => setDraft({ ...draft, payments: event.target.value })}
                placeholder="Until canceled"
                className="field mt-2"
              />
              <p className="mt-1 text-sm text-ink-soft">
                {`${MIN_MEMBER_PAYMENTS} to ${MAX_MEMBER_PAYMENTS}. After the last one it stops by itself; members can still cancel sooner.`}
              </p>
            </div>
            {/^\d+$/.test(draft.trial.trim()) || /^\d+$/.test(draft.payments.trim()) ? (
              <p className="rounded-xl bg-sand px-3 py-2 text-sm text-ink sm:col-span-2">
                {`Your page will say: ${membershipPrice(
                  {
                    interval: draft.every,
                    trialDays: Number(draft.trial.trim()) || 0,
                    payments: Number(draft.payments.trim()) || 0,
                  },
                  (() => {
                    const typed = readMoney(draft.price, currency);
                    return typed === null ? `${prefix} ${draft.price.trim() || "0"}` : formatMoney(typed, currency);
                  })(),
                )}.`}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
      )}

      {error ? (
        <p
          className="notice notice-error "
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          aria-busy={busy} disabled={busy}
          className="btn btn-primary"
        >
          {busy ? "Saving…" : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="btn btn-ghost"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

/**
 * The several prices one product may be sold at.
 *
 * Kept below the product rather than inside its form, because adding a price
 * is not editing the product: the title and the description stay as they are
 * while the creator works out what to charge. Each option carries its own
 * file or link, so the block that attaches one is the same block a product
 * without options uses.
 */
function OptionsBlock({
  product,
  fileBusyId,
  percent,
  fileError,
  onPick,
  onDetach,
  onLink,
  onUnlink,
}: {
  product: Product;
  fileBusyId: string | null;
  percent: number;
  fileError: { id: string; message: string } | null;
  onPick: (id: string, file: File) => void;
  onDetach: (id: string) => void;
  onLink: (id: string, url: string) => void;
  onUnlink: (id: string) => void;
}) {
  const router = useRouter();
  const currency = useStoreCurrency();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(payload: Record<string, unknown>, done: () => void, confirmation?: string) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/store/option", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        limit?: number;
      };
      if (!data.ok) {
        setError(
          data.error === "too_many"
            ? `A product carries up to ${data.limit ?? MAX_OPTIONS} prices.`
            : data.error === "label"
              ? "Give this price a name the buyer will read, like “5 weeks”."
              : data.error === "price"
                ? optionPrice(currency)
                : (OPTION_MESSAGES[data.error ?? ""] ?? MESSAGES.server_error),
        );
        return;
      }
      done();
      if (confirmation) toast(confirmation);
      router.refresh();
    } catch {
      setError(MESSAGES.server_error);
    } finally {
      setBusy(false);
    }
  }

  const form = (submitLabel: string, onSubmit: () => void, onCancel: () => void) => (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (!busy) onSubmit();
      }}
      className="mt-2 space-y-3 rounded-2xl border-2 border-violet-brand/30 bg-white p-4"
    >
      <div className="flex flex-wrap gap-3">
        <div className="min-w-[10rem] flex-1">
          <label
            htmlFor={`option-label-${product.id}`}
            className="field-label"
          >
            What this one is
          </label>
          <input
            id={`option-label-${product.id}`}
            type="text"
            required
            maxLength={MAX_OPTION_LABEL_LENGTH}
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="5 weeks"
            className="field mt-1"
          />
        </div>
        <div className="w-28">
          <label
            htmlFor={`option-price-${product.id}`}
            className="field-label"
          >
            {`Price, ${fieldPrefix(currency)}`}
          </label>
          <input
            id={`option-price-${product.id}`}
            type="text"
            inputMode={currency === "jpy" ? "numeric" : "decimal"}
            required
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            placeholder={currency === "jpy" ? "3900" : "39"}
            className="field mt-1"
          />
        </div>
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-2xl bg-danger-soft px-4 py-3 text-sm font-semibold text-ink"
        >
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          aria-busy={busy} disabled={busy}
          className="btn btn-primary btn-sm"
        >
          {busy ? "Saving…" : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="btn btn-secondary btn-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  );

  return (
    <div className="mt-3 rounded-2xl border-2 border-dashed border-ink/10 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-bold text-ink">
          {product.options.length === 0
            ? "One price, or several"
            : "What this is sold at"}
        </p>
        {product.options.length > 0 ? (
          <p className="text-sm text-ink-soft">
            {product.options.length} of {MAX_OPTIONS}
          </p>
        ) : null}
      </div>

      {product.options.length === 0 ? (
        <p className="mt-1 text-sm text-ink-soft">
          Right now this sells at the one price above. Add a second and the
          buyer picks — one week or five, personal or commercial — and each one
          hands over its own file.
        </p>
      ) : (
        <p className="mt-1 text-sm text-ink-soft">
          The buyer picks one of these. While they are here, the single price on
          the product above is not charged and not shown.
        </p>
      )}

      <ul className="mt-3 space-y-2">
        {product.options.map((option, index) => (
          <li key={option.id} className="rounded-2xl bg-sand p-3">
            {editingId === option.id ? (
              form(
                "Save",
                () =>
                  run(
                    { action: "edit", id: option.id, label, price },
                    () => setEditingId(null),
                    "Price saved.",
                  ),
                () => {
                  setEditingId(null);
                  setError(null);
                },
              )
            ) : (
              <>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-bold text-ink">{option.label}</p>
                  <p className="font-semibold tabular-nums text-ink">
                    {formatMoney(option.priceCents, currency)}
                  </p>
                </div>

                {!option.file && !option.link ? (
                  /*
                    Said here rather than discovered by a buyer. An option with
                    nothing behind it is left off the store page entirely, and
                    the creator is the one who can fix that.
                  */
                  <p className="mt-1 text-sm font-semibold text-danger">
                    Nothing to hand over yet, so this one is hidden from your
                    page.
                  </p>
                ) : null}

                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-bold">
                  <button
                    type="button"
                    onClick={() => {
                      setLabel(option.label);
                      setPrice(moneyField(option.priceCents, currency));
                      setError(null);
                      setAdding(false);
                      setEditingId(option.id);
                    }}
                    className="text-ink-soft underline underline-offset-4 transition hover:text-violet-deep"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={busy || index === 0}
                    onClick={() =>
                      run({ action: "move", id: option.id, direction: "up" }, () => {})
                    }
                    className="text-ink-soft underline underline-offset-4 transition hover:text-violet-deep disabled:no-underline disabled:opacity-40"
                  >
                    Move up
                  </button>
                  <button
                    type="button"
                    disabled={busy || index === product.options.length - 1}
                    onClick={() =>
                      run(
                        { action: "move", id: option.id, direction: "down" },
                        () => {},
                      )
                    }
                    className="text-ink-soft underline underline-offset-4 transition hover:text-violet-deep disabled:no-underline disabled:opacity-40"
                  >
                    Move down
                  </button>
                  {removingId === option.id ? null : (
                    <button
                      type="button"
                      onClick={() => {
                        setRemovingId(option.id);
                        setError(null);
                      }}
                      className="text-ink-soft underline underline-offset-4 transition hover:text-danger"
                    >
                      Remove
                    </button>
                  )}
                </div>

                <FileBlock
                  target={option}
                  busy={fileBusyId === option.id}
                  percent={percent}
                  error={
                    fileError && fileError.id === option.id
                      ? fileError.message
                      : null
                  }
                  onPick={(chosen) => onPick(option.id, chosen)}
                  onDetach={() => onDetach(option.id)}
                  onLink={(url) => onLink(option.id, url)}
                  onUnlink={() => onUnlink(option.id)}
                  membership={product.recurring !== null}
                />

                {removingId === option.id ? (
                  <div className="mt-2 rounded-2xl border-2 border-pink-brand/30 bg-white p-3">
                    <p className="text-sm text-ink-soft">
                      Remove <strong className="text-ink">{option.label}</strong>
                      {option.file
                        ? ". The file on it is deleted with it."
                        : ". Nothing else on the product changes."}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        aria-busy={busy} disabled={busy}
                        onClick={() =>
                          run(
                            { action: "remove", id: option.id },
                            () => setRemovingId(null),
                            "Price removed.",
                          )
                        }
                        className="btn btn-danger-solid btn-sm"
                      >
                        {busy ? "Removing…" : "Remove it"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setRemovingId(null)}
                        className="btn btn-secondary btn-sm"
                      >
                        Keep it
                      </button>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </li>
        ))}
      </ul>

      {adding
        ? form(
            "Add this price",
            () =>
              run(
                { action: "add", id: product.id, label, price },
                () => setAdding(false),
                "Price added.",
              ),
            () => {
              setAdding(false);
              setError(null);
            },
          )
        : product.options.length >= MAX_OPTIONS
          ? null
          : (
            <button
              type="button"
              onClick={() => {
                setLabel("");
                setPrice("");
                setError(null);
                setEditingId(null);
                setAdding(true);
              }}
              className="btn btn-secondary btn-sm mt-2"
            >
              {product.options.length === 0
                ? "Sell it at several prices"
                : "Add another price"}
            </button>
          )}

      {error && !adding && !editingId ? (
        <p
          role="alert"
          className="mt-2 rounded-2xl bg-danger-soft px-4 py-3 text-sm font-semibold text-ink"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * What something delivers: a product, or one price option of one.
 *
 * Both hold a file or a link the same way and under the same folder rule, so
 * they are edited by the same block rather than by two that drift apart.
 */
type Delivers = {
  id: string;
  file: ProductFile | null;
  link: string | null;
};

/** The file something delivers: what is there, and how to change it. */
function FileBlock({
  target,
  busy,
  percent,
  error,
  onPick,
  onDetach,
  onLink,
  onUnlink,
  membership = false,
}: {
  target: Delivers;
  busy: boolean;
  percent: number;
  error: string | null;
  onPick: (file: File) => void;
  onDetach: () => void;
  onLink: (url: string) => void;
  onUnlink: () => void;
  /** Sold as a membership: a file closes when it ends, a link cannot. */
  membership?: boolean;
}) {
  const studioHref = useStudioHref();
  const input = useRef<HTMLInputElement>(null);
  const [typing, setTyping] = useState(false);
  const [url, setUrl] = useState("");
  const file = target.file;
  const link = target.link;

  return (
    <div className="mt-3 rounded-2xl bg-white p-3">
      <input
        ref={input}
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        className="hidden"
        onChange={(event) => {
          const chosen = event.target.files?.[0];
          event.target.value = "";
          if (chosen) onPick(chosen);
        }}
      />

      {busy ? (
        <div>
          <p className="text-sm font-bold text-ink">Sending the file…</p>
          <div
            className="mt-2 h-2 w-full overflow-hidden rounded-full bg-sand"
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-brand to-sky-brand transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="mt-1 text-sm text-ink-soft">{percent}%</p>
        </div>
      ) : file ? (
        <>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <p className="text-sm font-bold text-ink">{file.name}</p>
            <p className="font-mono text-sm text-ink-soft">
              {readableSize(file.bytes)}
            </p>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-bold">
            <a
              href={studioHref(`/api/store/file/download?id=${encodeURIComponent(target.id)}`)}
              className="text-ink-soft underline underline-offset-4 transition hover:text-violet-deep"
            >
              Open it to check
            </a>
            <button
              type="button"
              onClick={() => input.current?.click()}
              className="text-ink-soft underline underline-offset-4 transition hover:text-violet-deep"
            >
              Replace it
            </button>
            <button
              type="button"
              onClick={onDetach}
              className="text-ink-soft underline underline-offset-4 transition hover:text-danger"
            >
              Take it off
            </button>
          </div>
          {membership ? (
            <p className="mt-2 text-xs text-ink-soft">
              Members download it only while their membership runs. When it ends, the download closes and they are shown a
              page to renew.
            </p>
          ) : null}
        </>
      ) : link ? (
        <>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <p className="text-sm font-bold text-ink">
              {`Delivered from ${linkHost(link)}`}
            </p>
          </div>
          <p className="mt-1 break-all font-mono text-xs text-ink-soft">
            {link}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-bold">
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-ink-soft underline underline-offset-4 transition hover:text-violet-deep"
            >
              Open it to check
            </a>
            <button
              type="button"
              onClick={() => {
                setUrl(link);
                setTyping(true);
              }}
              className="text-ink-soft underline underline-offset-4 transition hover:text-violet-deep"
            >
              Change it
            </button>
            <button
              type="button"
              onClick={onUnlink}
              className="text-ink-soft underline underline-offset-4 transition hover:text-danger"
            >
              Take it off
            </button>
          </div>
          {membership ? (
            <p className="notice notice-warn mt-2 text-sm">
              A link cannot be taken back when a membership ends: whoever has the address keeps it. To close access when
              members stop paying, upload the file here instead, or turn off sharing where the link points.
            </p>
          ) : null}
        </>
      ) : (
        <>
          <p className="text-sm font-bold text-ink">
            Nothing on this yet
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            {`Upload the file the buyer downloads, up to ${maxFileLabel()} \u2014 or point at where it already lives, if it is bigger than that or is not a file at all.`}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => input.current?.click()}
              className="btn btn-secondary btn-sm"
            >
              Choose the file
            </button>
            <button
              type="button"
              onClick={() => setTyping(true)}
              className="btn btn-secondary btn-sm"
            >
              Use a link instead
            </button>
          </div>
        </>
      )}

      {typing ? (
        <form
          className="mt-3"
          onSubmit={(event) => {
            event.preventDefault();
            onLink(url);
            setTyping(false);
          }}
        >
          <label
            htmlFor={`link-${target.id}`}
            className="field-label"
          >
            Where the buyer should be sent
          </label>
          <input
            id={`link-${target.id}`}
            type="url"
            value={url}
            autoFocus
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://"
            className="field mt-1"
          />
          <p className="mt-1 text-sm text-ink-soft">
            A Google Drive folder, a private video page, a Notion page — anything
            with an https address. Check that anyone with the link can open it.
            {membership
              ? " A link cannot be taken back when a membership ends: a file uploaded here can, and closes by itself when a member stops paying."
              : ""}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="submit"
              className="btn btn-primary btn-sm"
            >
              Save the link
            </button>
            <button
              type="button"
              onClick={() => setTyping(false)}
              className="btn btn-secondary btn-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {error ? (
        <p
          className="notice notice-error mt-2"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Above this many products, each opens on its own rather than all at once. */
const COLLAPSE_ABOVE = 3;
/** Above this many, the list gets a box to find one by name. */
const SEARCH_ABOVE = 6;

/** The few words that say what a closed row holds, so it need not be opened. */
function badges(product: Product): string[] {
  const out: string[] = [];
  if (product.hidden) out.push("Draft, not on your store");
  if (product.bundle) out.push(`Bundle of ${product.bundle.length}`);
  if (product.call) out.push("Call");
  if (product.course) out.push("Course");
  if (product.recurring) {
    out.push("Membership");
    if (product.recurring.trialDays) out.push(`${product.recurring.trialDays}-day trial`);
    if (product.recurring.payments) out.push(`${product.recurring.payments} ${intervalAdjective(product.recurring.interval)} payments`);
  }
  if (product.pwyw) out.push("Pay what you want");
  if (product.options.length) out.push(`${product.options.length} prices`);
  if (!isFree(product) && !product.call && !product.course && !product.bundle && !product.file && !product.link && !product.options.some((o) => o.file || o.link)) {
    out.push("Nothing to hand over yet");
  }
  if (product.image) out.push(product.display === "preview" ? "Preview" : product.display === "callout" ? "Callout" : "Button");
  if (product.fields.length) out.push(`${product.fields.length} ${product.fields.length === 1 ? "question" : "questions"}`);
  if (product.stock !== null) out.push(`Limited to ${product.stock.toLocaleString("en-US")}`);
  return out;
}

/** The list of what the store offers, and every way to change it. */
/** The studio's list at one page, found by one search, on the store this page is for. */
function pageHref(page: number, query: string, sid: string): string {
  const params = new URLSearchParams();
  if (sid) params.set("store", sid);
  if (query) params.set("q", query);
  if (page > 1) params.set("pp", String(page));
  const search = params.toString();
  return `/studio${search ? `?${search}` : ""}#products`;
}

/**
 * Finding one product in a long list, and moving through it a page at a
 * time. A plain form and plain links: the search runs on the server over
 * every product's name, so nothing depends on which page is open.
 */
function PagedSearch({ paging, total }: { paging: ProductPaging; total: number }) {
  const { query, matches, from, size } = paging;
  const upTo = Math.min(from + size, matches);
  const sid = useStudioStore();
  return (
    <div className="mt-5">
      <form action="/studio#products" method="get" role="search" className="flex flex-wrap items-center gap-3">
        <label htmlFor="product-find" className="sr-only">
          Find a product by its name
        </label>
        <StoreField />
        <input
          id="product-find"
          type="search"
          name="q"
          defaultValue={query}
          maxLength={80}
          placeholder="Find a product by its name"
          className="field field-search min-w-[12rem] flex-1"
        />
        <button type="submit" className="btn btn-secondary btn-sm">
          Find
        </button>
        {query ? (
          <a href={pageHref(1, "", sid)} className="text-sm font-bold text-ink-soft underline underline-offset-4 hover:text-violet-deep">
            Show all
          </a>
        ) : null}
      </form>
      <p className="mt-2 text-sm text-ink-soft" role="status">
        {query
          ? matches === 0
            ? `Nothing on your store has “${query}” in its name.`
            : `${matches.toLocaleString("en-US")} ${matches === 1 ? "has" : "have"} “${query}” in the name. Showing ${from + 1}–${upTo}. Moving one moves it in the whole list.`
          : `Showing ${from + 1}–${upTo} of ${total.toLocaleString("en-US")}, in the order your store shows them.`}
      </p>
      <Pager paging={paging} />
    </div>
  );
}

/** Previous and next page of the studio's list, when there is more than one. */
function Pager({ paging }: { paging: ProductPaging }) {
  const sid = useStudioStore();
  if (paging.pages <= 1) return null;
  const link =
    "inline-flex min-h-[44px] items-center gap-1 rounded-full border border-line bg-white px-4 text-sm font-bold text-ink transition hover:border-violet-brand focus-visible:outline-2 focus-visible:outline-violet-brand";
  const off = "inline-flex min-h-[44px] items-center gap-1 rounded-full px-4 text-sm font-bold text-ink-mute opacity-50";
  return (
    <nav aria-label="Pages of your products" className="mt-3 flex items-center justify-between gap-3">
      {paging.page > 1 ? (
        <a href={pageHref(paging.page - 1, paging.query, sid)} rel="prev" className={link}>
          <span aria-hidden="true">&larr;</span> Previous
        </a>
      ) : (
        <span className={off} aria-hidden="true">&larr; Previous</span>
      )}
      <p className="text-sm font-semibold text-ink-soft" aria-current="page">{`Page ${paging.page} of ${paging.pages}`}</p>
      {paging.page < paging.pages ? (
        <a href={pageHref(paging.page + 1, paging.query, sid)} rel="next" className={link}>
          Next <span aria-hidden="true">&rarr;</span>
        </a>
      ) : (
        <span className={off} aria-hidden="true">Next &rarr;</span>
      )}
    </nav>
  );
}

export function ProductEditor({
  products,
  total: totalGiven,
  positions,
  paging = null,
  choices,
  named = {},
  folder,
  imageFolder,
  handle,
  selling,
  testMode,
  email,
  currency = "usd",
  meetings = [],
}: {
  /** The products shown: every one, or one page of a long list. */
  products: Product[];
  /** How many products the store has in all. */
  total?: number;
  /** Where each product shown stands in the store's whole list, from 0. */
  positions?: Record<string, number>;
  paging?: ProductPaging | null;
  /** Every product another can offer in a box at checkout (lib/product-extras.ts). */
  choices?: BumpChoice[];
  /** The names of the products the ones shown offer at checkout now. */
  named?: Record<string, string>;
  folder: string;
  /** The store's own folder for product pictures (lib/store.ts imageFolder). */
  imageFolder: string;
  /** The store's address, for the link to each product's own page. */
  handle: string;
  /** The creator's sign-in address, which booking replies go to. */
  email: string;
  /** Whether this store can actually take a card right now. */
  selling: boolean;
  /** Whether the platform is pointed at Stripe's test mode. */
  testMode: boolean;
  /** What the store charges in: every price here is written in it. */
  currency?: Currency;
  /** The Google Calendar or Zoom accounts calls can make meetings on (lib/meet-connect.ts). */
  meetings?: MeetAccount[];
}) {
  const router = useRouter();
  const sid = useStudioStore();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileBusyId, setFileBusyId] = useState<string | null>(null);
  const [percent, setPercent] = useState(0);
  const [fileError, setFileError] = useState<{ id: string; message: string } | null>(
    null,
  );

  const total = totalGiven ?? products.length;
  const full = total >= MAX_PRODUCTS;
  const offerable = choices ?? bumpChoices(products);
  const at = (product: Product) => positions?.[product.id] ?? products.indexOf(product);
  // A short list is shown open, as it always was. A long one is shown as rows
  // that open one at a time, and a list longer than a page is shown a page
  // at a time (lib/catalog.ts, studioShelf), so two thousand products stay a
  // page and not a scroll through two thousand forms.
  const [openIds, setOpenIds] = useState<Set<string>>(
    () => new Set(total <= COLLAPSE_ABOVE ? products.map((product) => product.id) : []),
  );
  const [query, setQuery] = useState("");
  const [loadingAbout, setLoadingAbout] = useState(false);
  // Which opening of the form the description being read belongs to, and
  // whether it could not be read: then saving leaves the stored one alone.
  const aboutFor = useRef(0);
  const [aboutUnread, setAboutUnread] = useState(false);
  // A long list is searched on the server (paging); a short one right here.
  const shown = query.trim() && !paging
    ? products.filter((product) => product.title.toLowerCase().includes(query.trim().toLowerCase()))
    : products;

  function toggle(id: string, open?: boolean) {
    setOpenIds((current) => {
      const next = new Set(current);
      if (open ?? !next.has(id)) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  /** Tells the store which file a product delivers, once it is really there. */
  async function attach(payload: Record<string, unknown>): Promise<string | null> {
    try {
      const response = await fetch("/api/store/file/attach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (data.ok) return null;
      return MESSAGES[data.error ?? ""] ?? MESSAGES.server_error;
    } catch {
      return MESSAGES.server_error;
    }
  }

  /**
   * Sends one file straight from this browser to the private store.
   *
   * It never passes through our server, which is why a large file is possible
   * at all. The size and the kind are checked here so an impossible upload
   * fails in a second rather than after a long climb, and checked again by the
   * signature on the way in, because a check in a browser is a courtesy and
   * not a defence.
   */
  async function upload(id: string, chosen: File) {
    setFileError(null);
    if (chosen.size > MAX_FILE_BYTES) {
      setFileError({ id, message: MESSAGES.too_big });
      return;
    }

    setFileBusyId(id);
    setPercent(0);
    try {
      const pathname = fileFolder(folder, id) + safeFileName(chosen.name);
      const result = await uploadPresigned(pathname, chosen, {
        access: "private",
        handleUploadUrl: "/api/store/file",
        clientPayload: JSON.stringify({ productId: id }),
        // In parts once it is worth it, so a dropped connection costs one
        // part rather than the whole upload.
        multipart: chosen.size > MULTIPART_ABOVE_BYTES,
        onUploadProgress: (progress) => setPercent(progress.percentage),
      });

      const problem = await attach({
        id,
        pathname: result.pathname,
        name: chosen.name,
      });
      if (problem) {
        setFileError({ id, message: problem });
        return;
      }
      router.refresh();
    } catch (thrown) {
      const message =
        thrown instanceof Error && /content type|not allowed/i.test(thrown.message)
          ? MESSAGES.wrong_type
          : MESSAGES.server_error;
      setFileError({ id, message });
    } finally {
      setFileBusyId(null);
      setPercent(0);
    }
  }

  async function detach(id: string) {
    setFileError(null);
    setFileBusyId(id);
    const problem = await attach({ id, detach: true });
    setFileBusyId(null);
    if (problem) {
      setFileError({ id, message: problem });
      return;
    }
    router.refresh();
  }

  async function linkTo(id: string, url: string) {
    setFileError(null);
    setFileBusyId(id);
    const problem = await send({ action: "link", id, link: url }, currency);
    setFileBusyId(null);
    if (problem) {
      setFileError({ id, message: problem });
      return;
    }
    router.refresh();
  }

  async function unlink(id: string) {
    setFileError(null);
    setFileBusyId(id);
    const problem = await send({ action: "unlink", id }, currency);
    setFileBusyId(null);
    if (problem) {
      setFileError({ id, message: problem });
      return;
    }
    router.refresh();
  }

  async function run(payload: Record<string, unknown>, done: () => void, confirmation?: string) {
    setBusy(true);
    setError(null);
    const problem = await send(payload, currency);
    setBusy(false);
    if (problem) {
      setError(problem);
      return;
    }
    done();
    if (confirmation) toast(confirmation);
    router.refresh();
  }

  function startAdding() {
    aboutFor.current += 1;
    setLoadingAbout(false);
    setAboutUnread(false);
    setDraft(EMPTY);
    setError(null);
    setEditingId(null);
    setAdding(true);
  }

  async function startEditing(product: Product) {
    setDraft({
      title: product.title,
      summary: product.summary,
      price: moneyField(product.priceCents, currency),
      every: product.recurring ? product.recurring.interval : "",
      trial: product.recurring?.trialDays ? String(product.recurring.trialDays) : "",
      payments: product.recurring?.payments ? String(product.recurring.payments) : "",
      pwyw: product.pwyw !== null,
      suggested: product.pwyw ? moneyField(product.pwyw.suggestedCents, currency) : "",
      about: "",
    });
    setError(null);
    setAdding(false);
    setEditingId(product.id);
    toggle(product.id, true);
    const opening = ++aboutFor.current;
    setAboutUnread(false);
    setLoadingAbout(false);
    if (!product.about) return;
    // The long description lives in a record of its own; it is read when the
    // form opens, and the box waits for it so nothing is saved over it. An
    // answer that arrives after another product was opened is dropped.
    setLoadingAbout(true);
    let about: string | null = null;
    try {
      const response = await fetch(`/api/store/product?about=${encodeURIComponent(product.id)}`);
      const data = (await response.json().catch(() => ({}))) as { ok?: boolean; about?: string };
      if (data.ok && typeof data.about === "string") about = data.about;
    } catch {
      about = null;
    }
    if (aboutFor.current !== opening) return;
    setLoadingAbout(false);
    if (about !== null) {
      const read = about;
      setDraft((current) => ({ ...current, about: read }));
    } else {
      setAboutUnread(true);
      setError("Your description could not be read just now, so it is not shown. Anything else you change is saved and the description is kept as it is.");
    }
  }

  const quiet = "text-ink-soft underline underline-offset-4 transition hover:text-violet-deep disabled:no-underline disabled:opacity-40";

  return (
    <StoreCurrency value={currency}>
    <div className="card mt-8 p-6 sm:p-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="text-lg font-semibold tracking-[-0.02em] text-ink">
          What you are selling
        </p>
        <p className="text-sm text-ink-soft">
          {total === 1 ? "1 product" : `${total.toLocaleString("en-US")} products`}
        </p>
      </div>

      {total === 0 ? (
        <p className="mt-2 text-ink-soft">
          Your page is live and it is empty. Add the first thing and it shows up
          on it straight away.
        </p>
      ) : null}

      {paging ? (
        <PagedSearch paging={paging} total={total} />
      ) : null}
      {!paging && products.length > SEARCH_ABOVE ? (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <label htmlFor="product-search" className="sr-only">
            Find a product by its name
          </label>
          <input
            id="product-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a product by its name"
            className="field field-search min-w-[12rem] flex-1"
          />
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() =>
              setOpenIds(openIds.size > 0 ? new Set() : new Set(products.map((product) => product.id)))
            }
          >
            {openIds.size > 0 ? "Close all" : "Open all"}
          </button>
        </div>
      ) : null}
      {query.trim() && !paging ? (
        <p className="mt-2 text-sm text-ink-soft" role="status">
          {shown.length === 0
            ? "Nothing on your store has that in its name."
            : `${shown.length} of ${products.length} shown. Moving one moves it in the whole list.`}
        </p>
      ) : null}

      <ul className="mt-5 space-y-3">
        {shown.map((product) => {
          const index = at(product);
          const open = openIds.has(product.id) || editingId === product.id;
          const panel = `product-panel-${product.id}`;
          return (
          <li
            key={product.id}
            className="rounded-2xl border border-line bg-paper p-4"
          >
            {editingId === product.id ? (
              <ProductForm
                draft={draft}
                setDraft={setDraft}
                busy={busy}
                error={error}
                submitLabel="Save"
                product={product}
                loadingAbout={loadingAbout}
                onSubmit={() => {
                  if (loadingAbout) return;
                  const payload = payloadOf(draft);
                  if (aboutUnread && !draft.about) delete payload.about;
                  run(
                    { action: "edit", id: product.id, ...payload },
                    () => setEditingId(null),
                    "Product saved.",
                  );
                }}
                onCancel={() => {
                  setEditingId(null);
                  setError(null);
                }}
              />
            ) : (
              <>
                <div className="flex items-start gap-3">
                  {product.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imageUrl(product.image)}
                      alt=""
                      width={product.image.width}
                      height={product.image.height}
                      className="mt-0.5 h-11 w-11 shrink-0 rounded-lg object-cover ring-1 ring-line"
                    />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => toggle(product.id)}
                        aria-expanded={open}
                        aria-controls={panel}
                        className="group -m-1 flex min-h-[24px] min-w-0 items-baseline gap-2 rounded-lg p-1 text-left font-bold text-ink focus-visible:outline-2 focus-visible:outline-violet-brand"
                      >
                        <span
                          aria-hidden="true"
                          className={`inline-block text-ink-soft transition-transform motion-reduce:transition-none ${open ? "rotate-90" : ""}`}
                        >
                          ›
                        </span>
                        <span className="min-w-0 group-hover:underline group-hover:underline-offset-4">{product.title}</span>
                      </button>
                      <p className="font-semibold tabular-nums text-ink">
                        {isFree(product)
                          ? "Free"
                          : product.recurring
                            ? `${formatMoney(product.priceCents, currency)} ${everyLabel(product.recurring.interval)}`
                            : product.pwyw
                              ? `${formatMoney(product.priceCents, currency)}+`
                              : formatMoney(product.priceCents, currency)}
                      </p>
                    </div>
                    <p className="mt-1 flex flex-wrap gap-1.5 text-xs font-semibold text-ink-soft">
                      {badges(product).map((badge) => (
                        <span key={badge} className="rounded-full bg-sand px-2 py-0.5">
                          {badge}
                        </span>
                      ))}
                    </p>
                  </div>
                </div>

                {open && product.summary ? (
                  <p className="mt-2 text-sm text-ink-soft">
                    {product.summary}
                  </p>
                ) : null}

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-bold">
                  <button
                    type="button"
                    onClick={() => startEditing(product)}
                    className={quiet}
                  >
                    Edit
                  </button>
                  {product.hidden ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        run({ action: "visibility", id: product.id, hidden: false }, () => {}, "Published. It is on your store now.")
                      }
                      className="font-bold text-violet-deep underline underline-offset-4 transition hover:text-violet-ink disabled:opacity-40"
                    >
                      Publish it
                    </button>
                  ) : (
                    <>
                      <a href={`/@${handle}/p/${product.id}`} target="_blank" rel="noopener noreferrer" className={quiet}>
                        Its page
                      </a>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          run({ action: "visibility", id: product.id, hidden: true }, () => {}, "Taken off your store. It is kept here as a draft.")
                        }
                        className={quiet}
                      >
                        Unpublish
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    disabled={busy || index === 0}
                    onClick={() =>
                      run(
                        { action: "move", id: product.id, direction: "up" },
                        () => {},
                      )
                    }
                    className={quiet}
                  >
                    Move up
                  </button>
                  <button
                    type="button"
                    disabled={busy || index === total - 1}
                    onClick={() =>
                      run(
                        { action: "move", id: product.id, direction: "down" },
                        () => {},
                      )
                    }
                    className={quiet}
                  >
                    Move down
                  </button>
                  {total > 3 ? (
                    <>
                      <button
                        type="button"
                        disabled={busy || index === 0}
                        onClick={() => run({ action: "move", id: product.id, direction: "top" }, () => {}, "Moved to the top.")}
                        className={quiet}
                      >
                        To the top
                      </button>
                      <button
                        type="button"
                        disabled={busy || index === total - 1}
                        onClick={() => run({ action: "move", id: product.id, direction: "bottom" }, () => {}, "Moved to the end.")}
                        className={quiet}
                      >
                        To the end
                      </button>
                    </>
                  ) : null}
                  {removingId === product.id ? null : (
                    <button
                      type="button"
                      onClick={() => {
                        setRemovingId(product.id);
                        setError(null);
                      }}
                      className="text-ink-soft underline underline-offset-4 transition hover:text-danger"
                    >
                      Remove
                    </button>
                  )}
                </div>

                {removingId === product.id ? (
                  <div className="mt-3 rounded-2xl border-2 border-pink-brand/30 bg-white p-4">
                    <p className="text-sm text-ink-soft">
                      Remove{" "}
                      <strong className="text-ink">{product.title}</strong> from
                      your store. Its files, picture, description, page, reviews
                      and any course lessons are deleted with it and cannot be
                      brought back; sales already made stay in your Stripe account.
                      {product.hidden ? null : " To take it off your store but keep it, unpublish it instead."}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        aria-busy={busy} disabled={busy}
                        onClick={() =>
                          run(
                            { action: "remove", id: product.id },
                            () => setRemovingId(null),
                            "Product removed.",
                          )
                        }
                        className="btn btn-danger-solid btn-sm"
                      >
                        {busy ? "Removing…" : "Yes, remove it"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setRemovingId(null)}
                        className="btn btn-ghost btn-sm"
                      >
                        Keep it
                      </button>
                    </div>
                  </div>
                ) : null}

                {open ? (
                <div id={panel}>
                <ProductImageEditor product={product} folder={imageFolder} />

                {/*
                  With price options there is nothing to attach to the product
                  itself: each option delivers its own thing, and a file here
                  would be one nobody is ever sent. So the block moves inside
                  the options rather than sitting above them unused.
                */}
                {product.course || product.bundle ? null : <CallEditor product={product} email={email} meetings={meetings} />}
                {product.call || product.bundle ? null : <CourseToggle product={product} />}
                {product.call || product.course ? null : <BundleToggle product={product} />}

                {product.call || product.course || product.bundle ? null : (
                <>
                {product.options.length === 0 ? (
                  <FileBlock
                    target={product}
                    busy={fileBusyId === product.id}
                    percent={percent}
                    error={
                      fileError && fileError.id === product.id
                        ? fileError.message
                        : null
                    }
                    onPick={(chosen) => upload(product.id, chosen)}
                    onDetach={() => detach(product.id)}
                    onLink={(url) => linkTo(product.id, url)}
                    onUnlink={() => unlink(product.id)}
                    membership={product.recurring !== null}
                  />
                ) : null}

                {/* Several prices would put a price on something free, and a chosen price is chosen once. */}
                {(isFree(product) || product.pwyw) && product.options.length === 0 ? null : (
                <OptionsBlock
                  product={product}
                  fileBusyId={fileBusyId}
                  percent={percent}
                  fileError={fileError}
                  onPick={upload}
                  onDetach={detach}
                  onLink={linkTo}
                  onUnlink={unlink}
                />
                )}
                <PdfStampToggle product={product} />
                <LicenceKeyEditor product={product} handle={handle} />
                </>
                )}

                <CheckoutExtras product={product} choices={offerable} named={named} />
                <div className="mt-2">
                  <CheckoutFieldsEditor product={product} />
                </div>
                </div>
                ) : null}
              </>
            )}
          </li>
          );
        })}
      </ul>
      {paging ? <Pager paging={paging} /> : null}

      {adding ? (
        <div className="mt-5">
          <ProductForm
            draft={draft}
            setDraft={setDraft}
            busy={busy}
            error={error}
            submitLabel="Add it"
            onSubmit={() =>
              run(
                { action: "add", ...payloadOf(draft) },
                () => {
                  setAdding(false);
                  setDraft(EMPTY);
                  // A new product goes to the end of the list: on a long one,
                  // the page it lands on is opened so it can be seen.
                  if (paging) router.push(pageHref(Math.ceil((total + 1) / paging.size), "", sid));
                },
                "Product added.",
              )
            }
            onCancel={() => {
              setAdding(false);
              setError(null);
            }}
          />
        </div>
      ) : (
        <button
          type="button"
          disabled={full}
          onClick={startAdding}
          className="btn btn-primary mt-5"
        >
          Add something to sell
        </button>
      )}

      {full && !adding ? (
        <p className="mt-3 text-sm text-ink-soft">
          {`Your store is holding ${MAX_PRODUCTS.toLocaleString("en-US")} products, the most it can list. Remove one to add another.`}
        </p>
      ) : null}

      {error && !adding && editingId === null && removingId === null ? (
        <p
          className="notice notice-error mt-3"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {/*
        Three states, because there are three truths and the wrong one is a
        lie the moment the other becomes true. A line hard-coded to "nobody
        can pay you" goes stale the hour Stripe clears an account; a line
        hard-coded to "you can be paid" is worse, because somebody sets a
        price on it.
      */}
      <p className="mt-5 rounded-2xl bg-sand px-4 py-3 text-sm text-ink-soft">
        {!selling ? (
          <>
            <strong className="text-ink">Nobody can pay you yet.</strong> What
            you write here is on your page the moment you save it, with the
            price, and the page says plainly that it cannot take a payment.
          </>
        ) : testMode ? (
          <>
            <strong className="text-ink">
              Your page can take a card, in Stripe&apos;s test mode.
            </strong>{" "}
            What you write here is on your page the moment you save it, and the
            checkout on it is real — but it is running against Stripe in test
            mode, so no real money moves and no real card is charged.
          </>
        ) : (
          <>
            <strong className="text-ink">
              Your page can take a card for this.
            </strong>{" "}
            What you write here is on your page the moment you save it, and a
            buyer can pay for it straight away, on your own Stripe account.
            Nimbus takes no cut of the sale.
          </>
        )}{" "}
        Your file is kept private to your store, and it is never named or
        linked on the public page.
      </p>
    </div>
    </StoreCurrency>
  );
}
