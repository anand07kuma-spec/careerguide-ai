import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowRight, Check, Globe2, Minus } from "lucide-react";

import { PublicLangNotice, PublicSiteHeader } from "@/components/careers/public-careers-shell";
import { LeadForm } from "@/components/study-abroad/lead-form";
import { DirectoryUnavailable } from "@/components/study-abroad/study-shell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { api } from "@/lib/api";
import { publicLang } from "@/lib/request-lang";
import { makeT, makeTf, type PublicLang } from "@/lib/public-i18n";
import { pageMeta } from "@/lib/site";
import type { StudyCountryCard, StudyService, StudyStory } from "@/lib/types";

/**
 * The study-abroad index: `/study-abroad`.
 *
 * Two halves, and the page says which is which. The destinations and universities
 * are a directory this repository seeded with names, cities and official domains —
 * nothing a family would have to trust, because every fee-shaped gap on the pages
 * below is printed as a gap. The services are what somebody here would actually do
 * for a fee, and each one states in `not_included` what it never covers.
 *
 * Server-rendered for the usual reason: a parent searching "study in Germany after
 * class 12" has to get an answer in the first HTML, and a page behind a device
 * session cannot be the one a crawler is sent to. The enquiry form is the single
 * client island on the page, because it is the only control here that can change
 * anything.
 *
 * The language is read the same way `/careers` reads it, which is why this page
 * takes a `searchParams` prop even though it has no filters of its own: the toggle
 * is a link carrying `?lang=hi`, resolved on the server before the HTML exists, and
 * it falls back to the `careerguide.ui-lang` cookie the toggle writes so that a
 * Hindi reader who clicks through to a destination does not land back in English.
 * What is translated is the page's own prose; the directory records — country names,
 * overviews, service summaries — are the backend's English rows, and the notice
 * under the heading says so in Hindi instead of leaving the reader to notice it.
 *
 * There are no success stories on this page and that is deliberate: `study_stories`
 * is empty until a named person agrees to being named. The empty state says so
 * rather than showing a quote nobody wrote.
 */

export const metadata: Metadata = pageMeta({
  title: "Study abroad made simple | CareerGuide",
  absoluteTitle: true,
  path: "/study-abroad",
  description:
    "Six destinations explained in plain language, 100+ universities with their official sites, and what a consultancy actually does at each stage — with the fees, deadlines and visa rules left as gaps to be read from the source rather than guessed at.",
  keywords: [
    "study abroad for Indian students",
    "study after class 12 abroad",
    "country-wise study guide",
    "university shortlisting",
    "statement of purpose help",
  ],
});

type PageQuery = Promise<{ lang?: string }>;

/** The list, the services and the stories are all read from the running backend at
 * request time, so nothing here is prerendered with somebody else's snapshot in it. */
export const instant = false;

function Unavailable({ what, lang }: { what: string; lang: PublicLang }) {
  const t = makeT(lang);
  return (
    <div className="min-h-dvh bg-canvas">
      <PublicSiteHeader current="/study-abroad" lang={lang} path="/study-abroad" />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-bold tracking-tight text-heading sm:text-4xl">
          {t("Study abroad")}
        </h1>
        <div className="mt-6">
          <DirectoryUnavailable what={what} lang={lang} />
        </div>
      </main>
    </div>
  );
}

