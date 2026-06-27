import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Serve the static marketing landing page at the root URL without
  // showing /landing/index.html in the browser's address bar.
  async rewrites() {
    return [
      { source: "/", destination: "/landing/index.html" },
      { source: "/landing", destination: "/landing/index.html" },
      // Legal pages — clean URLs for the static marketing pages
      { source: "/terms", destination: "/landing/terms.html" },
      { source: "/privacy", destination: "/landing/privacy.html" },
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
