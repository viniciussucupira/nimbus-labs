"use client";

import { AiAssist, AiOn } from "@/components/ai-assist";
import { EMAIL_GOALS, type EmailGoal } from "@/lib/ai-rules";
import { PRO_MONTHLY_EMAILS, TRIAL_MONTHLY_EMAILS } from "@/lib/plan";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/toast";
import type { Flow } from "@/lib/flows";
import type { MailSettings } from "@/lib/store";
import { StoreField } from "@/components/studio-store-pin";
import { STUDIO_MESSAGES } from "@/lib/studio-messages";

const MESSAGES: Record<string, string> = {
  ...STUDIO_MESSAGES,
  from_name: "Type the name your emails are from.",
  address: "Type a postal address where you can be reached: a street address or a PO box. The law in the United States asks for one in every email like this.",
  confirm: "Check the box to confirm the people you are importing agreed to hear from you.",
  no_addresses: "No email addresses were found in what you pasted.",
  too_many: "That is more than one import takes. Split it into files of 5,000 addresses or fewer.",
  subject: "Write a subject line.",
  body: "Write the email itself.",
  when: "Pick a time between now and a year from now.",
  product: "That product is not in your store anymore.",
  empty: "Nobody on your list matches, so there is nobody to send it to yet.",
  allowance: "This goes to more people than this month's emails have left. Send it to a smaller group, or next month.",
  day: "Today's sending is full. A test can go out again tomorrow.",
  setup: "Save the name and postal address your emails carry first, at the top of this page.",
  plan: "Email to your list is part of Pro.",
  name: "Give the sequence a name.",
  trigger: "Choose what starts the sequence.",
  steps: "A sequence has between one and ten emails.",
  step: "Every email in the sequence needs a subject, some text, and a wait of up to a year.",
  unknown: "That is not there anymore. Reload the page.",
  send: "The email service did not take it just now. Nothing was sent; try again in a moment.",
  signed_out: "Your session ended. Log in again.",
  unavailable: "Email is not switched on yet, so nothing was sent.",
  full: "A store keeps 20 drafts at most. Send or delete one first.",
  list: "This store has no list yet, so there is nowhere to keep a draft.",
  role: "Your role on this store does not include this.",
  server_error: "Something went wrong on our side. Try again in a moment.",
};

type Answer = Record<string, unknown> & { ok?: boolean; error?: string };

