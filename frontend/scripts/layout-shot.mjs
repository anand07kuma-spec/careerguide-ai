// Screenshot one route at a chosen viewport and report its console errors.
//
// The interactive automated browser is pinned to a 510px CSS viewport, which
// means every `lg:` layout in this app goes unverified. This drives a real
// headless Chrome over CDP so phone and laptop widths can both be looked at.
//
//   CG_TOKEN=<session token> node scripts/layout-shot.mjs /app shot.png --width=1440
//   CG_THEME=dark CG_UI_LANG=hi node scripts/layout-shot.mjs /careers dark-hi.png
//
// The token is read from the environment and only ever written into the browser
// profile under a temp directory, which is deleted on the way out.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME =
  process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE = process.env.CG_URL ?? "http://careerguide.localhost:3000";
const TOKEN = process.env.CG_TOKEN ?? "";
// Devanagari labels are usually longer than their English sources, so the
// responsive sweep is run in both languages rather than only one.
const UI_LANG = process.env.CG_UI_LANG ?? "";
// The appearance is device-local, so a screenshot of the dark theme has to say so
// in the browser profile rather than through a header or a query string.
const THEME = process.env.CG_THEME ?? "";

const args = process.argv.slice(2);
const positional = args.filter((a) => !a.startsWith("--"));
const flag = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=")[1] : fallback;
};

const route = positional[0] ?? "/";
if (!route.startsWith("/")) {
  // Git Bash rewrites a leading-slash argument into a Windows path, which would
  // otherwise produce a blank page and a clean-looking report. Fail loudly.
  throw new Error(`route must start with "/", got ${JSON.stringify(route)} (export MSYS_NO_PATHCONV=1)`);
}
const out = positional[1] ?? "shot.png";
const width = Number(flag("width", 1440));
const height = Number(flag("height", 900));
const full = flag("full", "1") === "1";
const settle = Number(flag("settle", 4000));

if (!TOKEN) console.log("note: no CG_TOKEN, protected routes will redirect to the one question");

const profile = mkdtempSync(join(tmpdir(), "cg-shot-"));
const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    "--remote-debugging-port=0",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--hide-scrollbars",
    `--user-data-dir=${profile}`,
    "about:blank",
  ],
  { stdio: "ignore" },
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForPort() {
  const file = join(profile, "DevToolsActivePort");
  for (let i = 0; i < 80; i += 1) {
    try {
      const [port] = readFileSync(file, "utf8").split("\n");
      if (port) return Number(port);
    } catch {
      /* the file appears a moment after chrome starts */
    }
    await sleep(250);
  }
  throw new Error("chrome never wrote DevToolsActivePort");
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.onopen = () => resolve(ws);
    ws.onerror = (event) => reject(new Error(`websocket failed: ${event.message ?? url}`));
  });
}

const cleanup = () => {
  chrome.kill();
  try {
    rmSync(profile, { recursive: true, force: true, maxRetries: 6, retryDelay: 250 });
  } catch {
    /* a locked temp profile is not worth failing a screenshot over */
  }
};

try {
  const port = await waitForPort();
  const version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
  const ws = await connect(version.webSocketDebuggerUrl);

  let id = 0;
  const pending = new Map();
  const events = [];
  const errors = [];

  ws.onmessage = (raw) => {
    const msg = JSON.parse(raw.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
      return;
    }
    events.push(msg);
    if (msg.method === "Runtime.exceptionThrown") {
      errors.push(msg.params.exceptionDetails?.text ?? "uncaught exception");
    }
    if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
      errors.push((msg.params.args ?? []).map((a) => a.value ?? a.description ?? "").join(" "));
    }
  };

  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      id += 1;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params, sessionId }));
    });

  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  const call = (method, params) => send(method, params, sessionId);

  await call("Page.enable");
  await call("Runtime.enable");
  await call("Log.enable");
  await call("Network.enable");

  const goto = async (url) => {
    await call("Page.navigate", { url });
    for (let i = 0; i < 120; i += 1) {
      await sleep(250);
      const { result } = await call("Runtime.evaluate", {
        expression: "document.readyState",
        returnByValue: true,
      });
      if (result.value === "complete") return;
    }
    throw new Error(`page never finished loading: ${url}`);
  };

  const mobile = width < 700;
  await call("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile,
  });
  // `--media=print` renders the page through the print stylesheet, which is the
  // only way to see what a parent would get from Ctrl+P on a legal page.
  const media = flag("media", "");
  if (media) await call("Emulation.setEmulatedMedia", { media });

  // Give the page its origin first so localStorage lands on the right host.
  await goto(`${BASE}/onboarding`);
  await sleep(400);
  if (TOKEN) {
    await call("Runtime.evaluate", {
      expression: `localStorage.setItem('careerguide.token', ${JSON.stringify(TOKEN)})`,
    });
  }
  if (UI_LANG) {
    await call("Runtime.evaluate", {
      expression: `localStorage.setItem('careerguide.ui-lang', ${JSON.stringify(UI_LANG)})`,
    });
  }
  if (THEME) {
    await call("Runtime.evaluate", {
      expression: `localStorage.setItem('careerguide.theme', ${JSON.stringify(THEME)})`,
    });
  }
  await goto(`${BASE}${route.startsWith("/") ? route : `/${route}`}`);
  await sleep(settle);

  const shot = await call("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: full,
  });
  writeFileSync(out, Buffer.from(shot.data, "base64"), "binary");

  // A clipped button reads as a design choice in a screenshot and is invisible in
  // a console, so the page is asked directly whether it is wider than its window.
  const overflow = await call("Runtime.evaluate", {
    expression: `(() => {
      const w = window.innerWidth;
      const wide = document.documentElement.scrollWidth;
      const culprits = [...document.querySelectorAll('body *')]
        .filter((el) => el.getBoundingClientRect().right > w + 1)
        .slice(0, 3)
        .map((el) => el.tagName.toLowerCase() + '.' + (el.className.toString().split(' ')[0] || '?'));
      return JSON.stringify({ wide, w, culprits });
    })()`,
    returnByValue: true,
  });
  const { wide, w, culprits } = JSON.parse(overflow.result.value);
  const overflowing = wide > w + 1;

  const failed = events.filter(
    (e) => e.method === "Network.loadingFailed" && e.params?.errorText && !/aborted/i.test(e.params.errorText),
  );

  console.log(`${route} @ ${width}x${height}${mobile ? " (mobile)" : ""} -> ${out}`);
  console.log(
    `horizontal overflow: ${overflowing ? `yes, scrollWidth ${wide} > ${w} (${culprits.join(", ")})` : "none"}`,
  );
  console.log(`console errors: ${errors.length ? errors.join(" | ") : "none"}`);
  console.log(
    `failed requests: ${failed.length ? failed.map((f) => `${f.params.type} ${f.params.errorText}`).join(" | ") : "none"}`,
  );
  ws.close();
} catch (error) {
  console.error(`FAILED: ${error.message}`);
  process.exitCode = 1;
} finally {
  cleanup();
}
