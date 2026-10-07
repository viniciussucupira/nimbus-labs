/**
 * The address a creator's email goes out from (lib/mail-from.ts): their own,
 * on a domain set apart from the one login links and receipts come from.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { creatorAddress, creatorDomain, domainOf } from "@/lib/mail-from";
import { fromLine } from "@/lib/mail";
import { fromCreator, fromStore } from "@/lib/purchase-email";
import { NIMBUS_FROM } from "@/lib/email";
import type { Store } from "@/lib/store";

const SITE = "Marktmorgen <hello@marktmorgen.com>";
/** Resend in use, with a key for the creators' domain beside the site's own. */
const BOTH = { site: true, creators: true };
const store = { handle: "harborkitchen", name: "Harbor Kitchen", email: "ana@example.com", mail: { fromName: "Ana at Harbor Kitchen" } } as unknown as Store;

function withDomain<T>(value: string | undefined, run: () => T): T {
  const before = process.env.MARKETING_FROM_DOMAIN;
  if (value === undefined) delete process.env.MARKETING_FROM_DOMAIN;
  else process.env.MARKETING_FROM_DOMAIN = value;
  try {
    return run();
  } finally {
    if (before === undefined) delete process.env.MARKETING_FROM_DOMAIN;
    else process.env.MARKETING_FROM_DOMAIN = before;
  }
}

test("the domain of a From line is read whether or not a name is in front", () => {
  assert.equal(domainOf(SITE), "marktmorgen.com");
  assert.equal(domainOf("hello@Marktmorgen.com"), "marktmorgen.com");
  assert.equal(domainOf("nobody"), "");
});

test("with a domain set apart, each store writes from its own address on it", () => {
  assert.equal(creatorAddress("harborkitchen", SITE, "mail.marktmorgen.com", BOTH), "harborkitchen@mail.marktmorgen.com");
  assert.equal(creatorAddress("ana.b_c-d", SITE, " Mail.Marktmorgen.com. ", BOTH), "ana.b_c-d@mail.marktmorgen.com");
  // Two full stops in a row are a handle and not an address.
  assert.equal(creatorAddress("a..b", SITE, "mail.marktmorgen.com", BOTH), "a.b@mail.marktmorgen.com");
});

test("no setting, or one that is not a domain, changes nothing", () => {
  for (const raw of [undefined, "", "   ", "mail", "mail marktmorgen.com", "hello@mail.marktmorgen.com", "https://mail.marktmorgen.com", "-mail.marktmorgen.com", "mail..marktmorgen.com"]) {
    assert.equal(creatorDomain(SITE, raw, BOTH), null, String(raw));
    assert.equal(creatorAddress("harborkitchen", SITE, raw, BOTH), null, String(raw));
  }
});

test("the domain the site's own email comes from is never the creators'", () => {
  // A store called "hello" would otherwise write from the address login links come from.
  assert.equal(creatorDomain(SITE, "marktmorgen.com", BOTH), null);
  assert.equal(creatorAddress("hello", SITE, "marktmorgen.com", BOTH), null);
  assert.equal(creatorAddress("hello", SITE, "mail.marktmorgen.com", BOTH), "hello@mail.marktmorgen.com");
});

test("where Resend sends, the domain is used only once Resend has a key for it", () => {
  // The site's own key is held to the site's own domain at Resend, and is
  // refused for any other: a domain set without its key must change nothing.
  assert.equal(creatorDomain(SITE, "mail.marktmorgen.com", { site: true, creators: false }), null);
  assert.equal(creatorAddress("harborkitchen", SITE, "mail.marktmorgen.com", { site: true, creators: false }), null);
  assert.equal(creatorDomain(SITE, "mail.marktmorgen.com", { site: true, creators: true }), "mail.marktmorgen.com");
  // With no Resend at all there is no key to wait for.
  assert.equal(creatorDomain(SITE, "mail.marktmorgen.com", { site: false, creators: false }), "mail.marktmorgen.com");
});

test("a handle that cannot be the first half of an address falls back", () => {
  for (const handle of ["", " ", "a b", "a@b", "<a>", ".a", "a.", "a\r\nBcc: x"]) {
    assert.equal(creatorAddress(handle, SITE, "mail.marktmorgen.com", BOTH), null, JSON.stringify(handle));
  }
});

test("a creator's list email is from their own name at their own address", () => {
  const site = domainOf(NIMBUS_FROM);
  const keyBefore = process.env.RESEND_CREATORS_API_KEY;
  process.env.RESEND_CREATORS_API_KEY = "re_test_creators_only_a_stand_in";
  withDomain("creators.example.org", () => {
    assert.equal(fromLine(store), '"Ana at Harbor Kitchen" <harborkitchen@creators.example.org>');
    assert.equal(fromCreator(store), '"Harbor Kitchen" <harborkitchen@creators.example.org>');
    // A receipt stays on the site's own address whatever is set.
    assert.equal(domainOf(fromStore(store)), site);
  });
  withDomain(undefined, () => {
    assert.equal(domainOf(fromLine(store)), site);
    assert.equal(domainOf(fromCreator(store)), site);
  });
  if (keyBefore === undefined) delete process.env.RESEND_CREATORS_API_KEY;
  else process.env.RESEND_CREATORS_API_KEY = keyBefore;
});

test("every email that asks for a sale or goes to a list is sent from the creator's address", () => {
  // Each of these builds its From line with fromLine or fromCreator; none may
  // go back to the address receipts come from.
  const promotional = ["lib/mail.ts", "lib/waitlist.ts", "lib/review-requests.ts", "lib/winback-send.ts", "lib/community-mail.ts", "lib/checkout-recovery.ts", "app/api/store/mail/route.ts"];
  for (const file of promotional) {
    const source = readFileSync(join(process.cwd(), file), "utf8");
    assert.match(source, /from: (fromLine|fromCreator)\(/, file);
    assert.doesNotMatch(source, /from: fromStore\(/, file);
  }
});

test("Amazon is told about both domains, and may send from both", () => {
  const stack = readFileSync(join(process.cwd(), "infra/amazon-ses.yml"), "utf8");
  assert.match(stack, /identity\/\$\{DomainName\}/);
  assert.match(stack, /identity\/\$\{CreatorsDomainName\}/);
  assert.match(stack, /EmailIdentity: !Ref CreatorsDomainName/);
  // Each names the address its bounces come back to as its own.
  assert.match(stack, /MailFromDomain: !Sub send\.\$\{DomainName\}/);
  assert.match(stack, /MailFromDomain: !Sub send\.\$\{CreatorsDomainName\}/);
});
