"use client";

import { useEffect } from "react";

/**
 * Registers /sw.js, which is what makes the site installable and what turns an
 * offline visit into a page that says so — with the career pages this device has
 * already read, and the last conversation this browser agreed to hold.
 *
 * Production only, and that is a real limitation rather than a preference: a
 * service worker in local development would hold stale chunks across `next dev`
 * reloads and make every edit invisible, which is a worse way to build this app
 * than not testing the worker. So the offline path is verified against a
 * production build (`npm run build && npm run start`), and `next dev` never
 * registers anything. That also means `src/lib/offline.ts` has no worker to talk
 * to while anybody is building the app, and says nothing rather than failing.
 *
 * What it may keep is a short, explicit list — hashed chunks, the icons, the last
 * twenty career pages, the public catalogue JSON, and one conversation handed to it
 * by the screen that read it. Every other path is refused at the one door that writes
 * to a cache, and `scripts/offline-paths.mjs` fails the build if that list and
 * `src/lib/site.ts` ever disagree. Read `public/sw.js` before changing any of it:
 * this file decides what stays on a family's phone after they put it down.
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
