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

  /**
   * Headers every response carries, marketing pages included.
   *
   * Set here rather than in proxy.ts on purpose: a page Next has prerendered
   * is served straight from Vercel's edge cache without the proxy running, so
   * headers added there reach the studio and the store pages and quietly miss
   * the home page. This list reaches all of them.
   *
   * frame-ancestors is the one that matters. Without it anyone can put the
   * studio inside an invisible frame on their own site and collect a signed-in
   * creator's clicks on buttons they never meant to press. 'self' is used
   * rather than 'none' because the home page shows the demo store in a frame
   * of its own, and that has to keep working.
   */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000" },
        ],
      },
      /*
       * A creator's uploaded photograph keeps its own, much stricter policy.
       *
       * The route already sets this on the response, but a header named here
       * is applied by the routing layer and wins, so the list above would
       * quietly replace "this file may do nothing at all" with a rule about
       * framing. It is written again here, last, because a header set in two
       * places is decided by the one that comes last.
       */
      {
        source: "/api/photo/:id*",
        headers: [{ key: "Content-Security-Policy", value: "default-src 'none'; sandbox; frame-ancestors 'none'" }],
      },
    ];
  },
};

export default nextConfig;
