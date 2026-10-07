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
| The address creators' email comes from | `MARKETING_FROM_DOMAIN`, not a secret: a subdomain of the site's (`mail.marktmorgen.com`) that each sender has proved, with its own DKIM record and the two records of the address bounces come back to (`send.<domain>`, MX and SPF). With it every creator's email to people (their list, a launch, a review request, a checkout left open, a community announcement) is from the store's own address on it, `<handle>@<domain>`, with Reply-To the creator's own; login links, receipts and files stay on `NIMBUS_FROM_EMAIL`. Set it only after the domain shows as verified at Resend, or list email is refused. At Amazon the same domain is the stack's `CreatorsDomain` (`infra/amazon-ses.yml`). Without the setting everything is sent from one address as before (see `lib/mail-from.ts`). The domains also need a DMARC record (`_dmarc`, TXT, `v=DMARC1; p=none;` at the least), which Gmail, Yahoo and Outlook ask of anyone who sends in volume; nothing in the code can add or check it |
| Email written to us | `RESEND_WEBHOOK_SECRET`, `RESEND_INBOUND_API_KEY`, `SUPPORT_FORWARD_TO` (see `lib/inbound-mail.ts`) |
| Email we send, cheaper | `AWS_SES_ROLE_ARN`, `AWS_SES_REGION`, `AWS_SES_CONFIGURATION_SET`, `AWS_SES_TOPIC_ARN`: all four, none of them a secret, or Amazon SES is not used. No key of Amazon's is stored: the host's own short-lived token is exchanged for one each hour (`lib/ses.ts`). With them, email goes through Amazon whenever Amazon says the account may write to the public, and through Resend whenever it may not; nobody switches it by hand. Everything Amazon needs is one stack, `infra/amazon-ses.yml`, whose header says in which order to set things. A long-lived key (`AWS_SES_ACCESS_KEY_ID`, `AWS_SES_SECRET_ACCESS_KEY`) works in the role's place on a host that has no such token |
| Bounces and spam reports | `RESEND_WEBHOOK_SECRET` alone. The same webhook at Resend (`/api/mail/inbound`) must also be sent the `email.bounced` and `email.complained` events; with them a dead address is taken off its store's list and a store with too many is paused by itself (see `lib/mail-health.ts`) |
| The daily mail check | Nothing to set. `/api/cron/mail-check` sends one tagged email a day to each sender's own bounce and complaint test addresses and passes when each has come back and taken its address off a made-up list; it also holds the host's token to what `infra/amazon-ses.yml` tells Amazon to trust. The result is in the logs as `mail-check pass` or `mail-check FAIL`, and the site's inbox hears of a failure (see `lib/verify-mail.ts`) |
| What a store keeps after its plan has ended | Nothing to set. `/api/cron/closing` runs once a day, after `/api/cron/plans`. A store with no plan may keep 5 GB; one that keeps more when its plan ends is emailed when the plan ends, 30 days before the day and 7 days before it, and 60 days after the plan ended its files, lesson videos and podcast episodes are removed, never sooner than a week after the last email and only after Stripe has been asked that day whether a plan runs. The store, its products, lessons' text, contacts and orders stay. The log line is `plan-closing: …`, and a store it could not finish is `left for tomorrow` (see `lib/plan-closing.ts`) |
| Visits to a store | Nothing to set in the code, and two things it counts on in the accounts. Each plan covers a number of visits a month (a visit is one address on one day for one store; `lib/traffic-rules.ts`), a paying store past them has $0.50 a thousand added to its next invoice by `/api/cron/usage`, and a store with no plan to charge rests past its visits. What a visit costs is worked out in `tests/traffic-cost.ts` and held against every plan in `tests/plan-margin.test.ts`. It counts on **Flat Rate CDN** being on in the Vercel team's Billing settings (bytes sent are then inside a fixed tier; without it a picture is charged by the gigabyte), and on the Upstash database being on **Pay As You Go** or a fixed plan (the free plan stops at 500,000 commands a month, for every project that shares the database) |
| Sold files that cost nothing to send | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`: all four. On the live site they are required: without them a sold file cannot be uploaded at all, because every plan's worst case is worked out with downloads costing nothing (`tests/plan-margin.test.ts`). Anywhere else, without them the files creators sell go to the host's file store, which charges for every gigabyte downloaded. With them, every new product file, lesson download, lesson video uploaded as a file and podcast episode goes from the studio's browser straight to Cloudflare R2 in pieces and is handed to buyers from there, where a download costs nothing (`lib/vault.ts`); files already in the host's store go on working. The key is an R2 API token that may read and write objects in that one bucket and nothing else. The bucket's CORS policy must let `https://marktmorgen.com` `PUT` with any header and must expose `ETag`, or an upload in pieces cannot be closed |
| Lesson videos in several sizes | `BUNNY_STREAM_LIBRARY_ID`, `BUNNY_STREAM_API_KEY`, `BUNNY_STREAM_TOKEN_KEY`: all three, or lesson videos stay what they were, the file as uploaded, played from the file store. `BUNNY_STREAM_READ_KEY` as well for the service's announcements to be believed at `/api/stream/hook`; without it the five-minute job `/api/cron/stream` does the asking alone. With them a lesson's video goes from the studio straight to Bunny Stream, is kept in sizes up to 1080p, and plays in its player with a token made for each viewing. In the library's own settings: "direct play" off, token authentication on for the player and for the files, sizes up to 1080p, and the address `/api/stream/hook` as its webhook (see `lib/stream.ts`, which says how the library was set up and what it costs) |
| Video calls | Google: `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`; Zoom: `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`, `ZOOM_WEBHOOK_SECRET_TOKEN`, `ZOOM_LIVE` |
| Creators' own domains | `VERCEL_API_TOKEN`, `VERCEL_DOMAINS_PROJECT`, `VERCEL_DOMAINS_TEAM` |
| Drafts written for a creator | `ANTHROPIC_API_KEY`, `AI_MODEL` |
| Scheduled jobs | `CRON_SECRET` |

The settings ending in `_API_BASE` are for local checks only: each accepts nothing but an address on `127.0.0.1`, so a check can never reach a real service. `PASSKEY_LOCAL_ORIGIN` is for local development and is ignored in production.
