/**
 * Session packages and membership tiers, run against Stripe itself.
 *
 * In Stripe's test mode, on the demo's sandbox account (lib/demo-store.ts):
 * no real money, and nothing on any creator's account. Every request is
 * built by the very functions the features use (callCheckoutBody,
 * sessionCouponBody, packageCheckoutBody, tierPriceBody, previewBody,
 * switchBody), so what passes here is what the site sends.
 *
 *   tiers        a member moves up, down, and from monthly to yearly: the
 *                amount the member page would show equals what Stripe charges;
 *                a declined card changes nothing and is voided; the tier the
 *                doors read follows the switch
 *   package-open a paid package checkout and a free session checkout are made;
 *                the free one is opened in a browser and completed
 *   package-check the free session reads as settled with nothing charged, and
 *                its coupon cannot be used twice
 */
import { onDemoAccount } from "@/lib/demo-store";
import { callCheckoutBody, NO_COST_VERSION } from "@/lib/calls";
import { packageCheckoutBody, sessionCouponBody } from "@/lib/call-packages";
import { previewBody, switchBody, tierPriceBody } from "@/lib/tier-switch";
import { currentMeta, dueNow, productOfSub } from "@/lib/tier-rules";
import { isSettled } from "@/lib/instant-pay";
import type { Listing, Product, Store } from "@/lib/store";

export type Check = { check: string; ok: boolean; detail: string };

type Answer = { status: number; data: Record<string, unknown> };
const str = (v: unknown) => (typeof v === "string" ? v : "");
const num = (v: unknown) => (typeof v === "number" ? v : NaN);
const err = (a: Answer) => str((a.data.error as { message?: unknown } | undefined)?.message);

function tier(id: string, title: string, cents: number, interval: "month" | "year"): Listing {
  return { id, title, priceCents: cents, recurring: { interval, trialDays: 0, payments: 0 } } as unknown as Listing;
}

/** A store as the builders read it: the signed-in store, in dollars, so amounts are comparable. */
function asUsd(store: Store): Store {
  return { ...store, currency: "usd" } as Store;
}

export async function verifyTiers(store: Store): Promise<Check[]> {
  const out: Check[] = [];
  const s = asUsd(store);
  const note = (check: string, ok: boolean, detail: string) => out.push({ check, ok, detail });
  const A = tier("verify-basic", "Verify Basic", 1500, "month");
  const B = tier("verify-plus", "Verify Plus", 3500, "month");
  const C = tier("verify-yearly", "Verify Yearly", 15000, "year");
  const made: string[] = [];
  try {
    const prices: Record<string, string> = {};
    for (const t of [A, B, C]) {
      const p = await onDemoAccount("POST", "/prices", tierPriceBody(s, t));
      if (p.status !== 200) return [...out, { check: `price for ${t.title}`, ok: false, detail: err(p) }];
      prices[t.id] = str(p.data.id);
    }
    note("tier prices accepted, each naming its product", true, Object.values(prices).join(", "));

    const subscribe = async (email: string) => {
      const customer = await onDemoAccount(
        "POST",
        "/customers",
        new URLSearchParams({ email, payment_method: "pm_card_visa", "invoice_settings[default_payment_method]": "pm_card_visa" }),
      );
      const sub = await onDemoAccount(
        "POST",
        "/subscriptions",
        new URLSearchParams({ customer: str(customer.data.id), "items[0][price]": prices[A.id], "metadata[store]": s.handle, "metadata[product]": A.id }),
      );
      if (sub.status === 200) made.push(str(sub.data.id));
      const items = (sub.data.items as { data?: { id?: string }[] } | undefined)?.data ?? [];
      return { customer: str(customer.data.id), sub: str(sub.data.id), item: str(items[0]?.id), status: str(sub.data.status), error: err(customer) || err(sub) };
    };

    const move = async (label: string, m: { customer: string; sub: string; item: string }, to: Listing) => {
      const at = Math.floor(Date.now() / 1000);
      const preview = await onDemoAccount("POST", "/invoices/create_preview", previewBody(m.customer, m.sub, m.item, prices[to.id], at));
      if (preview.status !== 200) return note(`${label}: preview`, false, err(preview));
      const shown = dueNow(preview.data as Parameters<typeof dueNow>[0], at);
      const updated = await onDemoAccount("POST", `/subscriptions/${m.sub}`, switchBody(m.item, prices[to.id], at));
      if (updated.status !== 200) return note(`${label}: switch`, false, err(updated));
      const inv = (updated.data.latest_invoice ?? {}) as Record<string, unknown>;
      const charged = num(inv.total);
      note(
        `${label}: the amount the member page shows is what Stripe charges`,
        shown === charged && !updated.data.pending_update,
        `shown ${shown}, Stripe's invoice ${charged} (${str(inv.status)}), paid ${num(inv.amount_paid)}; whole next invoice in the preview was ${num(preview.data.total)}`,
      );
      const after = await onDemoAccount("GET", `/subscriptions/${m.sub}`);
      const now = productOfSub(after.data);
      const meta = currentMeta({ store: s.handle, product: A.id }, { mode: "subscription", subscription: after.data });
      note(`${label}: every door now reads the new tier`, now === to.id && meta.product === to.id, `subscription reads ${now}; a checkout bought as ${A.id} now hands over ${meta.product}`);
    };

    const m = await subscribe("verify+tiers@example.com");
    if (!m.sub) return [...out, { check: "test member subscribes", ok: false, detail: m.error }];
    note("test member subscribes to the basic tier", m.status === "active", `status ${m.status}`);
    await move("up, monthly $15 to $35", m, B);
    await move("down, monthly $35 to $15", m, A);
    await move("monthly $15 to yearly $150", m, C);

    // A card that fails when charged: the switch must change nothing and owe nothing.
    const d = await subscribe("verify+declined@example.com");
    if (!d.sub) return [...out, { check: "second test member subscribes", ok: false, detail: d.error }];
    const failing = await onDemoAccount("POST", "/payment_methods/pm_card_chargeCustomerFail/attach", new URLSearchParams({ customer: d.customer }));
    await onDemoAccount("POST", `/customers/${d.customer}`, new URLSearchParams({ "invoice_settings[default_payment_method]": str(failing.data.id) }));
    const at = Math.floor(Date.now() / 1000);
    const refused = await onDemoAccount("POST", `/subscriptions/${d.sub}`, switchBody(d.item, prices[B.id], at));
    const pending = Boolean(refused.data.pending_update);
    const inv = (refused.data.latest_invoice ?? {}) as Record<string, unknown>;
    let voided = "";
    if (pending && str(inv.id)) voided = str((await onDemoAccount("POST", `/invoices/${str(inv.id)}/void`, new URLSearchParams())).data.status);
    const still = await onDemoAccount("GET", `/subscriptions/${d.sub}`);
    note(
      "a declined card changes nothing, and its invoice is voided",
      pending && voided === "void" && productOfSub(still.data) === A.id,
      `answer ${refused.status}${err(refused) ? ` (${err(refused)})` : ""}, pending update ${pending}, invoice ${voided || str(inv.status)}, still on ${productOfSub(still.data)}`,
    );
  } finally {
    for (const id of made) await onDemoAccount("DELETE", `/subscriptions/${id}`).catch(() => null);
  }
  return out;
}

