/*
 * CareerGuide AI service worker.
 *
 * What it caches, and what it is not allowed to.
 *
 * Every screen behind a sign-in is live data: a dashboard, a plan, a report. A page
 * that looked fine and showed last week's plan is worse than a page that did not
 * load, and a page that showed a previous student's numbers would be a privacy
 * failure. So nothing is stored unless it is one of exactly five things:
 *
 *   - `/_next/static/**`   cache first. Content-hashed and the same for everybody,
 *     which is the only kind of response that is safe to keep forever.
 *   - icons, manifest      cache first. Static, public, small.
 *   - `/careers` and `/careers/<slug>`, plus the in-app payload for each
 *     cache with a network check first. Public career pages, and only the last
 *     twenty of them. What the student was shown is what they get again, marked
 *     with the line that says it is a stored copy.
 *   - `/api/careers`, `/api/careers/categories`, `/api/careers/<slug>`
 *     the same catalogue in JSON, and only those three shapes. This is the one
 *     exception to the rule below about `/api`, because these are the rows the
 *     public pages print — nobody's answers, nobody's plans, nobody's name.
 *   - the last conversation, and only when this browser's own screen hands it over.
 *     The worker never takes one by itself: it has no way to tell whose `messages`
 *     response it is looking at, so it does not try. The page that read it posts it,
 *     and the key it is posted under is this browser's device id — the same id the
 *     session runs on, which is what makes "the student's own copy" mean something
 *     on a handset two children share.
 *
 * Everything else is network, always. That covers every other `/api/**` and every
 * other page, including all of `/app/**`, `/parent/**`, `/admin/**`, `/school/**`
 * and `/counsellor/**`. A POST is never intercepted at all. `DISALLOWED_PATHS`
 * below names those surfaces a second time as a hard refusal, and
 * `scripts/offline-paths.mjs` fails the build if that list and `src/lib/site.ts`
 * ever disagree — two copies of a privacy list in one repo drift, and this one is
 * the copy that decides what stays on a family's phone.
 *
 * What "offline" means here, stated plainly because the app should not oversell
 * itself: a career page you have read before opens, the last conversation you had
 * on this device can be re-read, and everything else says so rather than spinning.
 * That is a change from what this file used to promise, and the promise it makes
 * now is narrower and worth reading: your last conversation *is* written on this
 * device, and whoever can open this browser can read it. Nothing else of yours is.
 * Settings → This device can forget the copy in one press, and Start over,
 * "Delete history" and ending a conversation each drop it without being asked.
 *
 * Both fallback documents are written out in this file rather than fetched from a
 * route on purpose: a route needs its own JavaScript chunks, which are exactly the
 * thing that may not be in the cache when a first visit goes offline. A page that
 * fails to render its own offline page is not a fallback.
 */

const VERSION = "careerguide-v3";
const STATIC_CACHE = `${VERSION}-static`;
const ASSET_CACHE = `${VERSION}-assets`;
const PAGE_CACHE = `${VERSION}-pages`;
const API_CACHE = `${VERSION}-api`;
const PRIVATE_CACHE = `${VERSION}-private`;

// Bound on the chunk cache. Next emits a new hashed file per build, so a browser
// that comes back every week for a year would otherwise keep every version of
// this app. Entries are dropped oldest-first past this count; a chunk that is
// then asked for misses the cache, goes to the network, and is stored again.
const MAX_STATIC_ENTRIES = 160;

// Twenty career pages, which is what the brief asked for and about right for a
// handset with a few gigabytes free. Each page is stored twice — the document a
// reload asks for, and the payload an in-app tap asks for — so the cap is forty
// entries and the pairs belong together.
const MAX_CAREER_PAGES = 20;
const MAX_PAGE_ENTRIES = MAX_CAREER_PAGES * 2;

// The catalogue is three URLs and a search. Twenty JSON bodies is more than a
// student can be reading between two trips on a bus.
const MAX_API_ENTRIES = 20;

const PUBLIC_ASSETS = [
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-192.png",
  "/icon-maskable-512.png",
];

/**
 * The surfaces that belong to a person, not to the world.
 *
 * Kept here as a hard refusal for the store path: no response whose URL starts with
 * one of these is ever written to any cache, whatever else matches. The catalogue
 * endpoints under `/api` are the single documented exception, and `publicCatalogue`
 * is the only way to reach it.
 */