async function call(payload: Record<string, unknown>): Promise<Answer> {
  try {
    const response = await fetch("/api/store/mail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return (await response.json().catch(() => ({ ok: false, error: "server_error" }))) as Answer;
  } catch {
    return { ok: false, error: "server_error" };
  }
}

const message = (a: Answer) => MESSAGES[a.error ?? ""] ?? MESSAGES.server_error;
const n = (x: number) => x.toLocaleString("en-US");

type BroadcastRow = {
  id: string;
  subject: string;
  status: string;
  sendAt: number;
  finishedAt: number;
  total: number;
  sent: number;
  note: string;
  productId: string | null;
};
type FlowRow = Flow & { stats: { started: number; sent: number } };
export type DraftRow = { id: string; subject: string; body: string; productId: string | null; by: string; savedAt: string };

const TIME: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" };

/**
 * A time in the reader's own time zone. The server does not know it, so the
 * first render says UTC and the browser swaps in local time straight after.
 */
const noSubscription = () => () => {};
function When({ seconds }: { seconds: number }) {
  const inBrowser = useSyncExternalStore(noSubscription, () => true, () => false);
  const date = new Date(seconds * 1000);
  return <>{inBrowser ? date.toLocaleString("en-US", TIME) : `${date.toLocaleString("en-US", { ...TIME, timeZone: "UTC" })} UTC`}</>;
}

function Feedback({ error, done }: { error: string | null; done: string | null }) {
  if (error) return <p className="notice notice-error mt-3" role="alert">{error}</p>;
  if (done) return <p className="notice notice-success mt-3" role="status">{done}</p>;
  return null;
}

/**
 * The studio's email page. What a role may do here is decided by the server
 * (lib/team-roles.ts); these switches only leave out what it may not, so an
 * Editor sees a composer that keeps drafts, and the owner or an Admin sends
 * them.
 */
export function EmailStudio(props: {
  email: string;
  name: string;
  mail: MailSettings | null;
  counts: { total: number; agreed: number; left: number; mailable: number };
  used: number;
  allowance: number;
  trial: boolean;
  products: { id: string; title: string }[];
  broadcasts: BroadcastRow[];
  flows: FlowRow[];
  drafts: DraftRow[];
  canSend: boolean;
  canSettings: boolean;
  canExport: boolean;
  /** Each product's own address, for an email about it. */
  links?: Record<string, string>;
  /** Whether the writing help is on, and what is left of the month (lib/ai.ts). */
  ai?: { on: boolean; left: number };
}) {
  const ready = props.mail !== null;
  // The draft open in the composer; a new key starts the composer afresh.
  const [open, setOpen] = useState<DraftRow | null>(null);
  return (
    <div className="mt-8 grid items-start gap-x-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <div className="min-w-0">
        {ready ? (
          <>
            <AiOn value={props.ai ?? { on: false, left: 0 }}>
              <Compose
                key={open ? `${open.id}-${open.savedAt}` : "new"}
                email={props.email}
                products={props.products}
                links={props.links ?? {}}
                counts={props.counts}
                canSend={props.canSend}
                draft={open}
                onDone={() => setOpen(null)}
              />
            </AiOn>
            <Drafts drafts={props.drafts} products={props.products} open={open} onOpen={setOpen} />
            <History broadcasts={props.broadcasts} products={props.products} canSend={props.canSend} />
            {props.canSend ? <Flows flows={props.flows} products={props.products} /> : null}
          </>
        ) : props.canSettings ? (
          <div className="card p-6 sm:p-8">
            <p className="text-lg font-semibold tracking-[-0.02em] text-ink">First, how your emails are signed</p>
            <p className="mt-2 text-ink-soft">One minute, once. Then you can write.</p>
            <Settings name={props.name} mail={props.mail} />
          </div>
        ) : (
          <div className="card p-6 sm:p-8">
            <p className="text-lg font-semibold tracking-[-0.02em] text-ink">Not set up yet</p>
            <p className="mt-2 text-ink-soft">
              The store&apos;s owner or an Admin first saves the name and postal address its emails carry. Then you can write here.
            </p>
          </div>
        )}
      </div>
      <div className="min-w-0">
        <div className="card mt-8 p-6 sm:p-8 lg:mt-0">
          <p className="text-lg font-semibold tracking-[-0.02em] text-ink">This month</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">{`${n(props.used)} of ${n(props.allowance)}`}</p>
          <p className="mt-1 text-sm text-ink-soft">
            {props.trial
              ? `emails sent. During the free trial a month holds ${TRIAL_MONTHLY_EMAILS.toLocaleString("en-US")}; the full ${PRO_MONTHLY_EMAILS.toLocaleString("en-US")} opens with your first payment.`
              : "emails sent, one-off and sequences together. The count starts again on the first of the month."}
          </p>
        </div>
        <ListCard counts={props.counts} canExport={props.canExport} canImport={props.canSend} />
        {ready && props.canSettings ? (
          <div className="card mt-8 p-6 sm:p-8">
            <p className="text-lg font-semibold tracking-[-0.02em] text-ink">How your emails are signed</p>
            <Settings name={props.name} mail={props.mail} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Settings({ name, mail }: { name: string; mail: MailSettings | null }) {
  const router = useRouter();
  const [fromName, setFromName] = useState(mail?.fromName ?? name);
  const [address, setAddress] = useState(mail?.address ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="mt-4 space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        const a = await call({ action: "settings", fromName, address });
        setBusy(false);
        if (a.ok) {
          toast("Email settings saved.");
          router.refresh();
        } else setError(message(a));
      }}
    >
      <label className="block">
        <span className="field-label">Your emails are from</span>
        <input className="field mt-2" maxLength={60} value={fromName} onChange={(e) => setFromName(e.target.value)} />
      </label>
      <label className="block">
        <span className="field-label">Postal address at the bottom of each email</span>
        <input className="field mt-2" maxLength={200} placeholder="Street, city, ZIP or postal code, country — or a PO box" value={address} onChange={(e) => setAddress(e.target.value)} />
      </label>
      <p className="text-sm text-ink-soft">
        Replies go to the email address the store&apos;s owner logs in with. The postal address is required by the CAN-SPAM Act for emails
        like these; a PO box or a mail service address counts.
      </p>
      <button type="submit" aria-busy={busy} disabled={busy} className="btn btn-secondary">Save</button>
      <Feedback error={error} done={null} />
    </form>
  );
}

function ListCard({
  counts,
  canExport,
  canImport,
}: {
  counts: { total: number; agreed: number; left: number; mailable: number };
  canExport: boolean;
  canImport: boolean;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  return (
    <div className="card mt-8 p-6 sm:p-8">
      <p className="text-lg font-semibold tracking-[-0.02em] text-ink">Your list</p>
      <p className="mt-2 text-ink-soft">
        {`${n(counts.mailable)} ${counts.mailable === 1 ? "person" : "people"} you can write to. ${n(counts.left)} left through the unsubscribe link, and ${n(counts.total - counts.agreed)} gave their address for one thing only and are never written to.`}
      </p>
      {canExport ? (
        <form action="/api/store/leads" method="get" className="mt-4">
          <StoreField />
          <input type="hidden" name="who" value="agreed" />
          <button type="submit" className="btn btn-secondary btn-sm">Download the people you can write to</button>
        </form>
      ) : null}
      {canImport ? (
      <details className="mt-5">
        <summary className="cursor-pointer text-sm font-bold text-ink underline underline-offset-2">Import addresses</summary>
        <form
          className="mt-3 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            setDone(null);
            const a = await call({ action: "import", text, confirm });
            setBusy(false);
            if (a.ok) {
              setDone(`${n(Number(a.added))} added. ${n(Number(a.already))} were already on your list or had left it, and stay as they were.${Number(a.skipped) ? ` ${n(Number(a.skipped))} did not look like email addresses.` : ""}`);
              setText("");
              setConfirm(false);
              router.refresh();
            } else setError(message(a));
          }}
        >
          <label htmlFor="import-text" className="field-label">Paste addresses, or a CSV file&apos;s contents</label>
          <textarea id="import-text" rows={6} className="field" value={text} onChange={(e) => setText(e.target.value)} />
          <label className="block text-sm">
            <span className="text-ink-soft">Or choose a file</span>
            <input
              type="file"
              accept=".csv,.txt,text/csv,text/plain"
              className="mt-1 block w-full text-sm"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) setText(await file.text());
              }}
            />
          </label>
          <label className="flex items-start gap-2 text-sm text-ink">
            <input type="checkbox" className="mt-1" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />
            <span>These people agreed to get emails from me. None of them came from a bought or borrowed list.</span>
          </label>
          <p className="text-sm text-ink-soft">
            Up to 5,000 at a time. Anyone who ever unsubscribed from you here stays unsubscribed, whatever the file says.
          </p>
          <button type="submit" disabled={busy || !text.trim()} className="btn btn-secondary btn-sm">Import</button>
        </form>
      </details>
      ) : null}
      <Feedback error={error} done={done} />
    </div>
  );
}