function sessionProduct(): Product {
  return { id: "verify-call", title: "Verification call", summary: "", priceCents: 12000, fields: [] } as unknown as Product;
}

export async function openPackageSession(store: Store, origin: string): Promise<Check[] & { url?: string; session?: string; coupon?: string }> {
  const s = asUsd(store);
  const out = [] as Check[] & { url?: string; session?: string; coupon?: string };
  const pkgListing = { id: "verify-call", title: "Verification call" } as unknown as Listing;
  const bought = await onDemoAccount("POST", "/checkout/sessions", packageCheckoutBody(s, pkgListing, { sessions: 5, priceCents: 50000, days: 90 }, origin));
  out.push({ check: "the package's own checkout is accepted", ok: bought.status === 200, detail: bought.status === 200 ? `${str(bought.data.id)}, $${num(bought.data.amount_total) / 100}` : err(bought) });

  const coupon = await onDemoAccount("POST", "/coupons", sessionCouponBody("cs_test_verification"));
  if (coupon.status !== 200) return Object.assign(out, [{ check: "the session's coupon", ok: false, detail: err(coupon) }]);
  const start = Date.now() + 3 * 86_400_000;
  const body = callCheckoutBody({
    store: s,
    product: sessionProduct(),
    start,
    end: start + 3_600_000,
    buyerTz: "America/New_York",
    origin,
    via: null,
    fromPackage: { id: "cs_test_verification", coupon: str(coupon.data.id), email: "verify+package@example.com", back: `${origin}/@${s.handle}` },
  });
  const free = await onDemoAccount("POST", "/checkout/sessions", body, NO_COST_VERSION);
  out.push({
    check: "a session from a package: a checkout with nothing to pay is accepted",
    ok: free.status === 200 && num(free.data.amount_total) === 0,
    detail: free.status === 200 ? `${str(free.data.id)}, total ${num(free.data.amount_total)}` : err(free),
  });
  out.url = str(free.data.url);
  out.session = str(free.data.id);
  out.coupon = str(coupon.data.id);
  return out;
}

export async function checkPackageSession(store: Store, origin: string, session: string, coupon: string): Promise<Check[]> {
  const out: Check[] = [];
  const got = await onDemoAccount("GET", `/checkout/sessions/${encodeURIComponent(session)}`);
  out.push({
    check: "once completed, the free session reads as settled, with nothing charged",
    ok: isSettled(got.data) && num(got.data.amount_total) === 0,
    detail: `status ${str(got.data.status)}, payment ${str(got.data.payment_status)}, total ${num(got.data.amount_total)}, payment made ${got.data.payment_intent ? "yes" : "none"}`,
  });
  const c = await onDemoAccount("GET", `/coupons/${encodeURIComponent(coupon)}`);
  out.push({ check: "its coupon was used once", ok: num(c.data.times_redeemed) === 1 && c.data.valid === false, detail: `times redeemed ${num(c.data.times_redeemed)}, still valid ${String(c.data.valid)}` });
  // The same coupon on a second checkout: it must not make another session free.
  const start = Date.now() + 4 * 86_400_000;
  const again = await onDemoAccount(
    "POST",
    "/checkout/sessions",
    callCheckoutBody({ store: asUsd(store), product: sessionProduct(), start, end: start + 3_600_000, buyerTz: "UTC", origin, via: null, fromPackage: { id: "cs_test_verification", coupon, email: "verify+package@example.com", back: origin } }),
    NO_COST_VERSION,
  );
  out.push({ check: "the coupon cannot make a second session free", ok: again.status !== 200, detail: again.status === 200 ? `accepted: ${str(again.data.id)}` : err(again) });
  return out;
}
