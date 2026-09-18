import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    /**
     * Put the stylesheet inside the HTML instead of in a separate file.
     *
     * The browser cannot paint a single word until it has the CSS, so that
     * separate file sits in front of everything. Measured on the live page,
     * on a phone on a slow connection, it costs 190 ms of pure waiting, and
     * Google's own report names it the one render-blocking request and says
     * to inline it. Inlining removes the request; the stylesheet now travels
     * inside the response that was already on its way.
     *
     * Do not judge this change on a local run: localhost has no latency, so
     * the round trip it removes costs nothing there and only the extra bytes
     * show up. It is measured in production.
     */
    inlineCss: true,
  },
};

export default nextConfig;
