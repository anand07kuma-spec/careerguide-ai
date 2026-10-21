import type { ReactNode } from "react";
import { CalendarClock, ExternalLink, ShieldCheck } from "lucide-react";

import { LinkButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

/**
 * The shared frame for the public study-abroad pages.
 *
 * These are server components for the same reason as `/careers`: a parent who
 * arrives from a search result has to read the answer in the first HTML, and a
 * client component could not export `metadata`. What that forces this file to
 * handle is the failure state — there is no refetch to offer, so an outage is
 * named as an outage and a reload link is given.
 *
 * The second thing this file exists for is the honesty label. Every university
 * row in this directory can be in one of two states: somebody read a fact off
 * the institution's own page and recorded where and when, or nobody has. The
 * public API says which, and the two components below are the only two ways this
 * site is allowed to say it. A field with no `source_url` behind it never
 * renders as a plain sentence, because a plain sentence reads as current.
 */

/** The directory could not be read. Names what was asked so the page never blames the wrong service. */
export function DirectoryUnavailable({ what }: { what: string }): ReactNode {
  return (
    <div className="rounded-card border border-warning/40 bg-warning-mist p-5">
      <h2 className="text-base font-semibold text-heading">The study-abroad list could not be loaded</h2>
      <p className="mt-2 text-sm leading-relaxed text-ink">
        This page asked the directory API for {what} and got no usable answer. The destinations and
        universities are stored in the backend database, so nothing here can be listed until that
        service is reachable again.
      </p>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        This is not the site saying the directory is empty — it is the site saying it does not know.
        Nothing has been filled in from a cached or invented list.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <LinkButton size="sm" href="/study-abroad">
          Try again
        </LinkButton>
        <LinkButton variant="outline" size="sm" href="/onboarding">
          Talk to the career guide instead
        </LinkButton>
      </div>
    </div>
  );
}

/** A destination or service this directory does not have. */
export function NotInDirectory({ kind, value }: { kind: "country" | "service"; value: string }): ReactNode {
  return (
    <div className="rounded-card border border-line bg-surface p-5">
      <h1 className="text-xl font-bold tracking-tight text-heading">
        No {kind === "country" ? "destination" : "service"} is listed under that name
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        <code className="rounded bg-canvas px-1.5 py-0.5 font-mono text-xs">{value}</code> is not in
        the directory this deployment has seeded. It may have been renamed, or the link may have
        come from a different build.
      </p>
      <div className="mt-4">
        <LinkButton size="sm" href="/study-abroad">
          {kind === "country" ? "See the destinations that are listed" : "See the services that are listed"}
        </LinkButton>
      </div>
    </div>
  );
}

/**
 * Whether this page's own sentences have been re-read against an official source.
 *
 * `checkedAt` is null on every seeded country row, which is the true state of copy
 * written by a person and not since verified: it is shown as "not re-checked", not
 * as a date that would imply somebody had. When the owner sets it from the admin
 * screen the page prints that day instead, and only that day.
 */
export function CheckedNotice({ checkedAt }: { checkedAt: string | null }): ReactNode {
  if (!checkedAt) {
    return (
      <p className="mt-4 flex items-start gap-2 rounded-card bg-canvas p-3 text-xs leading-relaxed text-ink">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
        <span>
          The words on this page have not been re-read against the government portals linked below
          since they were written. Read those portals for the rule that applies to you; this page is
          a description, not the source.
        </span>
      </p>
    );
  }
  const day = new Date(checkedAt).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return (
    <p className="mt-4 flex items-start gap-2 rounded-card bg-canvas p-3 text-xs leading-relaxed text-ink">
      <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
      <span>
        Last re-read against the official portals on {day}. Rules and fees move; the linked pages
        are still the authority.
      </span>
    </p>
  );
}

/**
 * The one shape a number this site has not looked up is allowed to take: a named
 * gap plus the door to where the real figure lives. Never an estimate, never a
 * blank, and never the sentence the university's own page would have to say.
 */
export function NotVerified({ field, url }: { field: string; url: string }): ReactNode {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded-card border border-line bg-canvas px-3 py-2.5 text-xs">
      <span className="font-semibold text-heading">{field}</span>
      <span className="text-muted">Not verified yet — check the university&rsquo;s own site.</span>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 font-medium text-brand underline-offset-2 hover:underline"
      >
        Open it
        <ExternalLink className="h-3.5 w-3.5" aria-hidden />
      </a>
    </div>
  );
}

/** A portal this site does not own, labelled as the government page that it is. */
export function OfficialPortal({ url, label, kind }: { url: string; label: string; kind: string }): ReactNode {
  return (
    <Card className="flex items-start justify-between gap-3 p-4">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">{kind}</p>
        <p className="mt-1 text-sm font-medium leading-snug text-heading">{label}</p>
        <p className="mt-1 break-words text-xs text-muted">{url}</p>
      </div>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex shrink-0 items-center gap-1.5 rounded-card bg-brand-mist px-3 py-2 text-xs font-semibold text-brand-dark transition-colors hover:bg-brand hover:text-white"
      >
        Official site
        <ExternalLink className="h-3.5 w-3.5" aria-hidden />
      </a>
    </Card>
  );
}

/** The badge that says whether a university row has been read from a source. */
export function VerifiedBadge({ verified }: { verified: boolean }): ReactNode {
  return verified ? (
    <Badge tone="success">Details verified</Badge>
  ) : (
    <Badge tone="neutral">Name and address only</Badge>
  );
}