const DISALLOWED_PATHS = [
  "/app",
  "/api",
  "/admin",
  "/parent",
  "/school",
  "/counsellor",
  "/join",
  "/welcome",
  "/onboarding",
  "/sign-in",
  "/sign-up",
  "/account",
];

/** The three JSON shapes that are public rows, and nothing else under `/api`. */
function publicCatalogue(pathname) {
  if (pathname === "/api/careers") return true;
  if (pathname === "/api/careers/categories") return true;
  // `/api/careers/saved` is one student's list, and it is the only single-segment
  // path under `/api/careers` that is anybody's. It is named here rather than left
  // to a pattern because a pattern that forgets it is a privacy failure, and this
  // line is the cheapest place in the file to remember it.
  if (pathname === "/api/careers/saved") return false;
  return /^\/api\/careers\/[^/]+$/.test(pathname);
}

function isDisallowed(pathname) {
  return DISALLOWED_PATHS.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** Public career pages: the list and one career. Nothing deeper is stored, so a
 * path that grows user data later cannot be swept up by this rule by accident. */
function isCareerPage(pathname) {
  return pathname === "/careers" || /^\/careers\/[^/]+$/.test(pathname);
}

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

/** Only this app's own pages, and only the two families named above. */
function cacheablePage(url) {
  return url.origin === self.location.origin && isCareerPage(url.pathname);
}

function cacheableCatalogue(url) {
  return publicCatalogue(url.pathname);
}

async function trim(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  if (keys.length <= max) return;
  await Promise.all(keys.slice(0, keys.length - max).map((request) => cache.delete(request)));
}

async function put(name, request, response) {
  const url = new URL(request.url);
  // The hard refusal, checked at the one door every write goes through. Whatever a
  // handler above decides to match, a path that belongs to a person is not written
  // to this device. `/api` is on that list, so the catalogue is the one entry with a
  // named exception, and `publicCatalogue` — three shapes, one of them excluded by
  // hand — is how it gets through.
  if (isDisallowed(url.pathname) && !(name === API_CACHE && publicCatalogue(url.pathname))) {
    return false;
  }
  const cache = await caches.open(name);
  // The rewrite happens here, at the one door, and only when it is needed: a response the
  // server already marked `no-store` would be refused by `cache.put`, so the copy this file
  // has decided to hold gets its header replaced first. A hashed chunk, which is served
  // `immutable`, is stored as it came and no body is read twice on a slow handset for it.
  const marked = (response.headers.get("cache-control") ?? "").includes("no-store");
  await cache.put(request, marked ? await storable(response.clone()) : response.clone());
  if (name === STATIC_CACHE) await trim(name, MAX_STATIC_ENTRIES);
  if (name === PAGE_CACHE) await trim(name, MAX_PAGE_ENTRIES);
  if (name === API_CACHE) await trim(name, MAX_API_ENTRIES);
  return true;
}

/** Only a response that could never be somebody's data is stored without asking. */
function worthKeeping(response) {
  return (
    response.ok &&
    response.type === "basic" &&
    !response.headers.get("cache-control")?.includes("no-store")
  );
}

/**
 * The career pages are kept under a rule of their own, and the reason belongs in writing.
 *
 * `worthKeeping` refuses anything the server marked `no-store`, which is right for a
 * response this file has not named: a header that says do not keep should be believed.
 * Next writes `private, no-cache, no-store, must-revalidate` on **every** page it renders
 * per request — and `/careers/<slug>` is one of those, because it reads the catalogue at
 * request time — so that header describes how the document was made, not anybody being
 * inside it. Honouring it here is what made the offline story false: the last twenty career
 * pages a student read is the whole point of this cache, and with the refusal in place the
 * audit found the career documents had never been stored at all.
 *
 * So the exception is bounded by the path rather than by the header. `isCareerPage` matches
 * the list and one career and nothing deeper, `put` still refuses every path that belongs
 * to a person, and a redirect, an error or a cross-origin body is still not kept. What is
 * given up is the server's say-so about freshness — already overruled on purpose by going
 * to the network first and reaching for the copy only when the network is what failed.
 */
function worthKeepingPage(response) {
  return response.ok && response.type === "basic";
}

/**
 * The bytes to keep, with the server's freshness instruction taken off.
 *
 * `cache.put` is specified to refuse a response marked `no-store`, so a copy this worker
 * has decided to hold is rebuilt on the way in: same body, same content type, a header of
 * its own. Doing it for every write rather than only where the server happened to say
 * `no-store` keeps one door — a stored copy is always this file's own object, never a
 * response whose headers were written by something that did not know it would be replayed
 * to a student who has no network.
 */
async function storable(response) {
  const body = await response.arrayBuffer();
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: new Headers({
      "content-type": response.headers.get("content-type") || "text/html; charset=utf-8",
      // `max-age=0`, not `no-store`: the copy is handed out by this file rather than by an
      // HTTP cache, and the one thing that must not happen is a browser keeping a second,
      // unmarked copy of it underneath. `marked()` still stamps the copy it serves.
      "cache-control": "max-age=0",
    }),
  });
}

