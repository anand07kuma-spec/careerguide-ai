"use client";

import Link from "next/link";
import { ArrowRight, ExternalLink, Phone } from "lucide-react";
import { Wordmark } from "@/components/brand";
import { PageHero } from "@/components/layout/page-hero";
import { SiteHeader } from "@/components/layout/site-header";
import { REPO_URL } from "@/components/legal/legal-layout";
import { LinkButton, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  FOUNDER,
  FOUNDER_BIO,
  FOUNDER_PHOTO_HEIGHT,
  FOUNDER_PHOTO_WIDTH,
} from "@/lib/founder";
import { useT } from "@/lib/i18n";

/**
 * The founder's own page.
 *
 * The About page explains the project and has a founder section inside it; that
 * makes About a page about the organisation, not a profile of the person. A
 * search engine looking for "who is the founder" wants a page whose whole
 * subject is one affiliated individual, so this route exists for exactly that —
 * and every claim on it is either the approved biography or a sentence the rest
 * of the site already makes about itself.
 *
 * Three things it deliberately does not do:
 *
 * *It invents no history.* There is no education, award, employer or social
 *   profile, because none were supplied and a fabricated credential is worse
 *   than a short page.
 * *It puts the telephone number in the visible page only.* The number is a
 *   business contact for the project; it is not repeated in metadata, in the
 *   footer, on other pages or in structured data.
 * *It does not claim a company.* The disclosure section says in plain words
 *   that this is an individually developed student project.
 *
 * The phone number is printed here rather than read from configuration because
 * it is a fact about the founder, not about a deployment, and a page that
 * silently drops its only contact route when an environment variable is missing
 * is a page that lies by omission.
 */

const PHONE_DISPLAY = "+91 91703 72388";
const PHONE_HREF = "tel:+919170372388";

export default function FounderProfilePage() {
  const t = useT();

  return (
    <div className="min-h-dvh bg-canvas">
      <SiteHeader width="reading" skipTo="#main-content" skipLabel={t("Skip to content")}>
        <Link href="/" aria-label={t("CareerGuide AI home")}>
          <Wordmark />
        </Link>
        <div className="ml-auto">
          <LinkButton size="sm" variant="outline" href="/about">
            {t("About CareerGuide AI")}
          </LinkButton>
        </div>
      </SiteHeader>

      <main id="main-content" tabIndex={-1}>
        <PageHero
          eyebrow={t("Founder profile")}
          title={FOUNDER.name}
          lead={
            <>
              <p className="font-semibold text-brand-dark">
                {t("Founder & CEO, CareerGuide AI")}
              </p>
              <p className="mt-2 text-sm">
                {t("The one person who designs, builds and maintains CareerGuide AI.")}
              </p>
            </>
          }
        />

        <div className="mx-auto w-full max-w-reading px-4 pb-12 pt-8 sm:px-6 sm:pb-16 sm:pt-10">
          <Card className="p-6 sm:p-8">
            <div className="grid gap-6 sm:grid-cols-[12rem_minmax(0,1fr)] sm:items-start sm:gap-8">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={FOUNDER.photoPath}
                alt={FOUNDER.photoAlt}
                width={FOUNDER_PHOTO_WIDTH}
                height={FOUNDER_PHOTO_HEIGHT}
                className="mx-auto aspect-[3/4] w-full max-w-[12rem] rounded-2xl object-cover shadow-lift sm:mx-0"
              />
              <div className="min-w-0">
                <p className="text-base leading-relaxed text-ink">{t(FOUNDER_BIO)}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <LinkButton size="sm" href="/about">
                    {t("About CareerGuide AI")}
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </LinkButton>
                  <LinkButton size="sm" variant="outline" href={REPO_URL}>
                    <ExternalLink className="h-4 w-4" aria-hidden />
                    {t("Open the GitHub repository")}
                  </LinkButton>
                </div>
              </div>
            </div>
          </Card>

          <section className="mt-12">
            <h2 className="text-xl font-bold tracking-tight text-heading sm:text-2xl">
              CareerGuide AI
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-ink">
              {t(
                "Career advice in India usually costs money, needs a connection, or starts with a test. This project tries a fourth thing: a conversation a thirteen-year-old can have in the language they think in, on a phone, for nothing, without signing up.",
              )}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              {t(
                "It is a prototype built by one person, not a company. It has no funding, no users to report on, and no career counsellor on staff. What it has is public code, a working app, and pages that describe the limits instead of hiding them.",
              )}{" "}
              <Link
                className="text-brand underline-offset-2 hover:underline"
                href="/about"
              >
                {t("Read more about the project")}
              </Link>
              .
            </p>
          </section>

          <section className="mt-12">
            <h2 className="text-xl font-bold tracking-tight text-heading sm:text-2xl">
              {t("Contact the Founder")}
            </h2>
            <Card className="mt-4 p-6">
              <p className="text-sm leading-relaxed text-ink">
                {t(
                  "This business number reaches Anand directly. It is not a staffed support desk, and there is no promised response time.",
                )}
              </p>
              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
                <a
                  href={PHONE_HREF}
                  className={buttonClasses("primary", "lg")}
                  aria-label="Call Anand Kumar on +91 91703 72388"
                >
                  <Phone className="h-4 w-4" aria-hidden />
                  {t("Call")}
                </a>
                <a
                  href={PHONE_HREF}
                  className="text-lg font-semibold tabular-nums tracking-tight text-heading underline-offset-4 hover:underline"
                >
                  {PHONE_DISPLAY}
                </a>
              </div>
              <p className="mt-5 border-t border-line pt-4 text-xs leading-relaxed text-muted">
                {t(
                  "For bug reports, wrong career information and privacy concerns, the public GitHub repository is the channel that always works.",
                )}{" "}
                <a
                  className="text-brand underline-offset-2 hover:underline"
                  href={REPO_URL}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  {t("Open the GitHub repository")}
                </a>
                .
              </p>
            </Card>
          </section>

          <section className="mt-12">
            <h2 className="text-xl font-bold tracking-tight text-heading sm:text-2xl">
              {t("Project status")}
            </h2>
            <Card className="mt-4 p-6">
              <p className="text-sm leading-relaxed text-ink">
                {t(
                  "CareerGuide AI is designed, built and maintained by one person. There is no team to list, no staff to name and no investors to thank.",
                )}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-ink">
                {t(
                  "CareerGuide AI is a student project: not a registered company, with no registered address and no dedicated support email. Questions and reports land in the public repository.",
                )}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                {t(
                  "Founder & CEO describes who leads the work, not a registered company.",
                )}
              </p>
            </Card>
            <p className="mt-4 text-sm leading-relaxed text-muted">
              {t(
                "No career counsellor, psychologist or education researcher has reviewed the questions the guide asks or the answers it gives.",
              )}{" "}
              <a className="text-brand underline-offset-2 hover:underline" href="/disclaimer">
                {t("Read the disclaimer")}
              </a>
              .
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
