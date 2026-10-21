import { NextResponse, type NextMiddleware, type NextRequest } from "next/server";
import { clerkMiddleware } from "@clerk/nextjs/server";
import { clerkEnabled } from "@/lib/clerk";
import { allowedLogoHosts } from "@/lib/site";

/**
 * Security headers, on every document this site serves.
 *
 * A Content-Security-Policy is only worth writing once it has been read against
 * what this app actually loads, because the failure mode is silent: a wrong
 * `script-src` still renders the server HTML, and then nothing in it hydrates —
 * every button looks present and does nothing. So each directive below names the
 * thing it exists for.
 *
 * No nonce, and no hash. Both require every request to be rendered dynamically,
 * which `cacheComponents` and partial prefetching in `next.config.ts` rule out;
 * that is why `script-src` carries `'unsafe-inline'`. It is a real weakening, it is
 * documented here rather than hidden, and here is exactly what it does and does not
 * cost now that the session lives in an `httpOnly` cookie.
 *
 * What it cannot buy an injected script any more is the credential itself. The cookie
 * is not readable from `document.cookie`, not in `localStorage`, and not in anything
 * this bundle holds, so a pasted script cannot copy a child's session out of a browser
 * and use it later somewhere else. `form-action 'self'` still keeps that script from
 * posting a form to somewhere else either.
 *
 * What it can still buy is worse, and saying so is the point: a script running on this
 * origin can make this origin's own requests with the cookie attached, because that is
 * what a browser does. `httpOnly` protects the *secret*, not the *session* — it removes
 * what a script can steal, not what it can do inside a tab that is already open. The
 * defences that do not depend on this header are the ones carrying that weight: the
 * backend accepts only JSON bodies, so a form-shaped cross-site request cannot reach a
 * write; CORS answers only the origins named in `CORS_ORIGINS`, never `*`; no route
 * takes a user id from a caller and so no request can be aimed at another family; and
 * the rate limits cap what one tab can ask for. Removing `'unsafe-inline'` needs a
 * nonce, and a nonce needs every page rendered per request — a real change to the
 * deployment, not a header edit, which is why it is written down instead of done.
 *
 * Next 16 renamed this file convention to `proxy.ts`; `middleware.ts` still runs,
 * the brief named this path, and Clerk's own setup targets it — so the name stays
 * and the deprecation is noted instead of silently ignored.
 */

/** The backend origin the browser talks to, plus its scheme for the audio socket. */
function backendOrigin(): string {
  const raw = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000").trim();
  try {
    return new URL(raw).origin;
  } catch {
    // A malformed value must not produce a directive like `https://` that makes
    // the whole policy unsyntaisable and therefore ignored by the browser.
    return "";
  }
}

/**
 * The hosts Clerk's browser SDK loads itself, its frames and its realtime socket
 * from. Only added when a public key is actually set — with none, no Clerk code
 * runs and the policy stays as tight as it can be.
 *
 * This deployment has no Clerk project attached, so these are the hosts Clerk's
 * documentation names, not hosts observed in a working sign-in. Anyone switching
 * email sign-in on should watch the browser console through that flow once.
 */
function clerkHosts(): string[] {
  if (!clerkEnabled()) return [];
  return [
    "https://*.clerk.com",
    "https://*.clerk.accounts.dev",
    "https://*.lcl.dev",
    "wss://*.clerk.com",
    "wss://*.clerk.accounts.dev",
    "wss://*.lcl.dev",
  ];
}

/**
 * Razorpay's Checkout: the script this page loads and the frame it draws its card sheet in.
 *
 * These are allowed whether or not this deployment has payment keys, and the reason is
 * where the key lives. The publishable key is handed to the browser by
 * `GET /api/payments/me`, so a request arriving at this middleware cannot know whether a
 * checkout is possible here — and a policy that blocked the frame would show a family an
 * empty payment sheet at the exact moment they decided to pay. That is the worst possible
 * time to discover a header, and the failure looks like a broken site rather than a
 * blocked one.
 *
 * The allowance costs less than it sounds. `checkout.razorpay.com` is a script this
 * origin asks for by name; the card sheet is Razorpay's own document served by them, so
 * its contents are governed by their policy and not readable from here. Nothing about
 * allowing these two hosts puts a card number within reach of this application — there
 * is no field on this site a card could be typed into, and no provider payload is ever
 * stored. `connect-src` is included because Checkout does post from the page in some
 * flows; the backend's own calls to the Razorpay API are server-side and no CSP here
 * applies to them.
 */