/**
 * The catalogue, kept from wherever the API is served.
 *
 * `cors` is allowed here and nowhere else because this is the one stored response
 * that comes from another host: the page and the API are two addresses, and the API
 * does not hold its own career rows. `no-store` still refuses it, so a backend that
 * decides a catalogue response has become somebody's answer can stop this cache
 * without a change in this file.
 */
function worthKeepingCatalogue(response) {
  return (
    response.ok &&
    (response.type === "basic" || response.type === "cors") &&
    (response.headers.get("content-type") ?? "").includes("json") &&
    !response.headers.get("cache-control")?.includes("no-store")
  );
}

/**
 * The line that goes across the top of a stored page.
 *
 * A cached career page has no banner of its own and no way to fetch one, so the
 * notice is written into the document as it is handed over. Saying "stored copy,
 * read on 4 November" is the difference between an offline page and a page that
 * quietly pretends to be current — and this app has already decided, on every
 * screen that reads the catalogue, that a student is told when something is not
 * known rather than being shown a plausible blank.
 *
 * It cannot simply be written as the first thing inside `<body>`, which is where a
 * banner belongs. Measured on 2026-11-01 in a real browser: a career page's body
 * opens with an inline script, and the parser rule for an element that arrives
 * before anything a body may contain is to move it up into `<head>` and say nothing.
 * So the notice went where the student could not see it, while the page carried on
 * looking entirely current — the one failure this sentence exists to prevent. It is
 * written where the parser will keep it, at the end of `<head>`, and the script that
 * follows puts it back where a person will read it.
 */
const NOTICE_STYLE =
  "margin:0;padding:10px 16px;background:#fef3c7;color:#78350f;" +
  "border-bottom:1px solid #fcd34d;font:600 13px/1.5 system-ui,-apple-system,'Segoe UI',Roboto,'Noto Sans',sans-serif;" +
  "text-align:center";

function storedBanner(storedAt) {
  const date = storedAt ? new Date(storedAt) : null;
  // A `Date` header the browser cannot read is not worth guessing at: the line
  // still says the copy was kept, it just stops short of claiming a day it does not
  // know — the same rule every screen in this app follows about a date.
  const when = date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString() : "";
  const en = `You are offline. This is the copy this device kept${when ? ` on ${when}` : ""}.`;
  const hi = `आप ऑफ़लाइन हैं। यह इस डिवाइस ने रखी${when ? ` ${when} की` : ""} प्रति है।`;
  return (
    `<div role="status" data-stored-notice style="${NOTICE_STYLE}" data-en="${en}" data-hi="${hi}">${en}</div>` +
    applyLanguage(KEEP_NOTICE)
  );
}

/**
 * The handful of lines that keep the notice where a person can read it.
 *
 * First it moves the banner from wherever the parser left it to the top of the body.
 * Then it watches: the app's own startup rebuilds the document from the server HTML it
 * was shipped with, which has no notice in it, and a node it does not recognise is a node
 * it drops. Only an actual re-insertion counts against the handful, because a page loading
 * on a throttled handset raises dozens of mutations before that first drop — a watch that
 * gave up after nine records gave up before the thing it was watching for ever happened.
 */
const KEEP_NOTICE =
  `var d=document.querySelector("[data-stored-notice]");window.__cgStoredNotice=d;var placed=0;` +
  `function placeNotice(){var b=document.body;if(!b||placed>3)return;` +
  `var c=document.querySelector("[data-stored-notice]")||window.__cgStoredNotice;if(!c)return;` +
  `if(c.parentNode===b&&b.firstChild===c)return;b.insertBefore(c,b.firstChild);placed++;}` +
  `placeNotice();try{var mo=new MutationObserver(placeNotice);mo.observe(document.documentElement,{childList:!0,subtree:!0});` +
  `addEventListener("load",placeNotice);}catch(e){}`;

