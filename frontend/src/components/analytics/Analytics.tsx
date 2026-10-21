"use client";

/**
 * Google Analytics 4 and Microsoft Clarity, behind the consent answer and off
 * the screens where a child types.
 *
 * Three gates, all of which have to be true before a single byte leaves the
 * browser:
 *
 * 1. **This deployment named a property.** `NEXT_PUBLIC_GA_MEASUREMENT_ID` and
 *    `NEXT_PUBLIC_CLARITY_PROJECT_ID` are empty in `.env.example`, so with no
 *    configuration this component renders nothing and no third party is
 *    contacted. These two values are public identifiers — they appear in the
 *    snippet of every site that uses them — which is why they may live in a
 *    `NEXT_PUBLIC_` variable when the Razorpay key may not.
 * 2. **The visitor allowed "Analytics".** `hasConsent("analytics")` is the same
 *    answer the preferences panel writes, and the consent hook is the one place
 *    in this app a third-party script has to ask. Nothing loads before the
 *    stored answer has been read back, because rendering the tag on the first
 *    paint would count the visitor who has not answered yet.
 * 3. **The page is about the project, not about a child.** This is the gate that
 *    matters most here. Clarity records the DOM of the page it runs on — layout,
 *    clicks, and the text inside inputs unless a site marks it otherwise — and
 *    GA4 reports the path. A conversation screen's path is
 *    `/app/chat` and its content is a child talking about their family, so
 *    `isPrivateSurface()` returns early on `/app`, `/parent`, `/onboarding`,
 *    `/sign-in`, `/sign-up` and `/account`. Those screens are also disallowed in
 *    `robots.ts`, so nothing is lost: a measurement tool has no business on the
 *    signed-in half of a site for minors, and the marketing half is where page
 *    counts actually come from.
 *
 * **What is sent, exactly.** A page view with `page_path` set to the pathname
 * only — no query string, so a `?code=` or any future parameter cannot ride
 * along — plus the referrer as the browser sees it, a screen size and a user
 * agent. No user id, no device id, no name, no class level, no conversation
 * text, and `send_page_view: false` on config so the only view event is the one
 * this file constructs. Ad personalisation and display features are switched
 * off, which is what keeps the tag out of Google's advertising cookie set.
 *
 * **What withdrawal does and does not do.** Turning Analytics off in the
 * preferences panel stops the tags, clears the `_ga` / `_clarity` cookies and
 * the vendors' own `localStorage` entries, and calls `clarity("stop")`. It
 * cannot recall a hit that was already sent, and the banner says so in the same
 * words the privacy page uses.
 */

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { useCookieConsent } from "@/lib/use-cookie-consent";
import { isPrivateSurface } from "@/lib/site";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    clarity?: (...args: unknown[]) => void;
  }
}

export function gaMeasurementId(): string {
  return (process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? "").trim();
}

export function clarityProjectId(): string {
  return (process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID ?? "").trim();
}

/** True when at least one property is configured, whatever consent says. */
export function analyticsConfigured(): boolean {
  return Boolean(gaMeasurementId() || clarityProjectId());
}

/**
 * Delete the vendors' own client-side state. Cookie deletion has to repeat the
 * domain and path the writer used, so both a host-scoped and a dot-domain
 * variant are attempted; a cookie that survives is a reporting bug, not a
 * security one, which is why this is best-effort rather than a promise.
 */
function clearVendorState() {
  if (typeof document === "undefined") return;
  const host = window.location.hostname;
  for (const name of ["_ga", "_gid", "_ga_" + gaMeasurementId(), "_clck", "_clsk"]) {
    for (const scope of [`; Path=/`, `; Path=/; Domain=.${host}`]) {
      document.cookie = `${name}=; Max-Age=0${scope}`;
    }
  }
  try {
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith("_ga") || key.startsWith("clarity_")) window.localStorage.removeItem(key);
    }
  } catch {
    /* private mode: there was nothing stored to remove */
  }
}

export function Analytics() {
  const pathname = usePathname();
  const { settled, hasConsent } = useCookieConsent();
  /** Whether this component has put the vendor scripts in the page. A ref, not
   * state: `enabled` already decides what renders, and a second piece of state
   * mirroring that decision is a second source of truth that can fall behind it. */
  const started = useRef(false);
  const lastView = useRef<string | null>(null);

  const enabled =
    settled && hasConsent("analytics") && analyticsConfigured() && !isPrivateSurface(pathname ?? "/");

  // A page that starts on `/app` and navigates to `/pricing` in the same session
  // must not begin reporting mid-visit without this being re-decided, and the
  // reverse has to be honoured too: leaving the consent answer switched off means
  // stopping the recorder and clearing what it left behind.
  useEffect(() => {
    if (enabled) {
      started.current = true;
      return;
    }
    if (!started.current) return;
    started.current = false;
    window.clarity?.("stop");
    clearVendorState();
  }, [enabled]);

  const configureGa = useCallback(() => {
    const id = gaMeasurementId();
    if (!id) return;
    window.gtag?.("config", id, {
      send_page_view: false,
      allow_ad_personalization_signals: false,
      allow_display_features: false,
      anonymize_ip: true,
      transport_type: "beacon",
    });
  }, []);

  const sendView = useCallback(() => {
    if (!enabled) return;
    const gtag = window.gtag;
    // Nothing is live until gtag.js has drained its queue. Returning *before*
    // recording the path is what lets the script's own `onLoad` send this view a
    // moment later instead of losing it.
    if (!gtag) return;
    const path = (pathname ?? "/").split("?")[0].split("#")[0];
    if (lastView.current === path) return;
    lastView.current = path;
    gtag("event", "page_view", {
      page_path: path,
      page_location: window.location.origin + path,
      // The query is dropped above; this stops the browser appending one anyway.
      page_referrer: document.referrer ? new URL(document.referrer).pathname : undefined,
    });
  }, [enabled, pathname]);

  // A client-side navigation to another public page is a new view; the browser
  // would not have sent one, because `send_page_view` is switched off above.
  useEffect(() => {
    sendView();
  }, [sendView]);

  if (!enabled) return null;

  const gaId = gaMeasurementId();
  const clarityId = clarityProjectId();

  return (
    <>
      {gaId ? (
        <>
          {/* The bootstrap gtag.js expects: a queue the real script drains. */}
          <Script id="ga-bootstrap" strategy="afterInteractive">
            {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = window.gtag || gtag;
gtag('js', new Date());`}
          </Script>
          {/* Configuring here rather than in an effect is the only ordering this
              component can rely on: the script has finished loading, so the queue
              is being drained, and the first view is not lost between the two. */}
          <Script
            id="ga-src"
            src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`}
            strategy="afterInteractive"
            onLoad={() => {
              configureGa();
              sendView();
            }}
          />
        </>
      ) : null}
      {clarityId ? (
        <Script id="clarity-bootstrap" strategy="afterInteractive">
          {`(function(c,l,a,r,i,t,y){
  c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
  t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
  y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
})(window, document, "clarity", "script", ${JSON.stringify(clarityId)});`}
        </Script>
      ) : null}
    </>
  );
}
