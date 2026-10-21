/*
 * CareerGuide AI service worker.
 *
 * What it caches, and why that list is so short.
 *
 * Every screen in this app is live data behind a per-device session token: a
 * dashboard, a plan, a report. A page that looked fine and showed last week's
 * plan is worse than a page that did not load, and a page that showed a
 * previous student's numbers would be a privacy failure. So:
 *
 *   - `/_next/static/**`  cache first. These files are content-hashed and carry
 *     no user data — the same chunk is served to everybody forever, which is the
 *     only kind of response that is safe to keep.
 *   - icons, manifest     cache first. Static, public, small.
 *   - anything else       network, always. That covers `/api/**` and every page,
 *     including `/app/**`. A POST is never intercepted at all.
 *
 * What "offline" means here, stated plainly because the app should not oversell
 * itself: nothing is readable offline. No page document is ever stored, so an
 * offline visit shows the screen written out below with a Retry button instead of
 * the browser's own error page — and that is the whole of the offline story. There
 * is no cached feed, no stored report, no background sync of an unanswered
 * question. The data lives on the server or it does not exist on this device,
 * which is the same promise the privacy policy makes about somebody else holding
 * this phone.
 *
 * The fallback is written out in this file rather than fetched from an `/offline`
 * route on purpose: a route needs its own JavaScript chunks, which are exactly
 * the thing that may not be in the cache when a first visit goes offline. A page
 * that fails to render its own offline page is not a fallback.
 */

const VERSION = "careerguide-v2";
const STATIC_CACHE = `${VERSION}-static`;
const ASSET_CACHE = `${VERSION}-assets`;

// Bound on the chunk cache. Next emits a new hashed file per build, so a browser
// that comes back every week for a year would otherwise keep every version of
// this app. Entries are dropped oldest-first past this count; a chunk that is
// then asked for misses the cache, goes to the network, and is stored again.
const MAX_STATIC_ENTRIES = 160;

const PUBLIC_ASSETS = [
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-192.png",
  "/icon-maskable-512.png",
];

self.addEventListener("install", (event) => {
  // Warm the public assets. A failure here is not fatal — the worker still
  // works, it just starts with a colder cache — so nothing rejects the promise.
  event.waitUntil(
    (async () => {
      const cache = await caches.open(ASSET_CACHE);
      await Promise.allSettled(PUBLIC_ASSETS.map((path) => cache.add(path)));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key)),
      );
      await trim(STATIC_CACHE, MAX_STATIC_ENTRIES);
      await self.clients.claim();
    })(),
  );
});

function isStaticChunk(url) {
  return url.origin === self.location.origin && url.pathname.startsWith("/_next/static/");
}

function isPublicAsset(url) {
  return url.origin === self.location.origin && PUBLIC_ASSETS.includes(url.pathname);
}

async function trim(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  if (keys.length <= max) return;
  await Promise.all(keys.slice(0, keys.length - max).map((request) => cache.delete(request)));
}

async function put(name, request, response) {
  const cache = await caches.open(name);
  await cache.put(request, response.clone());
  if (name === STATIC_CACHE) await trim(name, MAX_STATIC_ENTRIES);
}

// Only a response that could never be somebody's data is stored.
function worthKeeping(response) {
  return (
    response.ok &&
    response.type === "basic" &&
    !response.headers.get("cache-control")?.includes("no-store")
  );
}

async function offlinePage() {
  return new Response(OFFLINE_HTML, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // A write is the page's business. Non-GET requests carry the session token and
  // change data; intercepting them is how a retry ends up happening twice.
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (isStaticChunk(url)) {
    event.respondWith(
      (async () => {
        const hit = await caches.match(request);
        if (hit) return hit;
        const response = await fetch(request);
        if (worthKeeping(response)) await put(STATIC_CACHE, request, response);
        return response;
      })(),
    );
    return;
  }

  if (isPublicAsset(url)) {
    event.respondWith(
      (async () => {
        const hit = await caches.match(request);
        if (hit) return hit;
        const response = await fetch(request);
        if (worthKeeping(response)) await put(ASSET_CACHE, request, response);
        return response;
      })(),
    );
    return;
  }

  // Everything else — the API and every page — is network first. `cache: "no-store"`
  // on the fetch itself keeps the browser's HTTP cache from doing something this
  // file has not thought about.
  event.respondWith(
    (async () => {
      try {
        return await fetch(request, { cache: "no-store" });
      } catch (failure) {
        // Only a page navigation gets the fallback. A failed `/api` call goes back
        // to the page as a rejection, because every screen already answers a dead
        // API with its own honest message — and a screen reading HTML instead of
        // JSON would be a confusing way to find out the network is down.
        if (request.mode === "navigate") return offlinePage();
        throw failure;
      }
    })(),
  );
});

const OFFLINE_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>You are offline — CareerGuide AI</title>
    <style>
      /* Inlined, because a stylesheet is another request and this page is what
         you get when requests are the thing that is not working. */
      :root { color-scheme: light; }
      * { box-sizing: border-box; }
      body {
        margin: 0; min-height: 100vh; display: grid; place-items: center;
        background: #f5f8ff; color: #12203a; padding: 24px;
        font: 16px/1.6 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      }
      main { max-width: 34rem; text-align: center; }
      .mark {
        width: 56px; height: 56px; margin: 0 auto 20px; border-radius: 16px;
        background: #0b1730; color: #fff; display: grid; place-items: center;
        font-size: 24px; font-weight: 600;
      }
      h1 { margin: 0 0 8px; font-size: 24px; }
      p { margin: 0 0 8px; color: #4a5a75; }
      .card {
        margin: 24px auto 0; padding: 16px; border-radius: 14px; text-align: left;
        background: #fff; border: 1px solid #dbe4f5;
      }
      .card p { font-size: 14px; margin: 0; }
      button {
        margin-top: 24px; height: 44px; padding: 0 24px; border: 0; border-radius: 12px;
        background: #2563eb; color: #fff; font: inherit; font-weight: 600; cursor: pointer;
      }
      button:disabled { opacity: .6; cursor: default; }
    </style>
  </head>
  <body>
    <main>
      <div class="mark" aria-hidden="true">CG</div>
      <h1>You are offline</h1>
      <p>This page could not reach the server.</p>
      <div class="card">
        <p>
          Nothing here is stored on this device while you wait, on purpose: your
          conversations, plans and reports live on the server, and an app that
          kept copies of them on a shared family phone would be handing them to
          whoever picked it up next.
        </p>
      </div>
      <button id="retry" type="button">Try again</button>
    </main>
    <script>
      document.getElementById("retry").addEventListener("click", function () {
        this.disabled = true;
        this.textContent = "Checking…";
        // Reload rather than probe: if the network is back, this is the same
        // thing pressing the browser's reload button would do.
        setTimeout(function () { window.location.reload(); }, 250);
      });
    </script>
  </body>
</html>`;