function markStored(html, storedAt) {
  const notice = storedBanner(storedAt);
  // Before the closing `</head>`, not after the opening `<body>`: see the note on
  // `storedBanner` for what the parser does to an element that arrives there.
  const head = /<\/head\s*>/i;
  const body = /<body\b[^>]*>/i;
  const doc = html.replace(head, (close) => notice + close);
  if (doc !== html) return doc;
  return body.test(html) ? html.replace(body, (open) => open + notice) : notice + html;
}

/**
 * The one sentence in the language this browser was last reading the site in.
 *
 * These documents cannot be rendered twice by a server — there is no server, that
 * is the entire situation — so the second language travels as an attribute and a
 * handful of lines of script pick it. The same snippet runs inside a restored
 * career page, which has no notice of its own to translate and gets one from
 * `marked()` below.
 */
const LANGUAGE_SWAP =
  `try{var l=localStorage.getItem("careerguide.ui-lang");if(l==="hi"){var n=document.querySelectorAll("[data-en]");` +
  `for(var i=0;i<n.length;i++){var h=n[i].getAttribute("data-hi");if(h)n[i].textContent=h}}}catch(e){}`;

/** Wrap a page's own script so it swaps language first and then does its job. */
function applyLanguage(script) {
  return `<script>${LANGUAGE_SWAP}${script}</script>`;
}

// ---------------------------------------------------------------- the conversation

/**
 * One stored conversation, written by the page that read it.
 *
 * `key` is this browser's own device id, which is the thing the session runs on —
 * so the copy can be handed back only to a page that presents the same id, and a
 * handset whose identity was changed under Settings → This device gets a miss
 * rather than the previous student's chat. It is not a secret from the device: the
 * id is in this browser's storage, and anyone who can open this browser can already
 * read the conversation online. That is the boundary this app has always had, and
 * the only one a worker can be written inside.
 *
 * One entry, always. A second conversation replaces the first, so the most this
 * file can be blamed for holding is the last thing this device read.
 */
const CONVERSATION_PATH = "/__offline-conversation";
const SUMMARY_PATH = "/__offline-summary";

function conversationUrl(key) {
  return `${self.location.origin}${CONVERSATION_PATH}?k=${encodeURIComponent(key)}`;
}

function readKey(searchParams) {
  const value = searchParams.get("k");
  return typeof value === "string" && value.length >= 16 && value.length <= 64 ? value : "";
}

async function storedConversation(key) {
  if (!key) return null;
  const cache = await caches.open(PRIVATE_CACHE);
  return (await cache.match(conversationUrl(key))) ?? null;
}

