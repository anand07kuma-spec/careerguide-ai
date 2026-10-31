import type { Metadata } from "next";
import { connection } from "next/server";

import {
  PublicLangNotice,
  PublicSiteHeader,
} from "@/components/careers/public-careers-shell";
import { Card } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { api, ApiError } from "@/lib/api";
import { publicLang } from "@/lib/request-lang";
import { makeT, makeTf } from "@/lib/public-i18n";
import { pageMeta } from "@/lib/site";
import type { VerificationItem } from "@/lib/types";

/**
 * `/verified` — the one page that answers 'how much of this has anybody actually read?'
 *
 * Every public card on this site can carry a date meaning *a person opened the official
 * page and compared this row to it*. Until now only the family looking at that one card
 * could see it. This page puts the same records in one list, so the claim is checkable in
 * aggregate and not just row by row — which is the version a parent comparing two apps
 * actually needs.
 *
 * What it can honestly show is bounded by how a date gets written. `scripts/verify_data.py`
 * stamps the day from its own clock, refuses a supplied date, and has no `--all` mode, so a
 * date is a signature and never a batch result. That has one consequence this page is built
 * around: a window with nothing in it is the correct answer for a young catalogue, and the
 * page says so in a sentence instead of showing an empty table. An empty list here is a
 * statement about how much reading has been done, not a bug — filling the space with rows
 * invented to make the page look busy would take the one number on this site that means
 * something and make it mean nothing.
 *
 * Server-rendered for the same reason as `/careers`: it is a page a stranger arrives at from
 * a search result, and a crawler has to read the claim in the first HTML. There is no
 * session and no per-student data anywhere in it — the feed is public by design, which is
 * also why the backend route behind it sits in the read-exempt list rather than spending one
 * shared rate-limit bucket for every visitor that afternoon.
 *
 * The window is fixed at 30 days and named on the page, because "recent" printed next to a
 * list with no boundary is the kind of word that lets a stale record look current.
 */

/** The window this page publishes, and the value the route defaults to. */
const WINDOW_DAYS = 30;

/** Display order, and the only four kinds the feed can contain. */
const GROUPS: { kind: VerificationItem["kind"]; label: string }[] = [
  { kind: "career", label: "Careers" },
  { kind: "exam", label: "Exams" },
  { kind: "scholarship", label: "Scholarships" },
  { kind: "university", label: "Universities" },
];

export const metadata: Metadata = pageMeta({
  title: "What we checked, and when | CareerGuide",
  absoluteTitle: true,
  path: "/verified",
  description:
    "Every career, exam, scholarship and university row this site has recently checked against its official page — with the date it was read and the link it was read from, newest first.",
  keywords: [
    "verified career information",
    "source checked careers India",
    "what has been verified",
    "official sources career guidance",
  ],
});

/** The feed is read at request time, so nothing is prerendered with yesterday's dates in it. */
export const instant = false;

/** The route sorts newest first; this only re-proves it at the boundary the page prints. */
function byNewest(a: VerificationItem, b: VerificationItem): number {
  return b.verified_at.localeCompare(a.verified_at);
}

type PageQuery = Promise<{ lang?: string }>;

