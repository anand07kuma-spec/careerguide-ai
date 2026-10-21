import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";
import { connection } from "next/server";
import { Check, Minus } from "lucide-react";

import { PublicSiteHeader } from "@/components/careers/public-careers-shell";
import { LeadForm } from "@/components/study-abroad/lead-form";
import { DirectoryUnavailable, NotInDirectory } from "@/components/study-abroad/study-shell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import { pageMeta } from "@/lib/site";
import type { StudyService } from "@/lib/types";

/**
 * One service: `/study-abroad/services/<service>`.
 *
 * `available` decides the whole shape of this page, and it is read from the row
 * rather than from the URL. A service that is not being offered yet is still
 * described — what it involves, what it would cover, what it would never cover —
 * but the page carrying it has no enquiry form on it. A button that says "ask about
 * this" over a service nobody will take on is the specific dead control this file
 * exists to prevent, and it is the reason the visa page in particular is written
 * this way: what is offered there is reading the government page with a family, not
 * regulated immigration advice this platform is not licensed to give.
 */

type Params = Promise<{ service: string }>;

const loadService = cache(async (slug: string): Promise<StudyService | null> => {
  try {
    return await api.studyService(slug);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
});

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { service: slug } = await params;
  await connection();
  let row: StudyService | null = null;
  try {
    row = await loadService(slug);
  } catch {
    row = null;
  }
  if (!row) {
    return pageMeta({
      title: "Study abroad service | CareerGuide",
      absoluteTitle: true,
      path: `/study-abroad/services/${slug}`,
      description:
        "This service is not in the directory on this deployment. The services that are can be read from the study abroad page.",
      robots: { index: false, follow: true },
    });
  }
  return pageMeta({
    title: `${row.title}: what it covers and what it never will`,
    description: row.summary,
    path: `/study-abroad/services/${row.slug}`,
    keywords: [row.title.toLowerCase(), "study abroad consultancy", "study abroad help India"],
  });
}

/** A service read at request time from a slug that is a runtime value. */
export const instant = false;

export default async function StudyAbroadServicePage({ params }: { params: Params }) {
  const { service: slug } = await params;
  await connection();

  let service: StudyService | null = null;
  try {
    service = await loadService(slug);
  } catch {
    return (
      <div className="min-h-dvh bg-canvas">
        <PublicSiteHeader current="/study-abroad" />
        <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
          <DirectoryUnavailable what={`the service “${slug}”`} />
        </main>
      </div>
    );
  }

  if (!service) {
    return (
      <div className="min-h-dvh bg-canvas">
        <PublicSiteHeader current="/study-abroad" />
        <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
          <NotInDirectory kind="service" value={slug} />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-canvas">
      <PublicSiteHeader current="/study-abroad" />

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <Link href="/study-abroad" className="text-sm text-brand underline-offset-2 hover:underline">
          Study abroad
        </Link>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <h1 className="text-balance text-3xl font-bold leading-tight tracking-tight text-heading sm:text-4xl">
            {service.title}
          </h1>
          {service.available ? (
            <Badge tone="success">
              <Check className="h-3 w-3" aria-hidden />
              Offered
            </Badge>
          ) : (
            <Badge tone="warning">
              <Minus className="h-3 w-3" aria-hidden />
              Not offered yet
            </Badge>
          )}
        </div>

        <p className="mt-5 text-base leading-relaxed text-ink">{service.summary}</p>
        {service.detail ? (
          <p className="mt-4 text-sm leading-relaxed text-ink">{service.detail}</p>
        ) : null}
        {service.who_for ? (
          <p className="mt-4 text-sm leading-relaxed text-muted">
            <span className="font-semibold text-heading">Who it is for: </span>
            {service.who_for}
          </p>
        ) : null}

        {service.steps.length > 0 ? (
          <section className="mt-10">
            <h2 className="text-lg font-bold tracking-tight text-heading sm:text-xl">How it goes</h2>
            <ol className="mt-4 space-y-2.5">
              {service.steps.map((step, index) => (
                <li key={step} className="flex gap-3 text-sm leading-relaxed text-ink">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-mist text-[11px] font-bold text-brand">
                    {index + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {service.includes.length > 0 ? (
            <Card className="p-5">
              <h2 className="text-sm font-bold tracking-tight text-heading">What you get</h2>
              <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink">
                {service.includes.map((item) => (
                  <li key={item} className="flex gap-2.5">
                    <Check className="mt-1 h-4 w-4 shrink-0 text-success" aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
          {service.not_included.length > 0 ? (
            <Card className="border-danger/25 p-5">
              <h2 className="text-sm font-bold tracking-tight text-heading">What this never covers</h2>
              <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink">
                {service.not_included.map((item) => (
                  <li key={item} className="flex gap-2.5">
                    <Minus className="mt-1 h-4 w-4 shrink-0 text-danger" aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>

        {service.fees_note ? (
          <section className="mt-10">
            <h2 className="text-lg font-bold tracking-tight text-heading sm:text-xl">Money</h2>
            <p className="mt-3 text-sm leading-relaxed text-ink">{service.fees_note}</p>
            <p className="mt-3 text-xs leading-relaxed text-muted">
              No amount is printed on this page because no amount is fixed here: a fee is quoted for
              the work a family actually needs, before any of it starts, and nothing is charged
              automatically.
            </p>
          </section>
        ) : null}

        <section className="mt-12">
          {service.available ? (
            <>
              <h2 className="text-lg font-bold tracking-tight text-heading sm:text-xl">
                Ask about {service.title.toLowerCase()}
              </h2>
              <div className="mt-4 rounded-card border border-line bg-surface p-5 sm:p-6">
                <LeadForm
                  intro={`Say that you are asking about ${service.title.toLowerCase()} and what stage the student is at. A person reads every one of these.`}
                  serviceSlug={service.slug}
                  serviceName={service.title}
                />
              </div>
            </>
          ) : (
            <div className="rounded-card border border-warning/40 bg-warning-mist p-5">
              <h2 className="text-base font-semibold text-heading">
                This one cannot be asked for yet
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-ink">
                {service.title} is described above because the boundary it sits inside matters even
                when nobody is offering the service: what is written here is what a family should
                expect from anybody who does. There is deliberately no enquiry form on this page —
                sending a request for work that is not being taken on would only put a family on a
                list nobody reads.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-ink">
                A question that needs a registered adviser should be taken to one. For anything else,
                the contact page is the channel a person watches.
              </p>
              <div className="mt-4">
                <LinkButton size="sm" href="/contact">
                  Go to the contact page
                </LinkButton>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
