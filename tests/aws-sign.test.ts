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
import { amzDate, signV4 } from "@/lib/aws-sign";
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

done();
