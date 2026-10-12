import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // Every /app and /parent screen is a client component that fetches with a
    // token held in localStorage, so its content can never live in a server
    // static shell. Automatic validation only reports the auth guard's loading
    // state as a "dropped segment"; segments that export `instant` are still checked.
    instantInsights: {
      validationLevel: "manual-warning",
    },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
