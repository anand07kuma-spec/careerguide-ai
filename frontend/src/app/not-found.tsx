"use client";

import { Compass, Home, Mic } from "lucide-react";
import { Wordmark } from "@/components/brand";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useT } from "@/lib/i18n";

/**
 * The page a wrong address lands on.
 *
 * It is a client component with a hook for its language, not a server component that
 * reads the request, and that is forced: `/_not-found` is prerendered into the build,
 * and asking it for the cookie at render time makes it runtime data outside a Suspense
 * boundary, which fails the build rather than serving a slower page. So the Hindi
 * arrives on hydration, exactly as it does on every `/app` screen — which is the right
 * trade here anyway. A 404 is not something a crawler indexes or a parent reads before
 * they have JavaScript; it is something a student who mistyped a link sees.
 */

const PLACES = [
  {
    href: "/app",
    label: "My dashboard",
    hint: "Pick up where you left off",
  },
  {
    href: "/app/chat",
    label: "Talk to the guide",
    hint: "Type, or speak in Hindi or English",
  },
  {
    href: "/app/careers",
    label: "Career explorer",
    hint: "Career profiles to look through",
  },
  {
    href: "/app/interests",
    label: "Interests",
    hint: "One gentle question at a time",
  },
  {
    href: "/app/reports",
    label: "Career report",
    hint: "Exploratory, never a verdict",
  },
  {
    href: "/app/plans",
    label: "Study plans",
    hint: "Small steps you own",
  },
  {
    href: "/app/scholarships",
    label: "Scholarships",
    hint: "Routes that cost less",
  },
  {
    href: "/parent",
    label: "Parent dashboard",
    hint: "Summary, not surveillance",
  },
];

export default function NotFound() {
  const t = useT();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-10 sm:py-16">
      <Wordmark />
      <Card className="mt-6 p-6 sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-dark">
          {t("Page not found")}
        </p>
        <h1 className="mt-2 text-2xl font-bold text-ink">
          {t("That address isn't part of CareerGuide AI")}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {t(
            "Nothing is broken and no data was lost — the address in your browser bar does not match any screen here. Pick a place below, or check the spelling: most screens start with",
          )}{" "}
          <code className="rounded bg-canvas px-1.5 py-0.5 text-ink">/app/</code>{" "}
          {t("and use a plural ending, like")}{" "}
          <code className="rounded bg-canvas px-1.5 py-0.5 text-ink">/app/reports</code>.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <LinkButton href="/app">
            <Home className="h-4 w-4" aria-hidden />
            {t("Go to my dashboard")}
          </LinkButton>
          <LinkButton href="/app/call" variant="outline">
            <Mic className="h-4 w-4" aria-hidden />
            {t("Start a voice call")}
          </LinkButton>
          <LinkButton href="/" variant="ghost">
            <Compass className="h-4 w-4" aria-hidden />
            {t("About CareerGuide AI")}
          </LinkButton>
        </div>
      </Card>

      <p className="mt-8 text-xs font-semibold uppercase tracking-wide text-muted">
        {t("Or jump straight to")}
      </p>
      <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {PLACES.map((place) => (
          <li key={place.href}>
            <LinkButton
              href={place.href}
              variant="ghost"
              size="sm"
              className="flex h-auto w-full flex-col items-start gap-0.5 rounded-xl border border-line bg-surface/60 px-4 py-3 text-left"
            >
              <span className="font-semibold text-ink">{t(place.label)}</span>
              <span className="text-xs font-normal text-muted">{t(place.hint)}</span>
            </LinkButton>
          </li>
        ))}
      </ul>
    </main>
  );
}
