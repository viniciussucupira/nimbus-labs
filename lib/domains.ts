/**
 * A store on the creator's own domain: shop.theirname.com instead of
 * nimbuslabsai.com/@theirname. Part of Pro.
 *
 * The domain is added to this site's project at Vercel, which checks the
 * creator's DNS and issues the certificate; this file asks Vercel what it sees
 * and turns that into the one or two records the creator has to add, in
 * words. Nothing here touches the creator's DNS: they add the records at
 * whoever sells them the domain, and we look again when they say they have.
 *
 *   nl:domain:<name>   the store handle a domain serves (read by proxy.ts)
 *
 * The nimbuslabsai.com address keeps working either way, so a link already
 * printed somewhere never breaks because a domain was added or removed.
 */
import { isRedisConfigured, redisPipeline } from "@/lib/redis";
import { canUse } from "@/lib/plan";
import { SITE_URL } from "@/lib/site-url";
import type { Store } from "@/lib/store";

// Local tests may point this at a mock on 127.0.0.1; nothing else is accepted.
const API = /^http:\/\/127\.0\.0\.1:\d+$/.test(process.env.VERCEL_API_BASE ?? "")
  ? `${process.env.VERCEL_API_BASE}`
  : "https://api.vercel.com";

const PROJECT = process.env.VERCEL_DOMAINS_PROJECT?.trim() || "nimbus-labs";
const TEAM = process.env.VERCEL_DOMAINS_TEAM?.trim() || "viniciussucupira";

function token(): string | null {
  const value = process.env.VERCEL_API_TOKEN?.trim();
  return value ? value : null;
}

/** Whether this deployment can add domains at all. */
export function isDomainsConfigured(): boolean {
  return token() !== null && isRedisConfigured();
}

/** Whether this store may use its own domain right now. */
export function canUseDomain(store: Pick<Store, "subscriptionActive" | "tier">): boolean {
  return canUse(store, "domain");
}

export const MAX_DOMAIN_LENGTH = 253;
const LABEL = "[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?";
const DOMAIN_PATTERN = new RegExp(`^(?:${LABEL}\\.)+[a-z][a-z0-9-]{0,61}[a-z0-9]$`);
const PLATFORM = new URL(SITE_URL).hostname;

/** Names that can never be a creator's: ours, the host's, and nothing local. */
function forbidden(name: string): boolean {
  return (
    name === PLATFORM ||
    name.endsWith(`.${PLATFORM}`) ||
    name.endsWith(".vercel.app") ||
    name === "vercel.app" ||
    name.endsWith(".vercel.com") ||
    name === "vercel.com" ||
    name.endsWith(".localhost") ||
    name.endsWith(".local") ||
    name.endsWith(".internal") ||
    name.endsWith(".test") ||
    name.endsWith(".example")
  );
}

/**
 * The domain as typed, reduced to a bare host name: no scheme, no path, no
 * port, lower case. Null when what is left is not one.
 */
