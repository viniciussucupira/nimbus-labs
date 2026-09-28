import type { Metadata, Viewport } from "next";
import { Geist, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { SiteData } from "@/components/structured-data";
import { Toaster } from "@/components/toast";
import { SITE_URL } from "@/lib/site-url";
import { SITE_OG_IMAGE } from "@/lib/site-og";

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
  "A fast store page for creators who sell files, courses, calls and memberships. Buyers pay into your own Stripe account, what they bought is delivered the second the payment clears, and Nimbus takes 0% of your sales.";

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
  // Only the picture and the site here: a shared link to any page carries
  // that page's own title and description (its <title> and description),
  // never the home page's.
  openGraph: {
    type: "website",
    siteName: "Nimbus Labs",
    locale: "en_US",
    images: [SITE_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    images: [SITE_OG_IMAGE.url],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${accent.variable} h-full antialiased`}
    >
      {/*
        The photographs come from one other host, and a browser cannot start
        fetching from it until it has looked the name up, opened a connection
        and agreed a certificate — three round trips that only begin when the
        first <img> is read, deep into the page. Saying the name here starts
        that handshake while the HTML is still arriving, so the first picture
        lands sooner on the connection where it matters, which is a phone on
        mobile data. React lifts this into the head itself.
      */}
      <link rel="preconnect" href="https://images.unsplash.com" crossOrigin="" />
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster />
        <SiteData />
      </body>
    </html>
  );
}
