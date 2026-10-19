import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // App-link files live at fixed paths the OS checks; the router skips dot-folders, so they're served from API routes.
  async rewrites() {
    return [
      { source: "/.well-known/apple-app-site-association", destination: "/api/app-links/apple" },
      { source: "/apple-app-site-association", destination: "/api/app-links/apple" },
      { source: "/.well-known/assetlinks.json", destination: "/api/app-links/android" },
    ];
  },
};

export default nextConfig;
