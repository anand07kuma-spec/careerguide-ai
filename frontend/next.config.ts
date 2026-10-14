import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // The dev server's live-reload socket only accepts origins it knows, and in dev
  // Turbopack the page's module graph arrives over that socket — so a rejected
  // origin renders the server HTML and then never hydrates. Every button looks
  // present and does nothing. `http://127.0.0.1:3000` is a normal thing to type,
  // so it is allowed alongside the named URL.
  allowedDevOrigins: ["127.0.0.1", "careerguide.localhost"],
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
