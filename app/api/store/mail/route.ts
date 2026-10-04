import { type NextRequest, after } from "next/server";
import {
  MAX_MAIL_ADDRESS,
  MAX_MAIL_NAME,
  ensureListId,
  setMailSettings,
  storeForEmail,
  storeForHandle,
} from "@/lib/store";
import { guardStoreWrite, text } from "@/lib/store-request";
import { MAX_IMPORT, audience, importContacts, listCounts, readAddresses } from "@/lib/contacts";
import { MAX_MAIL_BODY, MAX_SUBJECT, fromLine, monthlyAllowance, render, reserve, release } from "@/lib/mail";
import { sendBatch } from "@/lib/email";
import { advanceBroadcast, cancelBroadcast, createBroadcast } from "@/lib/broadcasts";
import { removeFlow, saveFlow } from "@/lib/flows";
import { removeDraft, saveDraft } from "@/lib/mail-drafts";
import type { Permission } from "@/lib/team-roles";

export const maxDuration = 60;

/**
 * Which part of a role each action needs (lib/team-roles.ts): writing and
 * trying out an email is drafting; anything that reaches the list is sending.
 */
const MAIL_PERMISSIONS: Record<string, Permission> = {
  settings: "settings",
  import: "send",
  count: "draft",
  test: "draft",
  "draft-save": "draft",
  "draft-remove": "draft",
  broadcast: "send",
  cancel: "send",
  flow: "send",
  "flow-remove": "send",
};

/**
 * Everything the studio does with email:
 *
 *   { action: "settings", fromName, address }
 *   { action: "import", text, confirm: true }
 *   { action: "count", productId, notProductId }
 *   { action: "test", subject, body }
 *   { action: "draft-save", id?, subject, body, productId }  /  { action: "draft-remove", id }
 *   { action: "broadcast", subject, body, productId, notProductId, sendAt, draftId? }
 *   { action: "cancel", id }
 *   { action: "flow", flow: {...} }  /  { action: "flow-remove", id }
 *
 * Only the store settled by lib/studio-route.ts is ever touched: nothing in
 * the body names a list or a store. What each action needs of a role is in
 * MAIL_PERMISSIONS above.
 */
export async function POST(request: NextRequest) {
  const guarded = await guardStoreWrite(
    request,
    (body) => {
      const action = text(body.action, 20);
      return Object.hasOwn(MAIL_PERMISSIONS, action) ? MAIL_PERMISSIONS[action] : null;
    },
    400_000,
  );
  if (!guarded.ok) return guarded.response;
  const { email, ref, body } = guarded;
  const action = text(body.action, 20);
  const fail = (error: string, status = 400) => Response.json({ ok: false, error }, { status });

  try {
    let store = await storeForEmail(ref);
    if (!store) return fail("none");

    if (action === "settings") {
      const fromName = text(body.fromName, 200).replace(/\s+/g, " ").trim().slice(0, MAX_MAIL_NAME);
      const address = text(body.address, 1000).replace(/\s+/g, " ").trim().slice(0, MAX_MAIL_ADDRESS);
      if (!fromName) return fail("from_name");
      if (address.length < 10) return fail("address");
      await setMailSettings(ref, { fromName, address });
      return Response.json({ ok: true });
    }

    // Everything below writes to people, so it is Pro only.
    if (monthlyAllowance(store) === 0) return fail("plan", 403);

    if (action === "import") {
      if (body.confirm !== true) return fail("confirm");
      const { emails, skipped } = readAddresses(text(body.text, 390_000));
      if (emails.length === 0) return fail("no_addresses");
      if (emails.length > MAX_IMPORT) return fail("too_many");
      store = (await ensureListId(ref)) ?? store;
      const { added, already, full } = await importContacts(store.listId as string, emails);
      return Response.json({ ok: true, added, already, skipped, full, counts: await listCounts(store.listId) });
    }

    if (action === "count") {
      if (!store.listId) return Response.json({ ok: true, count: 0 });
      const productId = text(body.productId, 40) || undefined;
      const notProductId = text(body.notProductId, 40) || undefined;
      return Response.json({ ok: true, count: (await audience(store.listId, productId, notProductId)).length });
    }

    if (action === "test") {
      if (!store.mail) return fail("setup");
      const subject = text(body.subject, 400).replace(/\s+/g, " ").trim().slice(0, MAX_SUBJECT);
      const content = text(body.body, MAX_MAIL_BODY * 2).trim().slice(0, MAX_MAIL_BODY);
      if (!subject) return fail("subject");
      if (!content) return fail("body");
      const reserved = await reserve(store, 1);
      if (reserved !== "ok") return fail(reserved === "month" ? "allowance" : "day");
      const r = render(store, `[Test] ${subject}`, content, null);
      const outcome = await sendBatch(
        // To whoever pressed it: the owner, or the person on their team who is
        // writing the draft.
        [{ from: fromLine(store), to: email, subject: r.subject, text: r.text, html: r.html, replyTo: store.email }],
        `test:${store.handle}:${Date.now()}`,
      );
      if (outcome !== "sent") {
        await release(store, 1);
        return fail("send", 502);
      }
      return Response.json({ ok: true, to: email });
    }

    if (action === "draft-save") {
      store = (await ensureListId(ref)) ?? store;
      const result = await saveDraft(store, email, {
        id: text(body.id, 40) || undefined,
        subject: text(body.subject, 400),
        body: text(body.body, MAX_MAIL_BODY * 2),
        productId: text(body.productId, 40),
      });
      return result.ok ? Response.json({ ok: true, draft: result.draft }) : fail(result.reason);
    }

    if (action === "draft-remove") {
      const done = await removeDraft(store, text(body.id, 40));
      return done ? Response.json({ ok: true }) : fail("unknown", 404);
    }

    if (action === "broadcast") {
      const created = await createBroadcast(store, {
        subject: text(body.subject, 400),
        body: text(body.body, MAX_MAIL_BODY * 2),
        productId: text(body.productId, 40),
        notProductId: text(body.notProductId, 40),
        sendAt: typeof body.sendAt === "number" ? body.sendAt : undefined,
      });
      if (!created.ok) return fail(created.reason);
      const id = created.broadcast.id;
      // A draft that has now been sent or scheduled is done with.
      const fromDraft = text(body.draftId, 40);
      if (fromDraft) await removeDraft(store, fromDraft);
      if (created.broadcast.sendAt <= Math.floor(Date.now() / 1000) + 60) {
        // Starts as soon as the studio has its answer; the scheduled job
        // finishes anything this run does not.
        after(() => advanceBroadcast(id, storeForHandle, Date.now() + 50_000).then(() => undefined));
      }
      return Response.json({ ok: true, broadcast: created.broadcast });
    }

    if (action === "cancel") {
      const done = await cancelBroadcast(store, text(body.id, 40));
      return done ? Response.json({ ok: true }) : fail("unknown", 404);
    }

    if (action === "flow") {
      const raw = body.flow && typeof body.flow === "object" ? (body.flow as Record<string, unknown>) : {};
      const result = await saveFlow(store, raw);
      return result.ok ? Response.json({ ok: true, flows: result.flows }) : fail(result.reason);
    }

    if (action === "flow-remove") {
      const result = await removeFlow(store, text(body.id, 40));
      return result.ok ? Response.json({ ok: true, flows: result.flows }) : fail(result.reason, 404);
    }

    return fail("invalid");
  } catch (error) {
    console.error("an email action failed", error);
    return fail("server_error", 500);
  }
}
