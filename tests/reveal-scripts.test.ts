/**
 * The layout's two plain scripts run on the pages rendered per visit only
 * because the policy names their hashes (lib/reveal-scripts.ts, lib/csp.ts).
 * A script changed without its hash is a page whose sections stay hidden and
 * a console full of refusals; this keeps the two in step.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { REVEAL_HASHES, REVEAL_ON, REVEAL_WATCH } from "@/lib/reveal-scripts";
import { dynamicPolicy } from "@/lib/csp";
import { done, is, part } from "./check";

const hash = (text: string) => `'sha256-${createHash("sha256").update(text, "utf8").digest("base64")}'`;

part("Each script's hash is its own");
is("the switch", REVEAL_HASHES[0], hash(REVEAL_ON));
is("the observer", REVEAL_HASHES[1], hash(REVEAL_WATCH));

part("A page rendered per visit allows both, beside its nonce");
const policy = dynamicPolicy("abc", { store: true });
const scripts = policy.split(";").find((d) => d.trim().startsWith("script-src")) ?? "";
is("both hashes are in its scripts", REVEAL_HASHES.every((h) => scripts.includes(h)), true);
is("and the nonce still is", scripts.includes("'nonce-abc'"), true);

part("The layout writes exactly these");
const layout = readFileSync(join(process.cwd(), "app/layout.tsx"), "utf8");
is("from the shared module, not a copy", [/__html: REVEAL_ON,/.test(layout), /__html: REVEAL_WATCH,/.test(layout)], [true, true]);

part("No header names a feature browsers do not know");
const config = readFileSync(join(process.cwd(), "next.config.ts"), "utf8");
is("bluetooth is not in the Permissions-Policy", /bluetooth/.test(config) || /bluetooth/.test(policy), false);

done();
