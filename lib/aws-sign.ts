/**
 * Signs a request to Amazon Web Services (Signature Version 4).
 *
 * Amazon believes a request because of this signature and nothing else: a
 * hash of exactly what is being asked, keyed with the account's secret, the
 * day, the region and the service. It is written out here rather than taken
 * from Amazon's SDK because the one thing this site asks Amazon for is to
 * send an email, the SDK for that is several megabytes, and everything else
 * here talks to its services with `fetch` (lib/stripe.ts, lib/email.ts).
 *
 * The steps are Amazon's own, in its order
 * (docs.aws.amazon.com/IAM/latest/UserGuide/reference_sigv.html), and
 * tests/aws-sign.test.ts holds them to the worked examples Amazon publishes:
 * the same key, date and request must give the same signature, to the
 * character.
 *
 * Nothing here reads a setting. The caller hands in the key, so this file
 * can be tested with Amazon's published example key and no real one.
 */
import { createHash, createHmac } from "node:crypto";

export type AwsKey = { accessKeyId: string; secretAccessKey: string };

const sha256 = (data: string) => createHash("sha256").update(data, "utf8").digest("hex");
const hmac = (key: Buffer | string, data: string) => createHmac("sha256", key).update(data, "utf8").digest();

/** RFC 3986, as Amazon wants it: everything but letters, digits and -_.~ is escaped. */
function encode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

/** The path with each piece escaped once, and "/" for none. */
function canonicalPath(pathname: string): string {
  if (!pathname || pathname === "/") return "/";
  return pathname
    .split("/")
    .map((piece) => {
      try {
        return encode(decodeURIComponent(piece));
      } catch {
        return encode(piece);
      }
    })
    .join("/");
}

/** The query sorted by name, then by value, each escaped. */
function canonicalQuery(params: URLSearchParams): string {
  return [...params.entries()]
    .map(([name, value]) => [encode(name), encode(value)] as const)
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0))
    .map(([name, value]) => `${name}=${value}`)
    .join("&");
}

/** 20150830T123600Z, from a date. */
export function amzDate(at: Date): string {
  return at.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/**
 * The headers to send with a request so that Amazon accepts it: the ones
 * given, plus `host`, `x-amz-date` and `authorization`.
 */
export function signV4(input: {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: string;
  region: string;
  service: string;
  key: AwsKey;
  now?: Date;
}): Record<string, string> {
  const url = new URL(input.url);
  const stamp = amzDate(input.now ?? new Date());
  const day = stamp.slice(0, 8);

  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(input.headers ?? {})) headers[name.toLowerCase()] = value;
  headers.host = url.host;
  headers["x-amz-date"] = stamp;

  const names = Object.keys(headers).sort();
  const canonicalHeaders = names.map((name) => `${name}:${headers[name].trim().replace(/\s+/g, " ")}\n`).join("");
  const signedHeaders = names.join(";");
  const canonicalRequest = [
    input.method.toUpperCase(),
    canonicalPath(url.pathname),
    canonicalQuery(url.searchParams),
    canonicalHeaders,
    signedHeaders,
    sha256(input.body ?? ""),
  ].join("\n");

  const scope = `${day}/${input.region}/${input.service}/aws4_request`;
  const toSign = ["AWS4-HMAC-SHA256", stamp, scope, sha256(canonicalRequest)].join("\n");
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${input.key.secretAccessKey}`, day), input.region), input.service), "aws4_request");
  const signature = createHmac("sha256", signingKey).update(toSign, "utf8").digest("hex");

  return {
    ...headers,
    authorization: `AWS4-HMAC-SHA256 Credential=${input.key.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}
