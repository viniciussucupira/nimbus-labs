// Shared by the /creators form (client) and the /api/creators route (server).

export const PLATFORMS = [
  "Stan",
  "Beacons",
  "Payhip",
  "Gumroad",
  "Kajabi",
  "Linktree",
  "Shopify",
  "Etsy",
  "My own website",
  "Other",
] as const;

export const LIMITS = {
  name: 80,
  email: 200,
  link: 300,
  country: 60,
  problem: 2000,
  tools: 1000,
  cost: 200,
} as const;

export const PROBLEM_MIN_LENGTH = 10;

export const SUPPORT_EMAIL = "viniciussucupira091@gmail.com";

// Stored with every answer as proof of what the person agreed to.
export const CONSENT_VERSION = "2026-09-16";

export const CONSENT_RESEARCH_TEXT =
  "Nimbus Labs may store my answers and email me with follow-up questions about this research. I can ask for my answers to be deleted at any time.";

export const CONSENT_UPDATES_TEXT =
  "Also email me if Nimbus Labs launches a tool for creators.";

export type CreatorAnswer = {
  name: string;
  email: string;
  platform: (typeof PLATFORMS)[number];
  link: string;
  country: string;
  problem: string;
  tools: string;
  cost: string;
  consentResearch: true;
  consentUpdates: boolean;
};
