import type { Metadata, Viewport } from "next";
import { Geist, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { SITE_URL } from "@/lib/site-url";

/* Two faces, both served from our own domain so the page never waits on
   fonts.googleapis.com: Geist for everything a person reads or clicks, and an
   italic serif kept for one or two words in a headline. */
const geist = Geist({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

const accent = Instrument_Serif({
  variable: "--font-accent",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
});

const SITE_TITLE =
  "Nimbus Labs — the link-in-bio store that pays into your own Stripe";
const SITE_DESCRIPTION =
  "A fast store page for creators who sell files and memberships. Buyers pay into your own Stripe account, the file is delivered the second the payment clears, and Nimbus takes 0% of your sales.";

export const viewport: Viewport = {
  themeColor: "#0d0b24",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  alternates: { canonical: "./" },
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  manifest: "/manifest.webmanifest",
  applicationName: "Nimbus Labs",
  appleWebApp: {
    capable: true,
    title: "Nimbus",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  openGraph: {
    type: "website",
    url: "./",
    siteName: "Nimbus Labs",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    locale: "en_US",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Nimbus Labs: your store, your Stripe, your money. A paid Stripe checkout and a delivered file, with 0% of the sale taken.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${accent.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