export function cleanDomain(raw: string): string | null {
  let value = raw.trim().toLowerCase();
  value = value.replace(/^[a-z]+:\/\//, "").replace(/[/?#].*$/, "").replace(/:\d+$/, "").replace(/\.$/, "");
  if (!value || value.length > MAX_DOMAIN_LENGTH) return null;
  if (!DOMAIN_PATTERN.test(value)) return null;
  if (/^\d+(\.\d+){3}$/.test(value)) return null;
  if (forbidden(value)) return null;
  return value;
}

const domainKey = (name: string) => `nl:domain:${name}`;

/** Which store a domain serves. For the proxy; cached for a minute per instance. */
const cache = new Map<string, { handle: string | null; at: number }>();
export async function handleForDomain(name: string): Promise<string | null> {
  const hit = cache.get(name);
  if (hit && Date.now() - hit.at < 60_000) return hit.handle;
  if (!isRedisConfigured()) return null;
  const [raw] = await redisPipeline([["GET", domainKey(name)]]);
  const handle = typeof raw === "string" && raw ? raw : null;
  cache.set(name, { handle, at: Date.now() });
  if (cache.size > 5_000) cache.clear();
  return handle;
}

/** Points the domain at the store's current address, after a rename. */
export async function pointDomain(name: string, handle: string): Promise<void> {
  await redisPipeline([["SET", domainKey(name), handle]]);
  cache.delete(name);
}

type VercelAnswer = { status: number; body: Record<string, unknown> };

async function vercel(method: string, path: string, body?: unknown): Promise<VercelAnswer> {
  const key = token();
  if (!key) return { status: 503, body: {} };
  const separator = path.includes("?") ? "&" : "?";
  const url = `${API}${path}${separator}slug=${encodeURIComponent(TEAM)}`;
  try {
    const response = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
    const parsed = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    return { status: response.status, body: parsed };
  } catch (error) {
    console.error("the domain service did not answer", error);
    return { status: 502, body: {} };
  }
}

/** One record the creator adds at their domain provider, in the words providers use. */
export type DnsRecord = { type: "A" | "CNAME" | "TXT"; name: string; value: string; why: string };

export type DomainStatus = {
  name: string;
  /** Vercel sees the records and has the certificate: the domain serves the store. */
  live: boolean;
  records: DnsRecord[];
};

/** The part of a domain in front of its apex, as a DNS panel wants it: "@" for the apex itself. */
function hostPart(name: string, apex: string): string {
  if (name === apex) return "@";
  return name.slice(0, name.length - apex.length - 1);
}

/** What Vercel sees for a domain, and what is still missing. */
export async function domainStatus(name: string): Promise<DomainStatus | null> {
  const project = await vercel("GET", `/v9/projects/${PROJECT}/domains/${name}`);
  if (project.status !== 200) return null;
  const config = await vercel("GET", `/v6/domains/${name}/config?projectIdOrName=${PROJECT}`);
  const apex = typeof project.body.apexName === "string" ? project.body.apexName : name;
  const verified = project.body.verified === true;
  const misconfigured = config.status !== 200 || config.body.misconfigured !== false;

  const records: DnsRecord[] = [];
  if (name === apex) {
    const list = Array.isArray(config.body.recommendedIPv4) ? (config.body.recommendedIPv4 as { rank: number; value: string[] }[]) : [];
    const best = [...list].sort((a, b) => a.rank - b.rank)[0];
    const ip = best && Array.isArray(best.value) && typeof best.value[0] === "string" ? best.value[0] : "76.76.21.21";
    records.push({ type: "A", name: "@", value: ip, why: "Sends visitors of your domain to your store." });
  } else {
    const list = Array.isArray(config.body.recommendedCNAME) ? (config.body.recommendedCNAME as { rank: number; value: string }[]) : [];
    const best = [...list].sort((a, b) => a.rank - b.rank)[0];
    const target = best && typeof best.value === "string" ? best.value.replace(/\.$/, "") : "cname.vercel-dns.com";
    records.push({ type: "CNAME", name: hostPart(name, apex), value: target, why: "Sends visitors of this address to your store." });
  }
  if (!verified && Array.isArray(project.body.verification)) {
    for (const item of project.body.verification as { type?: string; domain?: string; value?: string }[]) {
      if (item.type === "TXT" && typeof item.domain === "string" && typeof item.value === "string") {
        records.push({
          type: "TXT",
          name: hostPart(item.domain, apex),
          value: item.value,
          why: "Proves the domain is yours. It is in use somewhere else at the moment, so this is needed once.",
        });
      }
    }
  }
  return { name, live: verified && !misconfigured, records };
}

export type ConnectResult =
  | { ok: true; name: string }
  | { ok: false; reason: "shape" | "taken" | "elsewhere" | "has_one" | "unavailable" | "plan" };

/**
 * Adds a domain to a store: claims it here first, so two stores cannot both
 * have it, then asks Vercel to serve it. A claim Vercel refuses is let go.
 */
export async function connectDomain(store: Store, raw: string): Promise<ConnectResult> {
  if (!canUseDomain(store)) return { ok: false, reason: "plan" };
  if (!isDomainsConfigured()) return { ok: false, reason: "unavailable" };
  if (store.domain) return { ok: false, reason: "has_one" };
  const name = cleanDomain(raw);
  if (!name) return { ok: false, reason: "shape" };

  const [claimed] = await redisPipeline([["SET", domainKey(name), store.handle, "NX"]]);
  if (claimed === null) return { ok: false, reason: "taken" };

  const added = await vercel("POST", `/v10/projects/${PROJECT}/domains`, { name });
  // Already on this project (a second press, or added by hand) is fine;
  // on somebody else's is not.
  const alreadyHere =
    added.status === 409 && (await vercel("GET", `/v9/projects/${PROJECT}/domains/${name}`)).status === 200;
  if (added.status !== 200 && !alreadyHere) {
    await redisPipeline([["DEL", domainKey(name)]]);
    cache.delete(name);
    if (added.status === 409) return { ok: false, reason: "elsewhere" };
    if (added.status === 400) return { ok: false, reason: "shape" };
    return { ok: false, reason: "unavailable" };
  }
  cache.delete(name);
  return { ok: true, name };
}

/** Asks Vercel to check the proving record again, for a domain in use elsewhere. */
export async function verifyDomain(name: string): Promise<void> {
  await vercel("POST", `/v9/projects/${PROJECT}/domains/${name}/verify`);
}

/** Takes a domain off a store. The nimbuslabsai.com address carries on as before. */
export async function disconnectDomain(name: string): Promise<boolean> {
  const removed = await vercel("DELETE", `/v9/projects/${PROJECT}/domains/${name}`);
  if (removed.status !== 200 && removed.status !== 404) return false;
  await redisPipeline([["DEL", domainKey(name)]]);
  cache.delete(name);
  return true;
}
