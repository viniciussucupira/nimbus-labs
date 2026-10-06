# Marktmorgen

The code behind [marktmorgen.com](https://marktmorgen.com): a link-in-bio store where creators sell digital products, courses, memberships, communities and paid video calls, with payments going straight into their own Stripe account.

Built with Next.js (App Router), TypeScript and Tailwind CSS, and run on Vercel with Upstash Redis, Vercel Blob, Stripe Connect and Resend.

## Working on it

```bash
npm install
npm run dev     # http://localhost:3000
npm test        # every tests/*.test.ts, against an in-memory store
npm run lint
```

The tests need nothing but `npm install`: Redis is swapped for an in-memory stand-in (`lib/redis-memory.ts`) and every outside service is played by a stand-in inside the test.

This version of Next.js differs from older ones; see `AGENTS.md` before changing how routes, the proxy or caching work.

## Settings

All of them are environment variables set on the host. None has a value in this repository. A feature whose settings are missing is switched off, not broken: its pages and routes answer as if it were not there.

| For | Settings |
| --- | --- |
| Records | `KV_REST_API_URL`, `KV_REST_API_TOKEN` (or `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`), `NIMBUS_DATA_KEY` |
| Payments | `STRIPE_SECRET_KEY`, `STRIPE_DEMO_SECRET_KEY`; PayPal: `PAYPAL_ENV`, `PAYPAL_PARTNER_CLIENT_ID`, `PAYPAL_PARTNER_SECRET`, `PAYPAL_PARTNER_MERCHANT_ID`, `PAYPAL_BN_CODE` |
| Email we send | `RESEND_API_KEY` (sending only), `NIMBUS_FROM_EMAIL`, `RECOVERY_FROM_EMAIL`, `MARKETING_FROM_EMAIL`, `MARKETING_DAILY_CAP`, `SENDER_MONTHLY_QUOTA` (the emails a month on the sender's plan; 50,000 when unset — see `lib/mail.ts`) |
| Email written to us | `RESEND_WEBHOOK_SECRET`, `RESEND_INBOUND_API_KEY`, `SUPPORT_FORWARD_TO` (see `lib/inbound-mail.ts`) |
| Email we send, cheaper | `AWS_SES_ACCESS_KEY_ID`, `AWS_SES_SECRET_ACCESS_KEY`, `AWS_SES_REGION`, `AWS_SES_CONFIGURATION_SET`, `AWS_SES_TOPIC_ARN`: all five, or Amazon SES is not used. With them, email goes through Amazon whenever Amazon says the account may write to the public, and through Resend whenever it may not; nobody switches it by hand. The topic's HTTPS subscription points at `/api/mail/ses` (see `lib/ses.ts`, `lib/sns.ts`) |
| Bounces and spam reports | `RESEND_WEBHOOK_SECRET` alone. The same webhook at Resend (`/api/mail/inbound`) must also be sent the `email.bounced` and `email.complained` events; with them a dead address is taken off its store's list and a store with too many is paused by itself (see `lib/mail-health.ts`) |
| Video calls | Google: `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`; Zoom: `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`, `ZOOM_WEBHOOK_SECRET_TOKEN`, `ZOOM_LIVE` |
| Creators' own domains | `VERCEL_API_TOKEN`, `VERCEL_DOMAINS_PROJECT`, `VERCEL_DOMAINS_TEAM` |
| Drafts written for a creator | `ANTHROPIC_API_KEY`, `AI_MODEL` |
| Scheduled jobs | `CRON_SECRET` |

The settings ending in `_API_BASE` are for local checks only: each accepts nothing but an address on `127.0.0.1`, so a check can never reach a real service. `PASSKEY_LOCAL_ORIGIN` is for local development and is ignored in production.