function Compose(props: {
  email: string;
  products: { id: string; title: string }[];
  links: Record<string, string>;
  counts: { mailable: number };
  canSend: boolean;
  /** A draft opened into the composer, or null for a new email. */
  draft: DraftRow | null;
  onDone: () => void;
}) {
  const router = useRouter();
  const [subject, setSubject] = useState(props.draft?.subject ?? "");
  const [body, setBody] = useState(props.draft?.body ?? "");
  const [productId, setProductId] = useState(props.draft?.productId ?? "");
  const [notProductId, setNotProductId] = useState("");
  const [draftId, setDraftId] = useState(props.draft?.id ?? "");
  const [later, setLater] = useState(false);
  const [at, setAt] = useState("");
  const [reach, setReach] = useState<number>(props.counts.mailable);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // What the writing help is asked to write, and about which product.
  const [goal, setGoal] = useState<EmailGoal>("announce");
  const [about, setAbout] = useState("");

  useEffect(() => {
    let live = true;
    call({ action: "count", productId, notProductId }).then((a) => {
      if (live && a.ok) setReach(Number(a.count) || 0);
    });
    return () => {
      live = false;
    };
  }, [productId, notProductId]);

  async function send(payload: Record<string, unknown>, success: string) {
    setBusy(true);
    setError(null);
    const a = await call(payload);
    setBusy(false);
    setConfirming(false);
    if (!a.ok) {
      setError(message(a));
      return false;
    }
    toast(success);
    return true;
  }

  async function keep() {
    setBusy(true);
    setError(null);
    const a = await call({ action: "draft-save", id: draftId || undefined, subject, body, productId });
    setBusy(false);
    if (!a.ok) {
      setError(message(a));
      return;
    }
    const saved = a.draft as DraftRow | undefined;
    if (saved) setDraftId(saved.id);
    toast("Draft saved.");
    router.refresh();
  }

  return (
    <section className="card p-6 sm:p-8" aria-labelledby="compose-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="compose-title" className="text-lg font-semibold tracking-[-0.02em] text-ink">
          {draftId ? "Draft" : "New email"}
        </h2>
        {draftId ? (
          <button type="button" className="text-sm font-bold text-ink-soft underline underline-offset-4" onClick={props.onDone}>
            Start a new one instead
          </button>
        ) : null}
      </div>
      <div className="mt-4 space-y-4">
        <AiAssist<{ subject: string; body: string }>
          title="Write a draft with AI"
          hint="Pick what the email is for, and say in a few words what you want it to say. The subject and the email below are filled in for you to read and change."
          placeholder="The recipe pack is out: 40 weeknight dinners, $27, and the first 10 pages are free to read on the page."
          extra={
            <div className="grid gap-3">
              <label className="block">
                <span className="field-label">It is to</span>
                <select className="field mt-2" value={goal} onChange={(e) => setGoal(e.target.value as EmailGoal)}>
                  {EMAIL_GOALS.map((g) => (
                    <option key={g.id} value={g.id}>{g.label}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="field-label">About</span>
                <select className="field mt-2" value={about} onChange={(e) => setAbout(e.target.value)}>
                  <option value="">No product in particular</option>
                  {props.products.map((p) => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
              </label>
            </div>
          }
          payload={() => ({
            kind: "email",
            goal,
            product: props.products.find((p) => p.id === about)?.title ?? "",
            link: about ? props.links[about] ?? "" : "",
          })}
          onResult={(value) => {
            setSubject(value.subject);
            setBody(value.body);
          }}
          done="The subject and the email below are filled in. Read them, change anything, then save or send."
        />
        <label className="block">
          <span className="field-label">Subject</span>
          <input className="field mt-2" maxLength={150} value={subject} onChange={(e) => setSubject(e.target.value)} />
        </label>
        <label className="block">
          <span className="field-label">Email</span>
          <textarea className="field mt-2 min-h-56" rows={12} maxLength={20000} value={body} onChange={(e) => setBody(e.target.value)} />
        </label>
        <p className="text-sm text-ink-soft">
          Blank lines make paragraphs, lines starting with &quot;- &quot; make a list, and web addresses become links. Why they are getting it, the unsubscribe link and your postal address are added at the bottom.
        </p>
        <label className="block">
          <span className="field-label">Send to</span>
          <select className="field mt-2" value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">Everyone you can write to</option>
            {props.products.map((p) => (
              <option key={p.id} value={p.id}>{`Only those who got ${p.title}`}</option>
            ))}
          </select>
        </label>
        {/*
          And who to leave out.

          The letter that sells is the one to the people who took the free
          thing and have not bought the paid one, and until this box existed
          there was no way to address it: you could write to everybody, or to
          the buyers of one product, and not to the difference between them.
          It reads what every contact has carried from the start — what they
          asked for or bought — so nothing new is recorded about anyone.
        */}
        <label className="block">
          <span className="field-label">Leave out</span>
          <select className="field mt-2" value={notProductId} onChange={(e) => setNotProductId(e.target.value)}>
            <option value="">Nobody</option>
            {props.products
              .filter((p) => p.id !== productId)
              .map((p) => (
                <option key={p.id} value={p.id}>{`Anyone who already got ${p.title}`}</option>
              ))}
          </select>
          <span className="field-hint mt-1 block">
            {notProductId
              ? "They will not get this one. Use it to write to the people who have not bought yet."
              : "Everyone chosen above gets it."}
          </span>
        </label>
        <p className="text-sm font-semibold text-ink" role="status">{`${n(reach)} ${reach === 1 ? "person" : "people"}`}</p>
        {props.canSend ? (
        <fieldset>
          <legend className="field-label">When</legend>
          <div className="mt-2 flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="radio" name="when" checked={!later} onChange={() => setLater(false)} /> Now
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="when" checked={later} onChange={() => setLater(true)} /> At a time I choose
            </label>
          </div>
          {later ? (
            <label className="mt-3 block">
              <span className="sr-only">Date and time, in your own time zone</span>
              <input type="datetime-local" className="field" value={at} onChange={(e) => setAt(e.target.value)} />
            </label>
          ) : null}
        </fieldset>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            aria-busy={busy} disabled={busy}
            className="btn btn-secondary"
            onClick={() => send({ action: "test", subject, body }, `Test sent to ${props.email}.`)}
          >
            Send me a test
          </button>
          <button
            type="button"
            aria-busy={busy}
            disabled={busy || !subject.trim() || !body.trim()}
            className="btn btn-secondary"
            onClick={() => void keep()}
          >
            {draftId ? "Save the draft" : "Save as a draft"}
          </button>
          {!props.canSend ? null : confirming ? (
            <>
              <button
                type="button"
                aria-busy={busy} disabled={busy}
                className="btn btn-primary"
                onClick={async () => {
                  const sendAt = later && at ? new Date(at).getTime() : undefined;
                  const ok = await send(
                    { action: "broadcast", subject, body, productId, notProductId, sendAt, draftId: draftId || undefined },
                    later ? "Your email is scheduled." : "Your email is on its way.",
                  );
                  if (ok) {
                    setSubject("");
                    setBody("");
                    setDraftId("");
                    props.onDone();
                    router.refresh();
                  }
                }}
              >
                {later ? `Yes, schedule it for ${n(reach)}` : `Yes, send it to ${n(reach)}`}
              </button>
              <button type="button" className="text-sm font-bold text-ink-soft underline underline-offset-4" onClick={() => setConfirming(false)}>
                Not yet
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={busy || !subject.trim() || !body.trim() || reach === 0 || (later && !at)}
              className="btn btn-primary"
              onClick={() => setConfirming(true)}
            >
              {later ? "Schedule" : "Send"}
            </button>
          )}
        </div>
        {props.canSend ? null : (
          <p className="text-sm text-ink-soft">
            Sending to the list is for the store&apos;s owner and Admins. Save it as a draft and they can read it, send it or
            schedule it from this page.
          </p>
        )}
        <Feedback error={error} done={null} />
      </div>
    </section>
  );
}

/** The store's drafts: open one into the composer, or throw it away. */
function Drafts({
  drafts,
  products,
  open,
  onOpen,
}: {
  drafts: DraftRow[];
  products: { id: string; title: string }[];
  open: DraftRow | null;
  onOpen: (draft: DraftRow | null) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  if (!drafts.length) return null;
  return (
    <section className="card mt-8 p-6 sm:p-8" aria-labelledby="drafts-title">
      <h2 id="drafts-title" className="text-lg font-semibold tracking-[-0.02em] text-ink">Drafts</h2>
      <ul className="mt-4 divide-y divide-line">
        {drafts.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
            <span className="min-w-0">
              <span className="block break-words font-semibold text-ink">{d.subject}</span>
              <span className="block text-sm text-ink-soft">
                {`${d.productId ? `To those who got ${products.find((p) => p.id === d.productId)?.title ?? "a product"}` : "To everyone you can write to"} · saved by ${d.by || "someone"}, `}
                <When seconds={Math.floor(new Date(d.savedAt).getTime() / 1000)} />
              </span>
            </span>
            <span className="flex items-center gap-4">
              <button
                type="button"
                className="inline-flex min-h-11 -my-2.5 items-center text-sm font-bold text-violet-deep underline underline-offset-4"
                aria-current={open?.id === d.id ? "true" : undefined}
                onClick={() => {
                  onOpen(d);
                  document.getElementById("compose-title")?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                {open?.id === d.id ? "Open above" : "Open"}
              </button>
              <button
                type="button"
                disabled={busy !== null}
                aria-busy={busy === d.id}
                className="inline-flex min-h-11 -my-2.5 items-center text-sm font-bold text-ink-soft underline underline-offset-4 hover:text-danger"
                onClick={async () => {
                  if (!window.confirm("Delete this draft?")) return;
                  setBusy(d.id);
                  const a = await call({ action: "draft-remove", id: d.id });
                  setBusy(null);
                  if (a.ok) {
                    toast("Draft deleted.");
                    if (open?.id === d.id) onOpen(null);
                    router.refresh();
                  }
                }}
              >
                Delete
              </button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

const STATUS: Record<string, string> = {
  scheduled: "Scheduled",
  sending: "Going out",
  sent: "Sent",
  waiting: "Waiting",
  cancelled: "Canceled",
  failed: "Stopped",
};

function History({
  broadcasts,
  products,
  canSend,
}: {
  broadcasts: BroadcastRow[];
  products: { id: string; title: string }[];
  canSend: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (!broadcasts.length) return null;
  return (
    <section className="card mt-8 p-6 sm:p-8" aria-labelledby="history-title">
      <h2 id="history-title" className="text-lg font-semibold tracking-[-0.02em] text-ink">Sent and scheduled</h2>
      <ul className="mt-4 divide-y divide-line">
        {broadcasts.map((b) => (
          <li key={b.id} className="py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="min-w-0 break-words font-semibold text-ink">{b.subject}</p>
              <span className="tag">{STATUS[b.status] ?? b.status}</span>
            </div>
            <p className="mt-1 text-sm text-ink-soft">
              {b.status === "scheduled" ? (
                <>
                  {"Goes out "}
                  <When seconds={b.sendAt} />
                  {` to ${n(b.total)}${b.productId ? ` who got ${products.find((p) => p.id === b.productId)?.title ?? "a product"}` : ""}`}
                </>
              ) : (
                <>
                  {`${n(b.sent)} of ${n(b.total)} sent`}
                  {b.finishedAt ? (
                    <>
                      {", "}
                      <When seconds={b.finishedAt} />
                    </>
                  ) : null}
                </>
              )}
            </p>
            {b.note ? <p className="mt-1 text-sm text-ink-soft">{b.note}</p> : null}
            {b.status === "scheduled" && canSend ? (
              <button
                type="button"
                aria-busy={busy} disabled={busy}
                className="mt-2 text-sm font-bold text-ink-soft underline underline-offset-4 hover:text-danger"
                onClick={async () => {
                  setBusy(true);
                  const a = await call({ action: "cancel", id: b.id });
                  setBusy(false);
                  if (a.ok) toast("Scheduled email canceled.");
                  router.refresh();
                }}
              >
                Cancel it
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

type StepDraft = { id?: string; wait: string; unit: "hours" | "days"; subject: string; body: string };
type FlowDraft = { id?: string; name: string; trigger: "joined" | "product"; productId: string; active: boolean; steps: StepDraft[] };

function toDraft(flow: FlowRow | null, products: { id: string }[]): FlowDraft {
  if (!flow) {
    return {
      name: "Welcome",
      trigger: "joined",
      productId: products[0]?.id ?? "",
      active: true,
      steps: [{ wait: "0", unit: "hours", subject: "", body: "" }],
    };
  }
  return {
    id: flow.id,
    name: flow.name,
    trigger: flow.trigger,
    productId: flow.productId ?? products[0]?.id ?? "",
    active: flow.active,
    steps: flow.steps.map((s) =>
      s.delayHours % 24 === 0 && s.delayHours > 0
        ? { id: s.id, wait: String(s.delayHours / 24), unit: "days", subject: s.subject, body: s.body }
        : { id: s.id, wait: String(s.delayHours), unit: "hours", subject: s.subject, body: s.body },
    ),
  };
}

function Flows({ flows, products }: { flows: FlowRow[]; products: { id: string; title: string }[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<FlowDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const triggerWords = (f: FlowRow) =>
    f.trigger === "joined"
      ? "Starts when someone joins your list"
      : `Starts when someone who agreed to hear from you gets ${products.find((p) => p.id === f.productId)?.title ?? "a product"}`;

  async function save() {
    if (!draft) return;
    setBusy(true);
    setError(null);
    const a = await call({
      action: "flow",
      flow: {
        id: draft.id,
        name: draft.name,
        trigger: draft.trigger,
        productId: draft.trigger === "product" ? draft.productId : null,
        active: draft.active,
        steps: draft.steps.map((s) => ({
          id: s.id,
          delayHours: (Number(s.wait) || 0) * (s.unit === "days" ? 24 : 1),
          subject: s.subject,
          body: s.body,
        })),
      },
    });
    setBusy(false);
    if (!a.ok) {
      setError(message(a));
      return;
    }
    setDraft(null);
    toast("Sequence saved.");
    router.refresh();
  }

  const setStep = (i: number, change: Partial<StepDraft>) =>
    draft && setDraft({ ...draft, steps: draft.steps.map((s, j) => (j === i ? { ...s, ...change } : s)) });

  return (
    <section className="card mt-8 p-6 sm:p-8" aria-labelledby="flows-title">
      <h2 id="flows-title" className="text-lg font-semibold tracking-[-0.02em] text-ink">Sequences</h2>
      <p className="mt-2 text-ink-soft">
        Emails that go out by themselves: a welcome when someone joins, a few tips in the days after they buy. Each person
        goes through a sequence once, and stops the moment they unsubscribe.
      </p>
      {flows.length ? (
        <ul className="mt-4 space-y-3">
          {flows.map((f) => (
            <li key={f.id} className="rounded-[var(--r-sm)] border border-line bg-white p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="min-w-0 break-words font-semibold text-ink">{f.name}</p>
                <span className="tag">{f.active ? "On" : "Paused"}</span>
              </div>
              <p className="mt-1 text-sm text-ink-soft">{`${triggerWords(f)} · ${f.steps.length} ${f.steps.length === 1 ? "email" : "emails"}`}</p>
              <p className="mt-1 text-sm text-ink-soft">{`${n(f.stats.started)} started · ${n(f.stats.sent)} emails sent`}</p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm font-bold">
                <button type="button" className="text-ink-soft underline underline-offset-4 hover:text-violet-deep" onClick={() => setDraft(toDraft(f, products))}>
                  Edit
                </button>
                <button
                  type="button"
                  aria-busy={busy} disabled={busy}
                  className="text-ink-soft underline underline-offset-4 hover:text-danger"
                  onClick={async () => {
                    setBusy(true);
                    const a = await call({ action: "flow-remove", id: f.id });
                    setBusy(false);
                    if (a.ok) toast("Sequence removed.");
                    router.refresh();
                  }}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {draft ? (
        <form
          className="mt-5 space-y-4 rounded-[var(--r-sm)] border border-line bg-white p-4"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <label className="block">
            <span className="field-label">Name, for you</span>
            <input className="field mt-2" maxLength={80} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </label>
          <label className="block">
            <span className="field-label">Starts when</span>
            <select
              className="field mt-2"
              value={draft.trigger}
              onChange={(e) => setDraft({ ...draft, trigger: e.target.value === "product" ? "product" : "joined" })}
            >
              <option value="joined">Someone joins your list</option>
              {products.length ? <option value="product">Someone who agreed to hear from you gets a product</option> : null}
            </select>
          </label>
          {draft.trigger === "product" ? (
            <label className="block">
              <span className="field-label">Which product</span>
              <select className="field mt-2" value={draft.productId} onChange={(e) => setDraft({ ...draft, productId: e.target.value })}>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </label>
          ) : null}
          <ol className="space-y-4">
            {draft.steps.map((s, i) => (
              <li key={i} className="rounded-[var(--r-sm)] bg-sand p-4">
                <p className="text-sm font-bold text-ink">{`Email ${i + 1}`}</p>
                <div className="mt-2 flex flex-wrap items-end gap-2">
                  <label className="block">
                    <span className="text-sm text-ink-soft">{i === 0 ? "Wait after it starts" : "Wait after the one before"}</span>
                    <input
                      className="field mt-1 w-24"
                      inputMode="numeric"
                      value={s.wait}
                      onChange={(e) => setStep(i, { wait: e.target.value.replace(/[^0-9]/g, "").slice(0, 4) })}
                    />
                  </label>
                  <label className="block">
                    <span className="sr-only">Hours or days</span>
                    <select className="field w-28" value={s.unit} onChange={(e) => setStep(i, { unit: e.target.value === "days" ? "days" : "hours" })}>
                      <option value="hours">hours</option>
                      <option value="days">days</option>
                    </select>
                  </label>
                </div>
                <label className="mt-3 block">
                  <span className="text-sm text-ink-soft">Subject</span>
                  <input className="field mt-1" maxLength={150} value={s.subject} onChange={(e) => setStep(i, { subject: e.target.value })} />
                </label>
                <label className="mt-3 block">
                  <span className="text-sm text-ink-soft">Email</span>
                  <textarea className="field mt-1" rows={6} maxLength={20000} value={s.body} onChange={(e) => setStep(i, { body: e.target.value })} />
                </label>
                {draft.steps.length > 1 ? (
                  <button
                    type="button"
                    className="mt-2 text-sm font-bold text-ink-soft underline underline-offset-4 hover:text-danger"
                    onClick={() => setDraft({ ...draft, steps: draft.steps.filter((_, j) => j !== i) })}
                  >
                    Remove this email
                  </button>
                ) : null}
              </li>
            ))}
          </ol>
          {draft.steps.length < 10 ? (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setDraft({ ...draft, steps: [...draft.steps, { wait: "2", unit: "days", subject: "", body: "" }] })}
            >
              Add an email
            </button>
          ) : null}
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />
            <span>On. Switched off, nobody new starts it, and those already in it get none of its emails that are still to come.</span>
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" aria-busy={busy} disabled={busy} className="btn btn-primary">Save the sequence</button>
            <button type="button" className="text-sm font-bold text-ink-soft underline underline-offset-4" onClick={() => setDraft(null)}>
              Close
            </button>
          </div>
          <Feedback error={error} done={null} />
        </form>
      ) : flows.length < 10 ? (
        <button type="button" className="btn btn-secondary mt-5" onClick={() => setDraft(toDraft(null, products))}>
          New sequence
        </button>
      ) : null}
    </section>
  );
}
