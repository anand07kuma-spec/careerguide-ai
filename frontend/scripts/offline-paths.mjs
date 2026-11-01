// What the service worker is allowed to keep on a family's phone, checked on the
// machine that builds the app rather than on the phone.
//
// `public/sw.js` is plain JavaScript served verbatim out of `public/`, so `tsc` and
// `eslint` never look at it and a broken line in it is only found by somebody going
// offline. Worse than a crash: the privacy list it holds is a *copy* of
// `DISALLOWED_PATHS` in `src/lib/site.ts`, because a worker cannot import anything.
// Two copies of a privacy list in one repository drift, and this one decides what
// stays on a shared handset after the student has gone back to school. So this file
// loads the worker into a sandbox with a fake Cache API, asks it the questions that
// matter, and fails the build when the answer is wrong.
//
// Run from `frontend/`:  node scripts/offline-paths.mjs
import { readFileSync } from "node:fs";
import vm from "node:vm";

const ORIGIN = "https://careerguide.localhost";
const src = readFileSync("public/sw.js", "utf8");

// --- a Cache API small enough to reason about -----------------------------------
const caches = new Map();
function store(name) {
  if (!caches.has(name)) caches.set(name, new Map());
  const bucket = caches.get(name);
  return {
    put: async (req, res) => {
      const url = typeof req === "string" ? req : req.url;
      bucket.set(url, { headers: res.headers, body: await res.clone().text() });
    },
    match: async (req) => {
      const url = typeof req === "string" ? req : req.url;
      const hit = bucket.get(url);
      return hit ? new Response(hit.body, { headers: hit.headers }) : undefined;
    },
    delete: async (req) => {
      bucket.delete(typeof req === "string" ? req : req.url);
      return true;
    },
    keys: async () => [...bucket.keys()].map((url) => ({ url })),
  };
}

const sandbox = {
  self: {
    location: { origin: ORIGIN },
    addEventListener: () => {},
    skipWaiting: () => {},
    clients: { claim: async () => {} },
  },
  caches: {
    open: async (name) => store(name),
    keys: async () => [...caches.keys()],
    delete: async (name) => {
      const bucket = caches.get(name);
      if (bucket) bucket.clear();
      caches.delete(name);
      return true;
    },
  },
  Response,
  Request,
  Headers,
  URL,
  fetch: async () => {
    throw new Error("this check never has a network");
  },
  console,
};

vm.runInContext(
  src +
    `;globalThis.__out={OFFLINE_HTML,APP_SHELL_HTML,markStored,storeConversation,clearConversation,
heldConversations,put,isDisallowed,publicCatalogue,offlinePage,DISALLOWED_PATHS,
PRIVATE_CACHE,PAGE_CACHE,API_CACHE,LANGUAGE_SWAP};`,
  vm.createContext(sandbox)
);
const w = vm.__out ?? sandbox.__out;

let failures = 0;
function check(ok, label) {
  if (!ok) {
    failures += 1;
    console.log("FAIL " + label);
  }
}

// --- the privacy list is the app's list ----------------------------------------
const site = readFileSync("src/lib/site.ts", "utf8");
const declared = [...site.matchAll(/^ {2}"\/([^"]*)",$/gm)].map((m) => "/" + m[1]);
check(declared.length > 0, "could not read DISALLOWED_PATHS out of src/lib/site.ts");
check(
  declared.join(" ") === w.DISALLOWED_PATHS.join(" "),
  "sw.js and site.ts disagree about which paths are private\n" +
    "  sw.js:   " + JSON.stringify(w.DISALLOWED_PATHS) + "\n" +
    "  site.ts: " + JSON.stringify(declared)
);

// --- a person's surface is refused, a public one is not -------------------------
for (const path of [
  "/app", "/app/chat", "/app/settings", "/parent/1", "/admin", "/school", "/counsellor",
  "/join", "/welcome", "/onboarding", "/sign-in", "/sign-up", "/account/profile",
  "/api", "/api/conversations/9/messages", "/api/me", "/api/assessments/results",
]) {
  check(w.isDisallowed(path), "isDisallowed lets " + path + " through");
}
for (const path of ["/", "/careers", "/careers/cobbler", "/blog", "/privacy"]) {
  check(!w.isDisallowed(path), "isDisallowed over-reaches to " + path);
}

// The catalogue is the one named exception, and `/api/careers/saved` is the one row
// inside it that belongs to somebody.
for (const path of ["/api/careers", "/api/careers/categories", "/api/careers/cobbler"]) {
  check(w.publicCatalogue(path), "publicCatalogue refuses the public row " + path);
}
check(!w.publicCatalogue("/api/careers/saved"), "publicCatalogue treats a students saved list as public");
check(!w.publicCatalogue("/api/conversations/9/messages"), "publicCatalogue reaches into conversations");