export default async function VerifiedPage({ searchParams }: { searchParams: PageQuery }) {
  await connection();
  const query = await searchParams;
  const lang = await publicLang(query);
  const t = makeT(lang);
  const tf = makeTf(lang);

  let feed;
  try {
    feed = await api.verificationRecent(WINDOW_DAYS);
  } catch (error) {
    const reason =
      error instanceof ApiError && error.status >= 400 && error.status < 500
        ? tf("The verification log replied {status} to this page.", { status: error.status })
        : t("The verification log could not be reached.");
    return (
      <div className="min-h-dvh bg-canvas">
        <PublicSiteHeader current="/verified" lang={lang} path="/verified" keepQuery={query} />
        <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
          <h1 className="text-3xl font-bold tracking-tight text-heading sm:text-4xl">
            {t("What we checked, and when")}
          </h1>
          <div className="mt-6 rounded-card border border-warning/40 bg-warning-mist p-5">
            <h2 className="text-base font-semibold text-heading">
              {t("The check log could not be loaded")}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink">{reason}</p>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              {t(
                "This is not the site saying nothing has been checked — it is the site saying it does not know. No dates have been filled in from a cached or invented list.",
              )}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <LinkButton size="sm" href="/verified">
                {t("Try again")}
              </LinkButton>
              <LinkButton variant="outline" size="sm" href="/onboarding">
                {t("Talk to the career guide instead")}
              </LinkButton>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const items = [...feed.items].sort(byNewest);
  const grouped = GROUPS.map((group) => ({
    ...group,
    rows: items.filter((item) => item.kind === group.kind),
  })).filter((group) => group.rows.length > 0);

  return (
    <div className="min-h-dvh bg-canvas">
      <PublicSiteHeader current="/verified" lang={lang} path="/verified" keepQuery={query} />

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <h1 className="text-balance text-3xl font-bold leading-tight tracking-tight text-heading sm:text-4xl">
          {t("What we checked, and when")}
        </h1>
        <PublicLangNotice lang={lang} what="career and university names" />
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-ink sm:text-lg">
          {tf(
            "These are the catalogue rows a person read against an official page in the last {days} days. Each one shows the day it was signed off and the page it was read from.",
            { days: WINDOW_DAYS },
          )}
        </p>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted">
          {t(
            "A date here is written by the person who did the reading, never by a script that stamps everything at once. So an empty list means the reading has not happened recently — it does not mean the rows below the notice are wrong, and this page will not add rows to look busier than it is.",
          )}
        </p>

        {items.length === 0 ? (
          <Card className="mt-8 p-5">
            <h2 className="text-base font-semibold text-heading">
              {tf("Nothing was checked in the last {days} days.", { days: WINDOW_DAYS })}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              {t(
                "That is the honest answer, and it is the one this page exists to give rather than hide. A green date on a card means somebody opened the official page and compared the row to it; nobody has done that inside this window. What is on the individual career, scholarship and university pages is still there, with its own badge saying whether it has been read and when.",
              )}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <LinkButton size="sm" href="/careers">
                {t("Browse the careers that are listed")}
              </LinkButton>
              <LinkButton variant="outline" size="sm" href="/study-abroad">
                {t("Study abroad")}
              </LinkButton>
            </div>
          </Card>
        ) : (
          <>
            <p className="mt-8 text-sm font-medium text-ink">
              {tf("{n} checks in the last {days} days", {
                n: feed.count,
                days: WINDOW_DAYS,
              })}
            </p>
            {grouped.map((group) => (
              <section key={group.kind} className="mt-8">
                <h2 className="text-lg font-bold tracking-tight text-heading sm:text-xl">
                  {t(group.label)}
                </h2>
                <ul className="mt-3 divide-y divide-line rounded-card border border-line bg-surface">
                  {group.rows.map((row) => (
                    <li
                      key={`${row.kind}-${row.name}`}
                      className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-4 py-3"
                    >
                      <div className="min-w-0">
                        {row.path ? (
                          <a
                            href={lang === "hi" ? `${row.path}?lang=hi` : row.path}
                            className="text-sm font-medium text-ink underline-offset-2 hover:text-brand hover:underline"
                          >
                            {t(row.name)}
                          </a>
                        ) : (
                          <p className="text-sm font-medium text-ink">{t(row.name)}</p>
                        )}
                        {/* A row whose kind has no public page yet is still a real record:
                            the name and the date are what this page is for. */}
                        {row.path ? null : (
                          <p className="mt-1 text-xs leading-relaxed text-muted">
                            {t("No public page for this one yet.")}
                          </p>
                        )}
                      </div>
                      <VerifiedBadge
                        verifiedAt={row.verified_at}
                        sourceUrl={row.source_url}
                        lang={lang}
                        className="shrink-0"
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            <p className="mt-8 text-sm leading-relaxed text-muted">
              {t(
                "A check is not permanent. Deadlines, fees and entry rules move, so a date older than this window — or a card with no date at all — should be read against this year's official notification before a family plans around it.",
              )}
            </p>
          </>
        )}
      </main>
    </div>
  );
}