const RAZORPAY_SCRIPT = "https://checkout.razorpay.com";
const RAZORPAY_FRAMES = ["https://checkout.razorpay.com", "https://api.razorpay.com"];
const RAZORPAY_CONNECT = ["https://api.razorpay.com", "https://checkout.razorpay.com"];

/**
 * Google Analytics 4 and Microsoft Clarity, allowed only when this deployment has
 * actually been given the ids for them.
 *
 * Both are named here rather than in the consent banner's copy because a browser
 * that never sees the host cannot load the script even if the visitor agrees — the
 * commonest way an analytics rollout "silently does nothing" is a policy nobody
 * updated. GA4's tag file comes from `googletagmanager.com` and its collection
 * endpoint is `google-analytics.com`; Clarity serves its own bootstrap from
 * `clarity.ms` and posts the recorded batches back to the same host, which is why
 * both appear under `script-src`, `connect-src` and `img-src`.
 *
 * What is *not* opened here matters as much: no DoubleClick or Google Ads host,
 * because the tag is configured with display features and ad personalisation off,
 * and no Clarity host on a child's screen — that is enforced one layer up in
 * `components/analytics/Analytics.tsx`, which refuses to mount on `/app`, `/parent`
 * and the entry screens at all. A CSP cannot tell one route from another's intent,
 * so the route rule lives in the component and the host rule lives here.
 */
function analyticsHosts(): { script: string[]; connect: string[]; img: string[] } {
  const ga = (process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? "").trim();
  const clarity = (process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID ?? "").trim();
  const hosts = { script: [] as string[], connect: [] as string[], img: [] as string[] };

  if (ga) {
    // The tag file, then the collection endpoint a `page_view` is sent to.
    hosts.script.push("https://www.googletagmanager.com");
    hosts.connect.push("https://*.google-analytics.com", "https://*.analytics.google.com");
    // GA4 also fires a 1×1 image when a beacon is unavailable.
    hosts.img.push("https://*.google-analytics.com");
  }
  if (clarity) {
    // Clarity's bootstrap is an inline script that injects its own file, and the
    // recorded batches are POSTed back to the same host.
    hosts.script.push("https://www.clarity.ms", "https://*.clarity.ms");
    hosts.connect.push("https://www.clarity.ms", "https://*.clarity.ms");
    hosts.img.push("https://www.clarity.ms");
  }
  return hosts;
}

/**
 * A school's or practice's logo is a picture hosted by the school, because this
 * platform stores the link to it rather than the file — see `allowedLogoHosts()` in
 * `lib/site.ts` for why. Those hosts join `img-src` only when the deployment has
 * named them, so the policy of a site with no institutional branding stays as closed
 * as it was, and the same list decides whether the screen attempts the request at all.
 * The two must be one list: a policy that opened a host nobody used would be a wider
 * allowance than the product needs, and a component that drew a link the policy
 * blocked would show an admin a saved logo that never appears.
 */
function logoImageSources(): string[] {
  return allowedLogoHosts().map((host) => `https://${host}`);
}

/**
 * In dev, Turbopack streams the module graph and hot reloads over a websocket on
 * the page's own host. `'self'` never matches a `ws:` scheme (different scheme,
 * different source), so without these the page renders and never hydrates — the
 * same trap `allowedDevOrigins` in `next.config.ts` exists for.
 */
function devSocketSources(): string[] {
  if (process.env.NODE_ENV !== "development") return [];
  return ["localhost", "127.0.0.1", "careerguide.localhost"].map((host) => `ws://${host}:*`);
}

