import type { NextRequest } from "next/server";
import { setHasDiscounts, storeForEmail } from "@/lib/store";
import { MIN_PRICE_CENTS, MAX_PRICE_CENTS, priceToCents } from "@/lib/store";
import { canSell } from "@/lib/store-checkout";
import {
  type Off,
  codeProblem,
  createCode,
  listCodes,
  readCode,
  stopCode,
} from "@/lib/discount";
import { guardStoreWrite, text } from "@/lib/store-request";

const ACTIONS = new Set(["list", "add", "stop"]);

/**
 * The creator's discount codes, which live on their own Stripe account.
 *
 * Every answer here is read from Stripe rather than from anything we keep, so
 * the redemption counts are the real ones and a code the creator switched off
 * in their own dashboard shows as off here too. The only thing written on our
 * side is the one bit the buyer's checkout needs: whether to show a box at all.
 */
export async function POST(request: NextRequest) {
  const guarded = await guardStoreWrite(request);
  if (!guarded.ok) return guarded.response;

  const { email, body } = guarded;
  const action = text(body.action, 10);
  if (!ACTIONS.has(action)) {
    return Response.json({ ok: false, error: "invalid" }, { status: 400 });
  }

  try {
    const store = await storeForEmail(email);
    if (!store) {
      return Response.json({ ok: false, error: "none" }, { status: 400 });
    }
    // A code discounts a charge, and a store that cannot charge has nothing to
    // discount. Said here rather than letting Stripe refuse it later.
    if (!store.stripeAccountId || !canSell(store)) {
      return Response.json({ ok: false, error: "not_selling" }, { status: 400 });
    }
    const account = store.stripeAccountId;

    if (action === "add") {
      const code = readCode(text(body.code, 40));
      const problem = codeProblem(code);
      if (problem) {
        return Response.json(
          { ok: false, error: "code", reason: problem },
          { status: 400 },
        );
      }

      let off: Off;
      if (text(body.kind, 10) === "amount") {
        const cents = priceToCents(text(body.amount, 20));
        if (
          cents === null ||
          cents < MIN_PRICE_CENTS ||
          cents > MAX_PRICE_CENTS
        ) {
          return Response.json(
            { ok: false, error: "code", reason: "amount" },
            { status: 400 },
          );
        }
        off = { kind: "amount", cents };
      } else {
        const percent = Number(text(body.percent, 10));
        if (!Number.isInteger(percent) || percent < 1 || percent > 100) {
          return Response.json(
            { ok: false, error: "code", reason: "percent" },
            { status: 400 },
          );
        }
        off = { kind: "percent", percent };
      }

      const rawUses = text(body.uses, 10);
      let maxRedemptions: number | null = null;
      if (rawUses) {
        const uses = Number(rawUses);
        if (!Number.isInteger(uses) || uses < 1) {
          return Response.json(
            { ok: false, error: "code", reason: "uses" },
            { status: 400 },
          );
        }
        maxRedemptions = uses;
      }

      const made = await createCode(account, code, off, maxRedemptions);
      if (!made.ok) {
        return Response.json(
          { ok: false, error: made.reason },
          { status: made.reason === "taken" ? 409 : 502 },
        );
      }
      await setHasDiscounts(email, true);
    } else if (action === "stop") {
      const id = text(body.id, 80);
      if (!id) {
        return Response.json({ ok: false, error: "invalid" }, { status: 400 });
      }
      if (!(await stopCode(account, id))) {
        return Response.json({ ok: false, error: "stripe" }, { status: 502 });
      }
    }

    // Listed last on every path, so the answer the creator gets back is what
    // Stripe says now rather than what we believe we just did.
    const list = await listCodes(account);
    if (list.state !== "ok") {
      return Response.json({ ok: false, error: "stripe" }, { status: 502 });
    }
    await setHasDiscounts(
      email,
      list.codes.some((entry) => entry.active),
    );

    return Response.json({ ok: true, codes: list.codes });
  } catch (error) {
    console.error("changing a discount code failed", error);
    return Response.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
