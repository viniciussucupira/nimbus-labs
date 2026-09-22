/**
 * The one place that sends email.
 *
 * Everything that needs to reach an inbox goes through here, so there is a
 * single answer to "is sending switched on?" and a single place to change if
 * the provider ever changes.
 */

// Local tests may point this at a mock server on 127.0.0.1; nothing else is
// accepted, so a test can never reach the real sender.
const BASE = /^http:\/\/127\.0\.0\.1:\d+$/.test(process.env.RESEND_API_BASE ?? "")
  ? `${process.env.RESEND_API_BASE}`
  : "https://api.resend.com";
const API = `${BASE}/emails`;

export const NIMBUS_FROM =
  process.env.NIMBUS_FROM_EMAIL?.trim() || "Nimbus Labs <onboarding@resend.dev>";

export const STORE_FROM =
  process.env.RECOVERY_FROM_EMAIL?.trim() ||
  "Harbor Kitchen <onboarding@resend.dev>";

function getKey(): string | null {
  const key = process.env.RESEND_API_KEY?.trim();
  return key ? key : null;
}

export function isSenderConfigured(): boolean {
  return getKey() !== null;
}

export async function sendEmail(message: {
  from: string;
  to: string;
  subject: string;
  text: string;
  /** Where replies go, when that is not the sender. */
  replyTo?: string;
  /** Files to attach, their content in base64, as Resend's API takes them. */
  attachments?: { filename: string; content: string }[];
}): Promise<boolean> {
  const key = getKey();
  if (!key) return false;

  const payload = JSON.stringify({
    from: message.from,
    to: [message.to],
    subject: message.subject,
    text: message.text,
    ...(message.attachments?.length ? { attachments: message.attachments } : {}),
    ...(message.replyTo ? { reply_to: message.replyTo } : {}),
  });
  // A sign-in link or a receipt must not be lost because the sender was busy
  // with a creator's newsletter a second earlier: asked to slow down, it
  // waits a moment and tries again.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(API, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: payload,
        cache: "no-store",
      });
      if (response.ok) return true;
      if (response.status === 429 && attempt < 2) {
        await pause(1_000 + attempt * 1_000);
        continue;
      }
      console.error("email rejected", response.status);
      return false;
    } catch (error) {
      console.error("email failed", error);
      return false;
    }
  }
  return false;
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type BatchMessage = {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
  headers?: Record<string, string>;
};

/**
 * Sends up to a hundred emails in one request. The key makes a retry of the
 * same batch a no-op at the provider, so nobody gets a message twice.
 *
 * "retry" means nothing was sent and the same batch may be tried again later;
 * "refused" means the provider will not send it as it is.
 */
export async function sendBatch(
  messages: BatchMessage[],
  idempotencyKey: string,
): Promise<"sent" | "retry" | "refused"> {
  const key = getKey();
  if (!key) return "retry";
  if (messages.length === 0) return "sent";
  try {
    const response = await fetch(`${BASE}/emails/batch`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey.slice(0, 256),
      },
      body: JSON.stringify(
        messages.slice(0, 100).map((m) => ({
          from: m.from,
          to: [m.to],
          subject: m.subject,
          text: m.text,
          html: m.html,
          ...(m.replyTo ? { reply_to: m.replyTo } : {}),
          ...(m.headers ? { headers: m.headers } : {}),
        })),
      ),
      cache: "no-store",
    });
    if (response.ok) return "sent";
    console.error("batch rejected", response.status);
    return response.status === 429 || response.status >= 500 ? "retry" : "refused";
  } catch (error) {
    console.error("batch failed", error);
    return "retry";
  }
}