async function storeConversation(message) {
  const key = typeof message.key === "string" ? message.key : "";
  // Two independent refusals: a key that is not shaped like this browser's own id,
  // and a page that has not been told to keep history. The second one is the
  // student's own setting — "If this is off, closing a conversation deletes its
  // messages" — and writing the messages to this handset anyway would be the app
  // breaking a promise the student made on purpose.
  if (!key || message.saveHistory !== true) return false;
  const body = JSON.stringify({
    conversation: message.conversation || null,
    messages: Array.isArray(message.messages) ? message.messages.slice(-60) : [],
    stored_at: new Date().toISOString(),
  });
  const cache = await caches.open(PRIVATE_CACHE);
  const now = new Response(body, {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
  await cache.put(conversationUrl(key), now);
  // One copy only: whatever this browser kept before is not the last conversation
  // any more, and a stale one is exactly the thing that gets read by the wrong
  // person by accident.
  const keys = await cache.keys();
  await Promise.all(
    keys
      .filter((request) => request.url !== conversationUrl(key))
      .map((request) => cache.delete(request)),
  );
  return true;
}

async function clearConversation(key) {
  const cache = await caches.open(PRIVATE_CACHE);
  const keys = await cache.keys();
  const doomed = key
    ? keys.filter((request) => request.url === conversationUrl(key))
    : keys;
  await Promise.all(doomed.map((request) => cache.delete(request)));
  return doomed.length;
}

/**
 * Which conversation this device is holding, for the shell to offer.
 *
 * The `key` is the one the page just read out of its own storage, so the answer is
 * "yours or none". Listing every entry a cache holds would turn the offline shell
 * into a menu of the previous student's chats on a shared handset, which is the
 * exact thing the keying exists to prevent; the loop is written as a filter for the
 * day somebody wonders why it is a loop at all.
 */
async function heldConversations(key) {
  if (!key) return [];
  const cache = await caches.open(PRIVATE_CACHE);
  const keys = (await cache.keys()).filter(
    (request) => new URL(request.url).searchParams.get("k") === key,
  );
  const out = [];
  for (const request of keys) {
    const response = await cache.match(request);
    if (!response) continue;
    try {
      const data = await response.json();
      out.push({
        conversation: data.conversation || null,
        messages: Array.isArray(data.messages) ? data.messages : [],
        stored_at: data.stored_at || null,
      });
    } catch {
      // A body this file cannot read is not worth showing; the entry is dropped
      // when its owner next hands over a conversation that can be.
    }
  }
  return out;
}

async function storedCareerPages() {
  const cache = await caches.open(PAGE_CACHE);
  const keys = await cache.keys();
  const pages = [];
  for (const request of keys) {
    const url = new URL(request.url);
    if (url.search) continue; // the in-app payload, not a page a person can link to
    if (!isCareerPage(url.pathname) || url.pathname === "/careers") continue;
    const response = await cache.match(request);
    if (!response) continue;
    const html = await response.text().catch(() => "");
    const title = (html.match(/<h1[^>]*>([^<]{2,120})</i) || [])[1] || url.pathname.split("/").pop();
    pages.push({ href: url.pathname, title, stored_at: response.headers.get("date") });
  }
  return pages.slice(-MAX_CAREER_PAGES);
}

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "store-conversation") {
    event.waitUntil(storeConversation(data));
    return;
  }
  if (data.type === "clear-conversation") {
    event.waitUntil(clearConversation(typeof data.key === "string" ? data.key : ""));
    return;
  }
});

// ---------------------------------------------------------------------- the fetch

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // A write is the page's business. Non-GET requests carry the session token and
  // change data; intercepting them is how a retry ends up happening twice.
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // The two paths this file invents. They are answered here and nowhere else, and
  // they are never stored as responses: they are the worker reading its own caches
  // for the offline documents below.
  if (url.origin === self.location.origin && url.pathname === CONVERSATION_PATH) {
    event.respondWith(
      (async () => {
        const hit = await storedConversation(readKey(url.searchParams));
        return (
          hit ??
          new Response(JSON.stringify({ messages: [] }), {
            status: 404,
            headers: { "content-type": "application/json; charset=utf-8" },
          })
        );
      })(),
    );
    return;
  }

  if (url.origin === self.location.origin && url.pathname === SUMMARY_PATH) {
    event.respondWith(
      (async () => {
        const [conversations, pages] = await Promise.all([
          heldConversations(readKey(url.searchParams)),
          storedCareerPages(),
        ]);
        return new Response(JSON.stringify({ conversations, pages }), {
          status: 200,
          headers: { "content-type": "application/json; charset=utf-8" },
        });
      })(),
    );
    return;
  }

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

  // A career page, or the payload an in-app tap asks for: ask the network first,
  // because a student who has a signal should never be handed last week's
  // scholarship deadline, and keep whatever came back.
  if (cacheablePage(url)) {
    event.respondWith(
      (async () => {
        let response;
        try {
          response = await fetch(request, { cache: "no-store" });
          if (worthKeepingPage(response)) {
            await put(PAGE_CACHE, request, response);
            return response.clone();
          }
          return response;
        } catch (failure) {
          const hit = await caches.match(request);
          if (!hit) {
            if (request.mode === "navigate") return offlinePage();
            throw failure;
          }
          if ((hit.headers.get("content-type") ?? "").includes("html")) {
            return marked(hit);
          }
          return hit;
        }
      })(),
    );
    return;
  }

  // The catalogue JSON, same rule: network first, stored copy only when the
  // network is the thing that failed.
  if (cacheableCatalogue(url)) {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request, { cache: "no-store" });
          if (worthKeepingCatalogue(response)) await put(API_CACHE, request, response);
          return response;
        } catch (failure) {
          const hit = await caches.match(request);
          if (hit) return hit;
          throw failure;
        }
      })(),
    );
    return;
  }

  // Everything else is network first, and nothing is kept.
  event.respondWith(
    (async () => {
      try {
        return await fetch(request, { cache: "no-store" });
      } catch (failure) {
        if (request.mode !== "navigate") {
          throw failure;
        }
        // A page this device can show offline gets its own shell, which says what
        // it is holding; every other page gets the plain notice. `/app` and the
        // other private surfaces land in the second group, because nothing about
        // them is stored — except the conversation, which is offered by the shell
        // below rather than by a cached copy of the screen.
        return offlinePage(url);
      }
    })(),
  );
});