function contentSecurityPolicy(request: NextRequest): string {
  // Only promise an upgrade when the page itself arrived over https. On
  // http://localhost the backend origin is a plain http URL by design, and a
  // policy that silently rewrites it is a puzzle nobody wants at 1am.
  const secure = new URL(request.url).protocol === "https:";
  const backend = backendOrigin();
  const clerk = clerkHosts();
  const analytics = analyticsHosts();
  const logos = logoImageSources();
  const evalForDev = process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "";
  const withHosts = (list: string[]) => (list.length ? " " + list.join(" ") : "");

  const directives: string[] = [
    "default-src 'self'",
    // `style-src` needs inline: Tailwind injects `<style>` blocks and React sets
    // `style=` attributes. `img-src` needs data:/blob:: generated avatars and
    // object URLs.
    `script-src 'self' 'unsafe-inline' ${RAZORPAY_SCRIPT}${clerk.length ? " " + clerk.filter((h) => h.startsWith("http")).join(" ") : ""}${withHosts(analytics.script)}${evalForDev}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:" +
      (clerk.length ? " https://*.clerk.com https://*.clerk.accounts.dev" : "") +
      withHosts(analytics.img) +
      withHosts(logos),
    // `next/font/google` downloads Geist at build time and serves it from this
    // origin, so no third-party font host is required — `data:` covers inlined
    // subsets in dev.
    "font-src 'self' data:",
    // Speech comes back either as a `data:` URL inside the reply or as a file on
    // the backend, which is a different origin (see `mediaUrl` in `lib/api.ts`).
    `media-src 'self' data: blob:${backend ? " " + backend : ""}`,
    `connect-src ${["'self'", backend, ...RAZORPAY_CONNECT, ...clerk, ...analytics.connect, ...devSocketSources()].filter(Boolean).join(" ")}`,
    // The report preview shows the backend's PDF in `<iframe src={blob:…}>`.
    `frame-src 'self' blob: ${RAZORPAY_FRAMES.join(" ")}${clerk.length ? " https://*.clerk.com https://*.clerk.accounts.dev" : ""}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    // Every form this app has posts to this site. The contact form goes to
    // `/api/contact`, which then reaches Resend from the server.
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  if (secure) directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}

/**
 * `camera=()` and `geolocation=()` are not caution theatre: this product promises
 * it never watches a child and never asks where they are, and a permission policy
 * is the one mechanism that makes the promise hold even if a future screen gets
 * creative. `microphone=(self)` stays open because dictation uses the Web Speech
 * API on this origin — and only here, never in a frame.
 *
 * `payment` was `()` while nothing was for sale. Razorpay's Checkout calls the
 * browser's payment interfaces from inside its own frame, and a policy of `()` would
 * deny that frame as firmly as it denies a screen that wanted to watch a child, so the
 * allowance names exactly one origin: theirs. Nothing else is opened — camera,
 * geolocation, usb and midi stay closed to every frame including Razorpay's, and the
 * promise that no part of this app can look or listen to a child without the child
 * pressing a button is unchanged by a payment flow.
 */
function permissionsPolicy(): string {
  return [
    "camera=()",
    "microphone=(self)",
    "geolocation=()",
    `payment=(self "${RAZORPAY_SCRIPT}")`,
    "usb=()",
    "midi=()",
    "fullscreen=(self)",
    "autoplay=(self)",
    "interest-cohort=()",
  ].join(", ");
}

function applySecurityHeaders(request: NextRequest, response: NextResponse): NextResponse {
  const { headers } = response;
  headers.set("Content-Security-Policy", contentSecurityPolicy(request));
  headers.set("X-Frame-Options", "DENY");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", permissionsPolicy());
  return response;
}

/**
 * Clerk's middleware, mounted for the email routes and nothing else.
 *
 * The obvious-looking thing to do here — gate `/app/*`, `/assessments/*` and
 * `/profile/*` on a signed-in Clerk user — would lock every student out of their own
 * work, because this app's account is a session the browser keeps for itself: an
 * `httpOnly` cookie this server writes, and in a few browsers only a bearer string held
 * in memory. Neither is visible to a middleware, and neither was ever meant to be: that
 * session is what authorises every read of a child's answers, including for a family
 * that signed in with an email a minute ago. `/account/enter` trades a Clerk session for
 * that same credential, and `/account/connect` attaches a Clerk id to the account this
 * browser already holds — which is the only thing Clerk ever grants here.
 */
const CLERK_ROUTES: RegExp[] = [
  /^\/sign-in(\/|$)/,
  /^\/sign-up(\/|$)/,
  /^\/account\/enter$/,
  /^\/account\/connect$/,
];

const clerkHandle = clerkEnabled()
  ? clerkMiddleware()
  : // An unused Clerk is not constructed at all, so no key means no Clerk network
    // calls, no Clerk cookies and no Clerk bundle on any route.
    null;

const handle: NextMiddleware = async (request, event) => {
  const isClerkRoute = CLERK_ROUTES.some((pattern) => pattern.test(request.nextUrl.pathname));
  const response =
    isClerkRoute && clerkHandle
      ? ((await clerkHandle(request, event)) as NextResponse)
      : NextResponse.next();
  return applySecurityHeaders(request, response);
};

export default handle;

export const config = {
  // Every route that can return a document, and none of the ones that cannot:
  // hashed build output, optimised images, and anything carrying a file extension
  // (a service-worker script or an uploaded asset gains nothing from a page
  // policy, and matching them would put this file in front of every asset hit).
  matcher: [
    "/((?!_next/static|_next/image|_next/fonts|favicon.ico|apple-touch-icon|.*\\.(?:ico|png|jpg|jpeg|gif|svg|webp|avif|woff|woff2|ttf|eot|css|js|map|txt|xml|json|webmanifest|mp3|wav|m4a|pdf)$).*)",
  ],
};
