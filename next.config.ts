import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // TEMPORARY: the root URL goes straight to the app's sign-in instead of the
  // marketing landing page. To restore the landing page, delete the redirects()
  // block below and put this line back in rewrites():
  //     { source: "/", destination: "/landing/index.html" },
  //
  // This has to be a REDIRECT, not a rewrite. The app decides what to show from
  // window.location.search (getRoute() in public/app/js/standalone-flow.js), and
  // a rewrite leaves the browser URL as "/" with no query string — the app would
  // see no mode and render the guest board instead of sign-in.
  //
  // permanent: false (307) on purpose. A permanent 308 is cached by browsers
  // indefinitely, so bringing the landing page back would not take effect for
  // anyone who had already visited.
  //
  // mode=startup (not auth=login) so the app still routes correctly for someone
  // already signed in: syncInitialRoute() sends a stored session straight to the
  // board and only shows sign-in when there is none.
  async redirects() {
    return [
      { source: "/", destination: "/app/index.html?mode=startup", permanent: false },
    ];
  },

  // The marketing pages stay reachable at /landing, /site and the legal URLs.
  async rewrites() {
    return [
      { source: "/landing", destination: "/landing/index.html" },
      // Legal pages — clean URLs for the static marketing pages
      { source: "/terms", destination: "/landing/terms.html" },
      { source: "/privacy", destination: "/landing/privacy.html" },
      { source: "/security", destination: "/landing/security.html" },
      // Legacy /site redirect for backward compatibility
      { source: "/site", destination: "/landing/index.html" },
    ];
  },

  // Allow the landing page's Google Fonts and badge images to load.
  async headers() {
    return [
      {
        source: "/landing/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ];
  },
};

export default nextConfig;