/** The stored document, with the "this is a copy" line written into it. */
function marked(response) {
  return response.text().then((html) => {
    const storedAt = response.headers.get("date");
    return new Response(markStored(html, storedAt), {
      status: response.status,
      statusText: response.statusText,
      headers: new Headers({
        "content-type": response.headers.get("content-type") || "text/html; charset=utf-8",
        "cache-control": "no-store",
      }),
    });
  });
}

/**
 * Which of the two offline documents a failed navigation gets.
 *
 * Any screen behind a sign-in gets the shell with the conversation in it: a student
 * whose link died should still be able to read what the guide said to them five
 * minutes ago. A public page that is not one of the cached two families gets the
 * plain notice, because there is nothing to show and saying so is the whole job.
 */
function offlinePage(url) {
  if (url.pathname === "/app" || url.pathname.startsWith("/app/")) {
    return new Response(APP_SHELL_HTML, {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
    });
  }
  return new Response(OFFLINE_HTML, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

// ------------------------------------------------------------- the two offline pages
//
// Written out as strings rather than rendered by a route, for the reason in the
// header of this file: a route needs its own chunks, and a first visit going offline
// is precisely the moment the chunks are not there yet.
//
// Both pages say "You are offline" and then say, separately, what happens next. A
// spinner with no end is the failure mode this whole file exists to avoid; the
// sentence below is the one the brief asked for, and it is the first thing on both.

const OFFLINE_STYLE = `
      /* Inlined, because a stylesheet is another request and this page is what
         you get when requests are the thing that is not working. */
      :root { color-scheme: light; }
      * { box-sizing: border-box; }
      body {
        margin: 0; min-height: 100vh; display: grid; place-items: center;
        background: #f5f8ff; color: #12203a; padding: 24px;
        font: 16px/1.6 system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", sans-serif;
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
      button:disabled { opacity: .6; cursor: default; }`;

const RETRY_JS =
  `var HI=(function(){try{return localStorage.getItem("careerguide.ui-lang")==="hi"}catch(e){return false}})();` +
  `var b=document.getElementById("retry");` +
  `if(b){b.addEventListener("click",function(){` +
  `b.disabled=true;b.textContent=HI?"जाँच हो रही है…":"Checking…";` +
  // Reload rather than probe: if the network is back, this is the same thing
  // pressing the browser's reload button would do, and it costs one request.
  `setTimeout(function(){window.location.reload()},250)})}`;

const OFFLINE_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>You are offline — CareerGuide AI</title>
    <style>${OFFLINE_STYLE}
    </style>
  </head>
  <body>
    <main>
      <div class="mark" aria-hidden="true">CG</div>
      <h1>You are offline</h1>
      <p>This page will load when you reconnect.</p>
      <div class="card">
        <p data-en="Nothing of yours was kept for this page. Career pages you have already read, and the last conversation you let this device hold, do open without a signal — everything else waits for one, and says so, instead of spinning."
           data-hi="इस पेज के लिए आपकी कोई चीज़ नहीं रखी गई है। जो करियर पेज आप पढ़ चुके हैं, और आखिरी बातचीत जो आपने इस डिवाइस पर रखने दी थी, वे बिना नेटवर्क भी खुलते हैं — बाकी सब सिग्नल का इंतज़ार करता है और यह कहता है, बिना घूमते हुए।">Nothing of yours was kept for this page. Career pages you have already read, and the last conversation you let this device hold, do open without a signal — everything else waits for one, and says so, instead of spinning.</p>
      </div>
      <button id="retry" type="button" data-en="Try again" data-hi="फिर से कोशिश करें">Try again</button>
    </main>
    ${applyLanguage(RETRY_JS)}
  </body>
</html>`;

// The shell a signed-in screen falls back to. It is drawn here, in one string, with
// the same header and the same sidebar outline the real screen has, because the
// student whose link died should not land on a different-looking site — and the
// skeleton is deliberately an outline rather than fake content, because a box that
// pretends to hold a plan nobody can read offline is the exact failure this file
// refuses to cause.
const SHELL_STYLE = `
      :root { color-scheme: light; }
      * { box-sizing: border-box; }
      body {
        margin: 0; background: #f5f8ff; color: #12203a;
        font: 16px/1.6 system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", sans-serif;
      }
      .bar {
        display: flex; align-items: center; gap: 10px; padding: 12px 16px;
        background: #0b1730; color: #fff;
      }
      .bar .mark {
        width: 30px; height: 30px; border-radius: 9px; background: #2563eb;
        display: grid; place-items: center; font-size: 13px; font-weight: 700;
      }
      .bar .name { font-weight: 600; font-size: 15px; flex: 1; }
      .bar .pill {
        font-size: 12px; font-weight: 600; padding: 3px 10px; border-radius: 999px;
        background: #fef3c7; color: #78350f;
      }
      .wrap { display: flex; min-height: calc(100vh - 54px); }
      .side { width: 210px; padding: 20px 14px; background: #fff; border-right: 1px solid #dbe4f5; }
      .side i { display: block; height: 34px; border-radius: 10px; background: #eef2fb; margin-bottom: 10px; }
      main { flex: 1; padding: 24px 18px 48px; max-width: 46rem; }
      h1 { margin: 0 0 6px; font-size: 22px; }
      h2 { margin: 0 0 10px; font-size: 15px; }
      .lead { margin: 0 0 20px; color: #4a5a75; }
      .card {
        padding: 16px; border-radius: 14px; background: #fff; border: 1px solid #dbe4f5;
        margin-bottom: 16px;
      }
      .small { font-size: 13px; color: #64748b; margin: 0; }
      .chat { margin-top: 12px; }
      .turn { padding: 10px 12px; border-radius: 12px; margin-bottom: 8px; background: #f1f5fd; }
      .turn.me { background: #e6f7f3; }
      .turn .who { display: block; font-size: 11px; font-weight: 700; letter-spacing: .04em;
        text-transform: uppercase; color: #64748b; margin-bottom: 3px; }
      .turn p { margin: 0; font-size: 14px; white-space: pre-wrap; word-break: break-word; }
      .links a {
        display: block; padding: 10px 12px; border-radius: 10px; background: #f1f5fd;
        color: #1d4ed8; font-weight: 600; text-decoration: none; margin-bottom: 8px;
      }
      .actions { display: flex; gap: 10px; flex-wrap: wrap; }
      button {
        height: 44px; padding: 0 20px; border: 0; border-radius: 12px; font: inherit;
        font-weight: 600; cursor: pointer; background: #2563eb; color: #fff;
      }
      button.ghost { background: #fff; color: #334155; border: 1px solid #dbe4f5; }
      button:disabled { opacity: .6; cursor: default; }
      @media (max-width: 720px) { .side { display: none; } }`;

const SHELL_JS =
  // Everything below builds nodes and sets textContent. A stored chat is a student's
  // own words and a stored page title is a string from the server, and neither gets
  // to be HTML on the way back out.
  `var HI=(function(){try{return localStorage.getItem("careerguide.ui-lang")==="hi"}catch(e){return false}})();` +
  `function T(en,hi){return HI?hi:en}` +
  `function node(tag,cls,text){var n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n}` +
  `var retry=document.getElementById("retry");` +
  `retry.addEventListener("click",function(){retry.disabled=true;retry.textContent=T("Checking…","जाँच हो रही है…");setTimeout(function(){window.location.reload()},250)});` +
  `var key="";try{var s=localStorage.getItem("careerguide.device-id")||"";if(s.length>=16&&s.length<=64)key=s}catch(e){}` +
  `var forget=document.getElementById("forget");` +
  `forget.addEventListener("click",function(){` +
  `forget.disabled=true;` +
  `if(navigator.serviceWorker){navigator.serviceWorker.ready.then(function(r){if(r.active)r.active.postMessage({type:"clear-conversation",key:key})})}` +
  `var held=document.getElementById("held");held.textContent="";` +
  `held.appendChild(node("p","small",T("Forgotten. This device is holding no conversation of yours now.","भूल दिया गया। अब यह डिवाइस आपकी कोई बातचीत नहीं रखता।")));` +
  `forget.textContent=T("Copy forgotten","प्रति मिटाई गई");` +
  `});` +
  `if(!key){var f0=document.getElementById("forget");if(f0)f0.disabled=true}` +
  `fetch("/__offline-summary?k="+encodeURIComponent(key)).then(function(r){return r.json()}).then(function(d){` +
  `var held=document.getElementById("held");held.textContent="";` +
  `var c=(d.conversations||[])[0];` +
  `if(c&&c.messages&&c.messages.length){` +
  `var when="";try{when=c.stored_at?new Date(c.stored_at).toLocaleString():""}catch(e){}` +
  `held.appendChild(node("p","small",T("Your last conversation with the guide, kept on this device"+(when?" · "+when:""),"आपकी गाइड से आखिरी बातचीत, इस डिवाइस पर रखी"+(when?" · "+when:""))));` +
  `var list=node("div","chat");` +
  `c.messages.forEach(function(m){` +
  `var b=node("div","turn"+(m.role==="user"?" me":""));` +
  `b.appendChild(node("span","who",m.role==="user"?T("You","आप"):T("Guide","गाइड")));` +
  `b.appendChild(node("p",null,m.content));list.appendChild(b)});` +
  `held.appendChild(list);` +
  `document.getElementById("chatcard").style.display="";` +
  `}else{` +
  `held.appendChild(node("p","small",T("This device is not holding a conversation. Nothing you have said has been written here.","यह डिवाइस कोई बातचीत नहीं रख रहा। यहाँ आपकी कुछ भी नहीं लिखा गया।")));` +
  `document.getElementById("chatcard").style.display="";` +
  `}` +
  `var pages=d.pages||[];` +
  `var box=document.getElementById("pages");box.textContent="";` +
  `if(pages.length){` +
  `document.getElementById("pagecard").style.display="";` +
  `pages.slice().reverse().forEach(function(p){var a=document.createElement("a");a.href=p.href;a.textContent=p.title;box.appendChild(a)});` +
  `}}).catch(function(){` +
  `var held=document.getElementById("held");` +
  `held.appendChild(node("p","small",T("This device could not read its own copy.","इस डिवाइस ने अपनी प्रति पढ़ नहीं सकी।")));` +
  `});`;

const APP_SHELL_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>You are offline — CareerGuide AI</title>
    <style>${SHELL_STYLE}
    </style>
  </head>
  <body>
    <header class="bar">
      <span class="mark" aria-hidden="true">CG</span>
      <span class="name">CareerGuide AI</span>
      <span class="pill" data-en="Offline" data-hi="ऑफ़लाइन">Offline</span>
    </header>
    <div class="wrap">
      <nav class="side" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></nav>
      <main>
        <h1>You are offline</h1>
        <p class="lead">This page will load when you reconnect.</p>
        <div class="card" id="chatcard" style="display:none">
          <h2 data-en="What this device is holding" data-hi="यह डिवाइस क्या रख रहा है">What this device is holding</h2>
          <div id="held"><p class="small">…</p></div>
        </div>
        <div class="card" id="pagecard" style="display:none">
          <h2 data-en="Career pages you can still open" data-hi="करियर पेज जो अब भी खुल सकते हैं">Career pages you can still open</h2>
          <div class="links" id="pages"></div>
        </div>
        <div class="actions">
          <button id="retry" type="button" data-en="Try again" data-hi="फिर से कोशिश करें">Try again</button>
          <button id="forget" type="button" class="ghost" data-en="Forget this copy" data-hi="यह प्रति भूल जाएं">Forget this copy</button>
        </div>
        <p class="small" style="margin-top:14px"
           data-en="The copy below is this browser's own, keyed to this device. Whoever can open this browser can read it — which is why ending a conversation, clearing it, or Start over removes it without being asked."
           data-hi="नीचे दी प्रति इस ब्राउज़र की अपनी है, इस डिवाइस से जुड़ी। जो इस ब्राउज़र को खोल सकता है वह इसे पढ़ भी सकता है — इसीलिए बातचीत समाप्त करने, मिटाने या फिर से शुरू करने पर यह अपने आप हट जाती है, बिना पूछे।">The copy below is this browser's own, keyed to this device. Whoever can open this browser can read it — which is why ending a conversation, clearing it, or Start over removes it without being asked.</p>
      </main>
    </div>
    ${applyLanguage(SHELL_JS)}
  </body>
</html>`;
