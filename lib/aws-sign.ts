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

/**
 * A key Amazon believes. `sessionToken` is there on a key that was lent for
 * an hour in exchange for a role (lib/ses.ts): Amazon wants it sent along,
 * and signed with the rest.
 */
export type AwsKey = { accessKeyId: string; secretAccessKey: string; sessionToken?: string };

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
  /**
   * What stands for the body in the signature, when it is not the body's own
   * hash: a file store is told "UNSIGNED-PAYLOAD" for a body that is a
   * stream, or handed the hash worked out elsewhere. The file store also
   * wants the same value in an `x-amz-content-sha256` header, which the
   * caller adds.
   */
  payloadHash?: string;
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
  if (input.key.sessionToken) headers["x-amz-security-token"] = input.key.sessionToken;

  const names = Object.keys(headers).sort();
  const canonicalHeaders = names.map((name) => `${name}:${headers[name].trim().replace(/\s+/g, " ")}\n`).join("");
  const signedHeaders = names.join(";");
  const canonicalRequest = [
    input.method.toUpperCase(),
    canonicalPath(url.pathname),
    canonicalQuery(url.searchParams),
    canonicalHeaders,
    signedHeaders,
    input.payloadHash ?? sha256(input.body ?? ""),
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

/** The hash of nothing, which is what a request with no body carries. */
export const EMPTY_HASH = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

/** The hash of a body, as the signature and the file store's header want it. */
export function hashOf(body: string | Uint8Array): string {
  return createHash("sha256").update(body).digest("hex");
}

/**
 * An address that carries its own signature, for somebody who holds no key.
 *
 * A browser cannot be handed the account's secret, so for the one request it
 * is allowed — fetch this file, or send this piece of that upload — it is
 * handed the address with the signature in the query. Whoever holds it can
 * make exactly that request until `expires` seconds have passed, and no
 * other: the method, the path, every query value and every header named in
 * `headers` are in what was signed. A header signed here has to arrive with
 * the same value, which is how a piece of an upload is held to its size (the
 * browser states the length of what it sends, and a longer piece no longer
 * matches).
 *
 * The body is not signed ("UNSIGNED-PAYLOAD"): it does not exist yet when
 * the address is made. Amazon's own steps, in its order
 * (docs.aws.amazon.com/AmazonS3/latest/API/sigv4-query-string-auth.html);
 * tests/aws-sign.test.ts holds them to its published example.
 */
export function presignV4(input: {
  method: string;
  url: string;
  /** Headers the request must carry with exactly these values. `host` is always one. */
  headers?: Record<string, string>;
  expires: number;
  region: string;
  service: string;
  key: AwsKey;
  now?: Date;
}): string {
  const url = new URL(input.url);
  const stamp = amzDate(input.now ?? new Date());
  const day = stamp.slice(0, 8);
  const scope = `${day}/${input.region}/${input.service}/aws4_request`;

  const headers: Record<string, string> = { host: url.host };
  for (const [name, value] of Object.entries(input.headers ?? {})) headers[name.toLowerCase()] = value;
  const names = Object.keys(headers).sort();
  const signedHeaders = names.join(";");

  url.searchParams.set("X-Amz-Algorithm", "AWS4-HMAC-SHA256");
  url.searchParams.set("X-Amz-Credential", `${input.key.accessKeyId}/${scope}`);
  url.searchParams.set("X-Amz-Date", stamp);
  url.searchParams.set("X-Amz-Expires", String(Math.max(1, Math.floor(input.expires))));
  url.searchParams.set("X-Amz-SignedHeaders", signedHeaders);
  if (input.key.sessionToken) url.searchParams.set("X-Amz-Security-Token", input.key.sessionToken);

  const canonicalRequest = [
    input.method.toUpperCase(),
    canonicalPath(url.pathname),
    canonicalQuery(url.searchParams),
    names.map((name) => `${name}:${headers[name].trim().replace(/\s+/g, " ")}\n`).join(""),
    signedHeaders,
    "UNSIGNED-PAYLOAD",
  ].join("\n");
  const toSign = ["AWS4-HMAC-SHA256", stamp, scope, sha256(canonicalRequest)].join("\n");
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${input.key.secretAccessKey}`, day), input.region), input.service), "aws4_request");
  const signature = createHmac("sha256", signingKey).update(toSign, "utf8").digest("hex");

  // Written out by hand, in Amazon's own escaping: the address a browser is
  // given has to be the one that was signed, character for character.
  return `${url.origin}${canonicalPath(url.pathname)}?${canonicalQuery(url.searchParams)}&X-Amz-Signature=${signature}`;
}
