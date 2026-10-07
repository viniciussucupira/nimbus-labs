/**
 * A request to Amazon is signed exactly as Amazon signs it.
 *
 * Amazon publishes worked examples of its signature: a key that is not a real
 * one, a date, a request, and the signature they must give. If this file's
 * arithmetic differs from Amazon's by one character, every email sent through
 * Amazon is refused, and nothing here would say why. So the signer is held to
 * those examples, and to nothing made up for the occasion:
 *
 *   - the worked example in the IAM guide ("Signature Version 4 signing
 *     process", the ListUsers request of August 30, 2015);
 *   - "get-vanilla" from Amazon's Signature Version 4 test suite.
 *
 * Both were written here from the published values before the signer was
 * run against them, and both came out equal on the first run. What they do
 * not exercise is a body, which is one hash of the text sent: the last part
 * checks that a different body, region, secret or minute changes the result.
 */
import { EMPTY_HASH, amzDate, hashOf, presignV4, signV4 } from "@/lib/aws-sign";
import { done, is, part } from "./check";

const key = { accessKeyId: "AKIDEXAMPLE", secretAccessKey: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY" };
const now = new Date("2015-08-30T12:36:00.000Z");
const signatureOf = (authorization: string) => authorization.split("Signature=")[1];

part("The date");
is("as Amazon writes it", amzDate(now), "20150830T123600Z");

part("Amazon's worked example: listing users");
const listed = signV4({
  method: "GET",
  url: "https://iam.amazonaws.com/?Action=ListUsers&Version=2010-05-08",
  headers: { "Content-Type": "application/x-www-form-urlencoded; charset=utf-8" },
  region: "us-east-1",
  service: "iam",
  key,
  now,
});
is(
  "the whole authorization header",
  listed.authorization,
  "AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/iam/aws4_request, SignedHeaders=content-type;host;x-amz-date, Signature=5d672d79c15b13162d9279b0855cfba6789a8edb4c82c400e06b5924a6f2b5d7",
);
is("with the host and the date it was signed with", [listed.host, listed["x-amz-date"]], ["iam.amazonaws.com", "20150830T123600Z"]);

part("Amazon's test suite");
const vanilla = signV4({ method: "GET", url: "https://example.amazonaws.com/", region: "us-east-1", service: "service", key, now });
is("get-vanilla", signatureOf(vanilla.authorization), "5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31");

part("What must change the signature");
const base = { method: "POST", url: "https://email.us-east-1.amazonaws.com/v2/email/outbound-emails", headers: { "content-type": "application/json" }, region: "us-east-1", service: "ses", key, now };
const one = signatureOf(signV4({ ...base, body: '{"a":1}' }).authorization);
is("the body", one === signatureOf(signV4({ ...base, body: '{"a":2}' }).authorization), false);
is("the region", one === signatureOf(signV4({ ...base, region: "eu-west-1", body: '{"a":1}' }).authorization), false);
is("the secret", one === signatureOf(signV4({ ...base, key: { ...key, secretAccessKey: "another" }, body: '{"a":1}' }).authorization), false);
is("the minute", one === signatureOf(signV4({ ...base, now: new Date("2015-08-30T12:37:00.000Z"), body: '{"a":1}' }).authorization), false);
is("and the same request signs the same way twice", one, signatureOf(signV4({ ...base, body: '{"a":1}' }).authorization));

/*
 * The file store (lib/r2.ts) is asked in the dialect Amazon's S3 speaks, and
 * Amazon publishes worked examples for that too ("Authenticating Requests",
 * Amazon S3 API reference): a bucket named examplebucket, May 24, 2013, and
 * this key.
 */
const s3Key = { accessKeyId: "AKIAIOSFODNN7EXAMPLE", secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY" };
const s3Day = new Date("2013-05-24T00:00:00.000Z");
const s3 = { region: "us-east-1", service: "s3", key: s3Key, now: s3Day };

part("Amazon's file store examples: a signature in the headers");
is("the hash of no body", hashOf(""), EMPTY_HASH);
const ranged = signV4({
  ...s3,
  method: "GET",
  url: "https://examplebucket.s3.amazonaws.com/test.txt",
  headers: { Range: "bytes=0-9", "x-amz-content-sha256": EMPTY_HASH },
  payloadHash: EMPTY_HASH,
});
is("fetching the first ten bytes of an object", signatureOf(ranged.authorization), "f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41");
const welcome = "Welcome to Amazon S3.";
const stored = signV4({
  ...s3,
  method: "PUT",
  url: "https://examplebucket.s3.amazonaws.com/test$file.text",
  headers: { Date: "Fri, 24 May 2013 00:00:00 GMT", "x-amz-storage-class": "REDUCED_REDUNDANCY", "x-amz-content-sha256": hashOf(welcome) },
  payloadHash: hashOf(welcome),
});
is("storing an object whose name has a character to escape", signatureOf(stored.authorization), "98ad721746da40c64f1a55b78f14c238d841ea1380cd77a1b5971af0ece108bd");
const listedObjects = signV4({
  ...s3,
  method: "GET",
  url: "https://examplebucket.s3.amazonaws.com/?max-keys=2&prefix=J",
  headers: { "x-amz-content-sha256": EMPTY_HASH },
  payloadHash: EMPTY_HASH,
});
is("listing objects, with a query", signatureOf(listedObjects.authorization), "34b48302e7b5fa45bde8084f4b7868a86f0a534bc59db6670ed5711ef69dc6f7");

part("Amazon's file store example: a signature in the address");
const address = presignV4({ ...s3, method: "GET", url: "https://examplebucket.s3.amazonaws.com/test.txt", expires: 86400 });
is(
  "the whole address a browser is handed",
  address,
  "https://examplebucket.s3.amazonaws.com/test.txt?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAIOSFODNN7EXAMPLE%2F20130524%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20130524T000000Z&X-Amz-Expires=86400&X-Amz-SignedHeaders=host&X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404",
);
const signatureIn = (url: string) => new URL(url).searchParams.get("X-Amz-Signature");
const piece = { ...s3, method: "PUT", url: "https://examplebucket.s3.amazonaws.com/big.zip?partNumber=2&uploadId=abc", expires: 3600 };
const sized = signatureIn(presignV4({ ...piece, headers: { "content-length": "16777216" } }));
is("a header that is signed is named in the address", new URL(presignV4({ ...piece, headers: { "content-length": "16777216" } })).searchParams.get("X-Amz-SignedHeaders"), "content-length;host");
is("and a piece of another size does not carry the same signature", sized === signatureIn(presignV4({ ...piece, headers: { "content-length": "16777217" } })), false);
is("nor does another piece of the same upload", sized === signatureIn(presignV4({ ...piece, url: piece.url.replace("partNumber=2", "partNumber=3"), headers: { "content-length": "16777216" } })), false);
is("nor a fetch of the same path", sized === signatureIn(presignV4({ ...piece, method: "GET", headers: { "content-length": "16777216" } })), false);

done();