export default async function StudyAbroadPage({ searchParams }: { searchParams: PageQuery }) {
  await connection();
  const query = await searchParams;
  const lang = await publicLang(query);
  const t = makeT(lang);
  const tf = makeTf(lang);
  // Every internal link from a Hindi page carries the language, because there
  // is no client store on this route to remember it.
  const qs = lang === "hi" ? "?lang=hi" : "";

  let countries: StudyCountryCard[] = [];
  let services: StudyService[] = [];
  let stories: StudyStory[] = [];
  try {
    [countries, services, stories] = await Promise.all([
      api.studyCountries(),
      api.studyServices(),
      api.studyStories(),
    ]);
  } catch {
    return (
      <Unavailable
        what={t("the destinations, the services and the published stories")}
        lang={lang}
      />
    );
  }

  const totalUniversities = countries.reduce((sum, country) => sum + country.universities, 0);

  return (
    <div className="min-h-dvh bg-canvas">
      <PublicSiteHeader current="/study-abroad" lang={lang} path="/study-abroad" />

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
        <Badge tone="teal" className="mb-5">
          {t("Study abroad")}
        </Badge>
        <h1 className="text-balance text-3xl font-bold leading-tight tracking-tight text-heading sm:text-5xl">
          {t("Study abroad made simple")}
        </h1>
        <PublicLangNotice lang={lang} what="the destination and service descriptions" />
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-ink sm:text-lg">
          {tf(
            "{n} destinations explained in the language a family actually argues in, {m} universities with each one’s own official site attached, and a plain description of what a paid adviser does at every stage — from a class 9 profile to a visa document list.",
            { n: countries.length, m: totalUniversities },
          )}
        </p>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted">
          {t(
            "What this directory does not do is quote a number it has not read from a source. Tuition, living costs, application deadlines and visa rules are the four things that change every year, so a page here that has not been re-read says so and links to the government or university page that owns the answer. An estimate would look more finished and be worth less.",
          )}
        </p>

        <div className="mt-8 flex flex-wrap gap-2">
          <LinkButton href="#enquiry">
            {t("Book a free consultation")}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </LinkButton>
          <LinkButton variant="outline" href={`/careers${qs}`}>
            {t("Browse career profiles instead")}
          </LinkButton>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          {t(
            "“Book” here means an enquiry, not a calendar slot: nothing is scheduled until somebody replies. See the form at the bottom of this page.",
          )}
        </p>

        {/* ---------------------------------------------------------------- destinations */}
        <section className="mt-14" aria-labelledby="destinations">
          <h2 id="destinations" className="text-2xl font-bold tracking-tight text-heading">
            {t("Destinations")}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            {t(
              "Each country page covers the same five things: how admission works there, when the intakes are, what the money question looks like, which English test the universities accept, and which official portal owns the visa rule.",
            )}
          </p>

          {countries.length === 0 ? (
            <Card className="mt-6 p-5">
              <h3 className="text-base font-semibold text-heading">
                {t("No destination is listed yet")}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {t(
                  "The directory table is empty on this deployment, which means the seed has not been run — not that studying abroad is impossible. Nothing has been invented to fill these cards.",
                )}
              </p>
            </Card>
          ) : (
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {countries.map((country) => (
                <Card key={country.slug} className="flex flex-col p-5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-base font-semibold text-heading">
                      <a
                        href={`/study-abroad/${country.slug}${qs}`}
                        className="hover:text-brand hover:underline hover:underline-offset-2"
                      >
                        {country.name}
                      </a>
                    </h3>
                    <span className="inline-flex items-center gap-1 rounded-full bg-canvas px-2 py-1 text-[11px] font-semibold tracking-wide text-muted">
                      <Globe2 className="h-3 w-3" aria-hidden />
                      {country.code}
                    </span>
                  </div>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-muted line-clamp-4">
                    {country.overview}
                  </p>
                  <p className="mt-3 text-xs font-medium text-ink">
                    {country.universities === 1
                      ? tf("{n} university listed", { n: country.universities })
                      : tf("{n} universities listed", { n: country.universities })}
                    <span className="font-normal text-muted">
                      {" "}
                      &mdash;{" "}
                      {country.checked_at ? t("copy re-checked") : t("copy not yet re-checked")}
                    </span>
                  </p>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* -------------------------------------------------------------------- services */}
        <section className="mt-14" aria-labelledby="services">
          <h2 id="services" className="text-2xl font-bold tracking-tight text-heading">
            {t("What we do, and what we refuse to do")}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            {t(
              "Four services, each with the part it will not take on written next to it. The refusal is the more useful half of the description: a statement of purpose has to be the student’s own words, and a visa decision is not anybody’s to promise.",
            )}
          </p>

          {services.length === 0 ? (
            <Card className="mt-6 p-5">
              <h3 className="text-base font-semibold text-heading">{t("No service is listed yet")}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {t("The services table is empty on this deployment. Read the careers guide or the")}{" "}
                <Link className="text-brand underline underline-offset-2" href="/contact">
                  {t("contact page")}
                </Link>{" "}
                {t("in the meantime.")}
              </p>
            </Card>
          ) : (
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {services.map((service) => (
                <Card key={service.slug} className="flex flex-col p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-base font-semibold text-heading">
                      <a
                        href={`/study-abroad/services/${service.slug}${qs}`}
                        className="hover:text-brand hover:underline hover:underline-offset-2"
                      >
                        {service.title}
                      </a>
                    </h3>
                    {service.available ? (
                      <Badge tone="success">
                        <Check className="h-3 w-3" aria-hidden />
                        {t("Offered")}
                      </Badge>
                    ) : (
                      <Badge tone="warning">
                        <Minus className="h-3 w-3" aria-hidden />
                        {t("Not offered yet")}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{service.summary}</p>
                  <p className="mt-3 text-xs leading-relaxed text-ink">
                    {service.not_included.length > 0 ? (
                      <>
                        <span className="font-semibold">{t("Never covers:")} </span>
                        {service.not_included[0]}
                      </>
                    ) : null}
                  </p>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* --------------------------------------------------------------------- stories */}
        <section className="mt-14" aria-labelledby="stories">
          <h2 id="stories" className="text-2xl font-bold tracking-tight text-heading">
            {t("Success stories")}
          </h2>
          {stories.length === 0 ? (
            <Card className="mt-6 p-5">
              <p className="text-sm leading-relaxed text-ink">
                {t(
                  "There are none yet, and there will not be a fabricated one to fill this space. A story appears here when a student or a parent has agreed by name to it being published, with the year and the destination they are willing to be quoted on.",
                )}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                {t(
                  "If that describes you, the enquiry form below is the place to say so — a quote is added only after it is written down and confirmed.",
                )}
              </p>
            </Card>
          ) : (
            <div className="mt-6 space-y-4">
              {stories.map((story) => (
                <Card key={story.id} className="p-5">
                  <h3 className="text-base font-semibold text-heading">{story.headline}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink">{story.body}</p>
                  <p className="mt-3 text-xs text-muted">
                    {story.attribution}
                    {story.year ? ` · ${story.year}` : ""}
                  </p>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* ----------------------------------------------------------------------- enquiry */}
        <section className="mt-14" aria-labelledby="enquiry" id="enquiry">
          <h2 id="enquiry" className="text-2xl font-bold tracking-tight text-heading">
            {t("Ask for a free consultation")}
          </h2>
          <div className="mt-4 rounded-card border border-line bg-surface p-5 sm:p-6">
            <LeadForm
              intro="Tell us the student's class and the destination you are thinking about. A person reads every one of these; there is no auto-reply and no call centre."
            />
          </div>
        </section>
      </main>
    </div>
  );
}
