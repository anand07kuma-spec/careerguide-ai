import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Only a container asks for this. `next start` inside an image needs a self-contained
  // build (`standalone`) or it also wants `node_modules` copied wholesale; Vercel does
  // not use `next start` at all, and it is not a given that an extra output mode
  // interacts cleanly with `cacheComponents` — so the live deployment keeps building
  // exactly the config it always had, and this line changes behaviour only where the
  // value is deliberately set. `frontend/Dockerfile` sets it.
  ...(process.env.NEXT_DOCKER_STANDALONE === "1" ? { output: "standalone" as const } : {}),
  // The blog and `/sitemap.xml` read their markdown off the filesystem at
  // request time. A serverless deployment only ships files the import graph
  // touched, and a `.md` opened with `fs` is not an import — without this, the
  // pages would build fine locally and 404 every post in production.
  outputFileTracingIncludes: {
    "/blog": ["./src/content/blog/*.md"],
    "/blog/[slug]": ["./src/content/blog/*.md"],
    "/sitemap.xml": ["./src/content/blog/*.md"],
  },
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
