/**
 * The one place that sends email.
 *
 * Everything that needs to reach an inbox goes through here, so there is a
 * single answer to "is sending switched on?" and a single place to change if
 * the provider ever changes.
 */

// Local tests may point this at a mock server on 127.0.0.1; nothing else is
// accepted, so a test can never reach the real sender.
const API = /^http:\/\/127\.0\.0\.1:\d+$/.test(process.env.RESEND_API_BASE ?? "")
  ? `${process.env.RESEND_API_BASE}/emails`
  : "https://api.resend.com/emails";

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

  try {
    const response = await fetch(API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: message.from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        ...(message.attachments?.length ? { attachments: message.attachments } : {}),
        ...(message.replyTo ? { reply_to: message.replyTo } : {}),
      }),
      cache: "no-store",
    });
    if (!response.ok) {
      console.error("email rejected", response.status);
      return false;
    }
    return true;
  } catch (error) {
    console.error("email failed", error);
    return false;
  }
}