// `put` is the only door into a cache, so it is where the refusal has to bite.
const reqOf = (path) => new Request(ORIGIN + path);
const jsonOf = (body) => new Response(body, { headers: { "content-type": "application/json" } });
for (const path of ["/app/chat", "/api/conversations/9/messages", "/parent/1", "/admin"]) {
  for (const cache of [w.PAGE_CACHE, w.API_CACHE]) {
    check(
      !(await w.put(cache, reqOf(path), jsonOf("{}"))),
      "put() wrote " + path + " into the " + cache + " cache"
    );
  }
}
check(await w.put(w.API_CACHE, reqOf("/api/careers"), jsonOf("[]")), "put() refuses the public catalogue it exists to keep");
check(await w.put(w.PAGE_CACHE, reqOf("/careers/cobbler"), jsonOf("<h1>Cobbler</h1>")), "put() refuses a career page");

// --- one conversation, handed over by the page that read it ---------------------
const KEY = "a".repeat(32);
const OTHER = "b".repeat(32);
const handOver = (key, messages, saveHistory) => ({
  type: "store-conversation",
  key,
  saveHistory,
  conversation: { id: 9 },
  messages,
});
check(
  !(await w.storeConversation(handOver(KEY, [{ role: "user", content: "x" }], false))),
  "the worker stored a conversation while the student had said do not keep history"
);
check(
  !(await w.storeConversation(handOver("", [{ role: "user", content: "x" }], true))),
  "the worker stored a conversation with no device to keep it for"
);
check(
  await w.storeConversation(handOver(KEY, [{ role: "user", content: "x" }], true)),
  "the worker refused a conversation its own page handed over"
);
check((await w.heldConversations(KEY)).length === 1, "the owner cannot read the copy this device holds");
check((await w.heldConversations(OTHER)).length === 0, "another device id on this handset is handed the first students chat");
check((await w.heldConversations("")).length === 0, "a page with no device id is handed a chat");
await w.storeConversation(handOver(OTHER, [{ role: "user", content: "y" }], true));
check((caches.get(w.PRIVATE_CACHE)?.size ?? 0) === 1, "the private cache keeps more than the last conversation");
check((await w.heldConversations(OTHER)).length === 1, "the newest hand-over did not become the copy on this device");
const many = Array.from({ length: 200 }, (_, i) => ({ role: "user", content: String(i) }));
await w.storeConversation(handOver(KEY, many, true));
const [held] = await w.heldConversations(KEY);
check(held && held.messages.length === 60, "the worker kept " + (held?.messages.length ?? 0) + " messages; the cap is 60");
check(held && held.messages[0].content === "140", "the cap kept the oldest 60 instead of the last 60");
await w.clearConversation(KEY);
check((await w.heldConversations(KEY)).length === 0, "clearing left a conversation on this device");

// --- the offline pages say the thing the brief asked for ------------------------
for (const [name, html] of [["offline", w.OFFLINE_HTML], ["shell", w.APP_SHELL_HTML]]) {
  check(/You are offline/.test(html), "the " + name + " page has no headline");
  check(/will load when you reconnect/.test(html), "the " + name + " page does not promise a reconnect");
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  check(scripts.length > 0, "the " + name + " page shipped no script");
  for (const body of scripts) {
    try {
      new vm.Script(body);
    } catch (error) {
      check(false, "the " + name + " pages script does not parse: " + error.message);
    }
  }
  // A sentence with no Hindi half is a page that lies about being bilingual.
  const en = (html.match(/data-en=/g) || []).length;
  const hi = (html.match(/data-hi=/g) || []).length;
  check(en === hi, "the " + name + " page has " + en + " English lines and " + hi + " Hindi halves");
  check(!/\\u0[0-9a-f]{3}/.test(html), "the " + name + " page writes Devanagari as escape text");
  check(!/\$\{/.test(html), "the " + name + " page ships an unrendered template hole");
}
// Not one byte of an origin: the worker is served from whatever host this is on.
check(!/https?:\/\//.test(src), "sw.js names an absolute origin; it must work from any host");

// A restored page carries the stored-copy notice, in both languages, and is still
// the page.
const marked = w.markStored("<html><body><h1>Cobbler</h1></body></html>", new Date().toUTCString());
check(/role="status"/.test(marked), "a restored career page is served with no sign it is a copy");
check(/data-hi=/.test(marked), "the stored-copy notice has no Hindi half");
check(/<h1>Cobbler<\/h1>/.test(marked), "marking a restored page destroyed the page");
check(!/Invalid Date/.test(w.markStored("<html><body></body></html>", "not a date")), "the stored-copy notice prints Invalid Date");

// --- which fallback a dead navigation gets --------------------------------------
const shell = await w.offlinePage(new URL(ORIGIN + "/app/chat"));
check((await shell.text()) === w.APP_SHELL_HTML, "an offline /app visit did not get the shell");
check(shell.headers.get("cache-control") === "no-store", "an offline document is itself cacheable");
check(
  (await (await w.offlinePage(new URL(ORIGIN + "/blog"))).text()) === w.OFFLINE_HTML,
  "an offline public page did not get the plain notice"
);

if (failures) {
  console.log(`offline paths: ${failures} problem(s)`);
  process.exit(1);
}
console.log(
  "offline paths ok | private prefixes " + w.DISALLOWED_PATHS.length +
    " | caches " + [w.PRIVATE_CACHE, w.PAGE_CACHE, w.API_CACHE].length +
    " | offline documents " + (w.OFFLINE_HTML.length + w.APP_SHELL_HTML.length) + " bytes"
);
