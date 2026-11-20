#!/usr/bin/env node
/**
 * The four public catalogue routes, against a real `next start`.
 *
 * Cache Components sends the prerendered shell before a page's own data check
 * runs, so `notFound()` inside those pages can only paint a 200. The status has
 * to be decided in the proxy, and this script is the proof that it is: it starts
 * the production build against a stub API, then asks for both kinds of URL and
 * asserts the status code — 404 for a slug no catalogue lists, 200 for one it
 * does. The blog is read from the real files on disk, so that row is the whole
 * path rather than a fixture.
 *
 * A second server is started with the API unreachable. Nothing there may be
 * rewritten: if the catalogue cannot be read, the page must still answer, and an
 * unknown slug is then the page's own (streamed, noindexed) not-found screen.
 * That is the availability guarantee — a bad minute at the API must not turn
 * every career profile into a 404.
 *
 * Run with `npm run test:routes`, after `npm run build`.
 */
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const nextBin = require.resolve("next/dist/bin/next");

const career = {
  id: 1,
  slug: "data-science",
  title: "Data science",
  category: "Technology",
  summary: "A stub profile used only to prove the route answers.",
  interest_themes: [],
  min_class: 9,
  typical_activities: [],
  useful_skills: [],
  school_subjects: [],
  education_pathways: [],
  entry_requirements: [],
  preparation_stages: [],
  typical_day: null,
  costs_and_alternatives: null,
  benefits: [],
  challenges: [],
  explore_activities: [],
  official_links: [],
  related_slugs: [],
  needs_verification: false,
  source_url: null,
  verified_at: null,
};

const country = {
  slug: "united-states",
  name: "United States",
  code: "US",
  overview: "A stub destination used only to prove the route answers.",
  language_note: null,
  intake_note: null,
  cost_note: null,
  work_after_note: null,
  to_check: [],
  visa_portal_url: null,
  visa_portal_label: null,
  qualifications_portal_url: null,
  qualifications_portal_label: null,
  checked_at: null,
  sort_order: 1,
};

const service = {
  slug: "profile-building",
  title: "Profile building",
  summary: "A stub service used only to prove the route answers.",
  detail: null,
  steps: [],
  includes: [],
  not_included: [],
  who_for: null,
  fees_note: null,
  available: true,
  sort_order: 1,
};

/** Exactly the catalogue lists the proxy reads; nothing else is elaborated. */
const catalogue = {
  "/api/careers": [career],
  "/api/study-abroad/countries": [country],
  "/api/study-abroad/services": [service],
};

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

function startStub() {
  const server = createServer((request, response) => {
    const { pathname } = new URL(request.url, "http://stub");
    const body = catalogue[pathname];
    response.setHeader("content-type", "application/json");
    if (body) {
      response.end(JSON.stringify(body));
    } else {
      response.statusCode = 404;
      response.end(JSON.stringify({ detail: "Not Found" }));
    }
  });
  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function startApp(port, backend) {
  const child = spawn(process.execPath, [nextBin, "start", "-p", String(port)], {
    cwd: root,
    env: {
      ...process.env,
      BACKEND_INTERNAL_URL: backend,
      NEXT_PUBLIC_BACKEND_URL: backend,
      NEXT_PUBLIC_SITE_URL: `http://127.0.0.1:${port}`,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (chunk) => (output += chunk));
  child.stderr.on("data", (chunk) => (output += chunk));
  return { child, read: () => output };
}

async function waitFor(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/robots.txt`, {
        signal: AbortSignal.timeout(2000),
      });
      if (res.status < 500) return;
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`the server on port ${port} did not answer within ${timeoutMs}ms`);
}

async function status(port, route) {
  const res = await fetch(`http://127.0.0.1:${port}${route}`, {
    redirect: "manual",
    signal: AbortSignal.timeout(15000),
  });
  return { status: res.status, body: await res.text() };
}

let failures = 0;

function check(name, actual, expected) {
  const ok = actual === expected;
  if (!ok) failures += 1;
  console.log(`${ok ? "ok  " : "FAIL"}  ${name}: ${actual} (expected ${expected})`);
}

async function runAgainst(port, backend) {
  const app = startApp(port, backend);
  try {
    await waitFor(port, 60000);
    return app;
  } catch (error) {
    console.error(error.message);
    console.error(app.read().slice(-2000));
    app.child.kill();
    throw error;
  }
}

const stub = await startStub();
const stubPort = stub.address().port;
const appPort = await freePort();
const app = await runAgainst(appPort, `http://127.0.0.1:${stubPort}`);

try {
  const cases = [
    ["/careers/no-such-career", 404],
    ["/blog/no-such-post", 404],
    ["/study-abroad/narnia", 404],
    ["/study-abroad/services/nope", 404],
    // A listed slug is not rewritten. The stub has no detail row, so these pages
    // paint their own not-found screen — the point is that the status stays 200,
    // which is what a catalogue member must get even when one lookup fails.
    ["/careers/data-science", 200],
    ["/study-abroad/united-states", 200],
    ["/study-abroad/services/profile-building", 200],
    // Real markdown, real content.
    ["/blog/riasec-test-explained", 200],
    // The indexes whose single segment must not be mistaken for a slug.
    ["/careers", 200],
    ["/blog", 200],
    ["/study-abroad", 200],
    ["/study-abroad/services", 200],
  ];
  for (const [route, expected] of cases) {
    const { status: code } = await status(appPort, route);
    check(route, code, expected);
  }

  const missing = await status(appPort, "/careers/no-such-career");
  if (!missing.body.includes("part of CareerGuide AI")) {
    failures += 1;
    console.log("FAIL  the 404 body is not the site's not-found screen");
  }
} finally {
  app.child.kill();
  stub.close();
}

const deadPort = await freePort();
const failOpenPort = await freePort();
const offline = await runAgainst(failOpenPort, `http://127.0.0.1:${deadPort}`);

try {
  // The API cannot be reached, so no career may be rewritten: the page answers
  // with its own not-found screen. The blog list does not use the API, so its
  // check still holds.
  check(
    "/careers/no-such-career (API down)",
    (await status(failOpenPort, "/careers/no-such-career")).status,
    200,
  );
  check(
    "/blog/no-such-post (API down)",
    (await status(failOpenPort, "/blog/no-such-post")).status,
    404,
  );
} finally {
  offline.child.kill();
}

console.log(failures === 0 ? "routes: all checks passed" : `routes: ${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
