"use client";

import { useEffect } from "react";

/**
 * Registers /sw.js, which is what makes the site installable and what turns an
 * offline visit into a page with a Retry button instead of the browser's error.
 *
 * Production only, and that is a real limitation rather than a preference: a
 * service worker in local development would hold stale chunks across `next dev`
 * reloads and make every edit invisible, which is a worse way to build this app
 * than not testing the worker. So the offline path is verified against a
 * production build (`npm run build && npm run start`), and `next dev` never
 * registers anything.
 *
 * The worker stores content-hashed chunks and public icons only — never a page
 * document, never anything under `/api` — so no screen's data can be served from
 * it. See `public/sw.js`.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch(() => {
        /* Installability is a nice-to-have. The site works without the
           worker, and pretending it registered would be worse than not. */
      });
  }, []);

  return null;
}
