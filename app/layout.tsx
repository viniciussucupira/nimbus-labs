import type { Metadata, Viewport } from "next";
import { Outfit, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

/* Both faces are served from our own domain, as one variable file each, so
   the browser never stops to ask fonts.googleapis.com for a stylesheet
   before it can paint the page. */
const outfit = Outfit({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

const SITE_URL = "https://nimbuslabsai.com";
const SITE_TITLE =
  "Nimbus Labs — the link-in-bio store that pays into your own Stripe";
const SITE_DESCRIPTION =
  "A colourful, fast store page for creators who sell files, plans and calls. Buyers pay into your own Stripe account, the file is delivered the second the payment clears, and Nimbus takes 0% of your sales.";

export const viewport: Viewport = {
  themeColor: "#150f42",
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
        alt: "A Nimbus Labs creator store on a phone, next to the words: the store for your bio that pays into your own Stripe.",
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
      className={`${outfit.variable} ${jakarta.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
