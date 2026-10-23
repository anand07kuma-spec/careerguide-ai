import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";
import { connection } from "next/server";
import { ExternalLink } from "lucide-react";

import { PublicSiteHeader } from "@/components/careers/public-careers-shell";
import { LeadForm } from "@/components/study-abroad/lead-form";
import {
  CheckedNotice,
  DirectoryUnavailable,
  NotInDirectory,
  OfficialPortal,
} from "@/components/study-abroad/study-shell";
import { Badge, SourceBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import { pageMeta } from "@/lib/site";
import type { StudyCountry, UniversitySummary } from "@/lib/types";

/**
 * One destination: `/study-abroad/<country>`.
 *
 * The five sections a family asks for — how admission works, what it costs, when
 * the intakes are, what a student must arrange for the visa, and which universities
 * are in the directory — are all rendered from this country's own row. Where the
 * row has no answer, the section says there is no answer and links to the portal
 * that owns it. That is most of what this page is: a well-labelled set of doors.
 *
 * `checked_at` is printed as it is. On every seeded destination it is null, which
 * means the copy below was written by a person and has not since been re-read
 * against the official pages — a fact a family planning a year of their life on it
 * is entitled to see on the page rather than in a repository.
 */

type Params = Promise<{ country: string }>;
type PageQuery = Promise<{ search?: string }>;

/** null means "this directory does not have that destination", which the page renders
 * as a named gap rather than an empty list. */
const loadCountry = cache(async (slug: string): Promise<StudyCountry | null> => {
  try {
    return await api.studyCountry(slug);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
});

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { country } = await params;
  await connection();
  let row: StudyCountry | null = null;
  try {
    row = await loadCountry(country);
  } catch {
    row = null;
  }
  if (!row) {
    return pageMeta({
      title: "Study abroad destination | CareerGuide",
      absoluteTitle: true,
      path: `/study-abroad/${country}`,
      description:
        "This destination is not in the directory on this deployment. The destinations that are can be browsed from the study abroad page.",
      robots: { index: false, follow: true },
    });
  }
  return pageMeta({
    title: `Studying in ${row.name}: admission, costs, intakes and visa`,
    description: `${row.overview.slice(0, 155)}`,
    path: `/study-abroad/${row.slug}`,
    keywords: [
      `study in ${row.name.toLowerCase()}`,
      `${row.name} for Indian students`,
      `${row.name} university admission`,
      `${row.name} student visa`,
    ],
  });
}

function Note({ title, body }: { title: string; body: string }) {
  return (
    <section className="mt-10">
      <h2 className="text-lg font-bold tracking-tight text-heading sm:text-xl">{title}</h2>
      <p className="mt-3 text-sm leading-relaxed text-ink">{body}</p>
    </section>
  );
}

/** A destination read at request time from a slug that is a runtime value. */
export const instant = false;

export default async function StudyAbroadCountryPage({ params, searchParams }: { params: Params; searchParams: PageQuery }) {
  const { country: slug } = await params;
  const { search } = await searchParams;
  await connection();

  let country: StudyCountry | null = null;
  let universities: UniversitySummary[] = [];
  let failed = false;
  try {
    country = await loadCountry(slug);
    if (country) universities = await api.countryUniversities(slug, search);
  } catch {
    failed = true;
  }

  if (failed) {
    return (
      <div className="min-h-dvh bg-canvas">
        <PublicSiteHeader current="/study-abroad" />
        <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
          <DirectoryUnavailable what={`the destination “${slug}” and its university list`} />
        </main>
      </div>
    );
  }

  if (!country) {
    return (
      <div className="min-h-dvh bg-canvas">
        <PublicSiteHeader current="/study-abroad" />
        <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
          {slug === "services" ? (
            // `/study-abroad/services` is the section on the index, not a destination; the
            // dynamic segment below would otherwise tell a reader there is no country
            // called "services", which is a sentence about the wrong thing.
            <div className="rounded-card border border-line bg-surface p-5">
              <h1 className="text-xl font-bold tracking-tight text-heading">
                The services are listed with the destinations
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Every service has its own page under this address. The list of them, with which are
                being offered now, is on the study abroad page.
              </p>
              <div className="mt-4">
                <LinkButton size="sm" href="/study-abroad#services">
                  See the services
                </LinkButton>
              </div>
            </div>
          ) : (
            <NotInDirectory kind="country" value={slug} />
          )}
        </main>
      </div>
    );
  }

  const portals = [
    country.visa_portal_url && country.visa_portal_label
      ? {
          url: country.visa_portal_url,
          label: country.visa_portal_label,
          kind: "Student visa and work rights",
        }
      : null,
    country.qualifications_portal_url && country.qualifications_portal_label
      ? {
          url: country.qualifications_portal_url,
          label: country.qualifications_portal_label,
          kind: "Recognition of Indian qualifications",
        }
      : null,
  ].filter((portal): portal is { url: string; label: string; kind: string } => portal !== null);

  const verifiedCount = universities.filter((row) => row.verified).length;

  return (
    <div className="min-h-dvh bg-canvas">
      <PublicSiteHeader current="/study-abroad" />

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <Link href="/study-abroad" className="text-sm text-brand underline-offset-2 hover:underline">
          All destinations
        </Link>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Badge tone="brand">{country.code}</Badge>
          <h1 className="text-balance text-3xl font-bold leading-tight tracking-tight text-heading sm:text-4xl">
            Studying in {country.name}
          </h1>
        </div>
        <p className="mt-5 text-base leading-relaxed text-ink">{country.overview}</p>
        <CheckedNotice checkedAt={country.checked_at} />

        {/* ------------------------------------------------------------------ universities */}
        <section className="mt-12" aria-labelledby="universities">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="universities" className="text-lg font-bold tracking-tight text-heading sm:text-xl">
              Universities in this directory
            </h2>
            <span className="text-xs text-muted">
              {universities.length} shown &middot; {verifiedCount} with a detail somebody has read
              off a source
            </span>
          </div>

          <form action={`/study-abroad/${country.slug}`} method="get" className="mt-4 flex flex-wrap gap-2">
            <label className="sr-only" htmlFor="university-search">
              Search universities in {country.name}
            </label>
            <input
              id="university-search"
              name="search"
              type="search"
              defaultValue={search ?? ""}
              maxLength={80}
              placeholder="engineering, medicine, Melbourne"
              className="w-full max-w-xs rounded-card border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand"
            />
            <button
              type="submit"
              className="rounded-card bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-dark"
            >
              Search
            </button>
            {search ? (
              <Link href={`/study-abroad/${country.slug}`} className="self-center text-sm text-brand underline-offset-2 hover:underline">
                Clear
              </Link>
            ) : null}
          </form>

          {universities.length === 0 ? (
            <Card className="mt-4 p-5">
              <h3 className="text-base font-semibold text-heading">
                {search ? "No university here matches that word" : "No university listed for this destination yet"}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {search
                  ? "The list above is everything this directory holds for this country. An empty result means the word is not in a name or city, not that the university does not exist."
                  : "This destination is described, but nobody has added its institutions to the directory. Use the official portals below until it is filled."}
              </p>
            </Card>
          ) : (
            <ul className="mt-4 divide-y divide-line rounded-card border border-line bg-surface">
              {universities.map((row) => (
                <li key={row.slug} className="flex flex-wrap items-start justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-heading">{row.name}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {row.city} &middot; {row.kind === "public" ? "Public" : "Private"} university
                      {row.sponsored ? " · paid listing" : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <SourceBadge
                      verified={row.verified}
                      checkedAt={row.verified_at}
                      sourceUrl={row.source_url}
                      alternatives={[{ label: "The university's own site", url: row.official_url }]}
                    />
                    <a
                      href={row.official_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand underline-offset-2 hover:underline"
                    >
                      Official site
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs leading-relaxed text-muted">
            A name, a city and a link are the only claims made here. Fees, deadlines and entry
            requirements belong to the university&rsquo;s own page, which is why every row links out
            rather than quoting.
          </p>
        </section>

        {country.cost_note ? <Note title="What it costs" body={country.cost_note} /> : null}
        {country.intake_note ? <Note title="Intakes" body={country.intake_note} /> : null}
        {country.language_note ? <Note title="English requirements" body={country.language_note} /> : null}
        {country.work_after_note ? (
          <Note title="Visa, work rights and what changes" body={country.work_after_note} />
        ) : null}

        {/* ------------------------------------------------------------------- what to ask */}
        <section className="mt-10">
          <h2 className="text-lg font-bold tracking-tight text-heading sm:text-xl">
            Questions to answer from an official page
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Not from ours. Each of these has a published answer that moves between admission cycles,
            and the one printed on the university&rsquo;s own site for the year a student would start
            is the only one worth planning on.
          </p>
          <ol className="mt-4 space-y-2.5">
            {country.to_check.map((question, index) => (
              <li key={question} className="flex gap-3 text-sm leading-relaxed text-ink">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-mist text-[11px] font-bold text-brand">
                  {index + 1}
                </span>
                {question}
              </li>
            ))}
          </ol>
        </section>

        {portals.length > 0 ? (
          <section className="mt-10">
            <h2 className="text-lg font-bold tracking-tight text-heading sm:text-xl">
              The pages that own these rules
            </h2>
            <div className="mt-4 space-y-3">
              {portals.map((portal) => (
                <OfficialPortal key={portal.url} {...portal} />
              ))}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted">
              This site is not a government service, is not affiliated with these portals, and cannot
              see or speed up anything filed through them.
            </p>
          </section>
        ) : null}

        {/* ----------------------------------------------------------------------- enquiry */}
        <section className="mt-12" aria-labelledby="ask">
          <h2 id="ask" className="text-lg font-bold tracking-tight text-heading sm:text-xl">
            Ask about {country.name}
          </h2>
          <div className="mt-4 rounded-card border border-line bg-surface p-5 sm:p-6">
            <LeadForm
              intro={`Say that you are asking about ${country.name} and what stage the student is at. Whoever reads this sees the destination attached to the enquiry.`}
              countrySlug={country.slug}
              countryName={country.name}
            />
          </div>
          <div className="mt-4">
            <LinkButton variant="outline" size="sm" href="/study-abroad">
              Back to all destinations
            </LinkButton>
          </div>
        </section>
      </main>
    </div>
  );
}
