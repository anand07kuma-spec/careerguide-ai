"use client";

import {
  ArrowRight,
  BadgeIndianRupee,
  EarOff,
  HeartHandshake,
  Lock,
  MessagesSquare,
  Route,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { Wordmark } from "@/components/brand";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { REPO_URL } from "@/components/legal/legal-layout";
import { SampleNote } from "@/components/legal/identity-card";
import { COMPANY, PHONE, POSTAL_ADDRESS } from "@/lib/legal-entity";
import { useT } from "@/lib/i18n";

/**
 * About — the page that explains what this project is before a parent decides
 * whether to let a child use it. It is written to the same rule as the legal
 * pages: describe the build that exists. So the team section says there is no
 * team, the money section says which part of a checkout is built and which is not,
 * and the numbers are the ones this repository can actually count.
 */

const STEPS = [
  {
    icon: MessagesSquare,
    title: "It starts with a question, not a form",
    body: "The first screen asks one thing — are you a student or a parent. Everything else, from class to interests, comes out in conversation, in Hindi, English or Hinglish. There is no aptitude test to prepare for and no personal details to fill in.",
  },
  {
    icon: Sparkles,
    title: "The guide suggests, and shows its work",
    body: "Careers are matched to themes the student actually mentioned. The evidence behind a suggestion is on screen beside it, so a family can disagree with it instead of taking it on faith.",
  },
  {
    icon: Route,
    title: "Exploration turns into a small next step",
    body: "A free video, a book, a project, a conversation with someone who does the work — plus what a route costs, what to verify on an official site, and which exams or stream choices sit on the way.",
  },
];

const VALUES = [
  {
    icon: Lock,
    title: "Privacy first, and provably small",
    body: "No account, no phone number, no school, no address. The app is free because it holds nothing worth selling. Raw microphone audio is not stored, there is no background listening, and the code is public so anyone can check that this is true rather than take it on trust.",
    gap: "The build has not had legal review, so it should not hold a real child’s data yet.",
  },
  {
    icon: BadgeIndianRupee,
    title: "Cost said out loud",
    body: "Every expensive path is shown next to a lower-cost one, with the fees labelled as figures to verify rather than facts. No paid course, coaching institute or college is pushed at a family, and an institution that ever pays for a listing will be badged as sponsored.",
    gap: "A checkout exists in the code and has been tested against a stubbed provider, but no payment keys are set on this deployment, so nothing has been charged and there is no refund action inside the app.",
  },
  {
    icon: HeartHandshake,
    title: "Parents in, never watching",
    body: "A student chooses what to share and reaches a grown-up with a code they pass on purpose. The parent view shows interests, evidence and next steps — not a hidden score, not a diagnosis, not a transcript the child did not offer.",
    gap: "There is no real account system yet, so sharing depends on a device this app cannot protect from a lost browser.",
  },
  {
    icon: UserRound,
    title: "A child is not a data point",
    body: "Nothing about ability, personality or intelligence is inferred from a voice, an accent or a speaking speed. The guide will never tell a student a career is closed to them because of marks, income, gender, region or disability.",
    gap: "It is a language model, not a counsellor. It can be confident and wrong in the same sentence.",
  },
];

export default function AboutPage() {
  const t = useT();

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="border-b border-line bg-surface/80 px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <Wordmark />
          <LinkButton size="sm" variant="outline" href="/onboarding">
            {t("Start exploring")}
          </LinkButton>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
        {/* Hero */}
        <section>
          <Badge tone="teal" className="mb-5">
            {t("About CareerGuide AI")}
          </Badge>
          <h1 className="text-balance text-3xl font-bold leading-tight tracking-tight text-heading sm:text-4xl">
            {t("AI career guidance for every Indian student")}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-ink sm:text-lg">
            {t(
              "Career advice in India usually costs money, needs a connection, or starts with a test. This project tries a fourth thing: a conversation a thirteen-year-old can have in the language they think in, on a phone, for nothing, without signing up.",
            )}
          </p>
          <p className="mt-4 max-w-2xl leading-relaxed text-muted">
            {t(
              "It is a prototype built by one person, not a company. It has no funding, no users to report on, and no career counsellor on staff. What it has is public code, a working app, and pages that describe the limits instead of hiding them.",
            )}
          </p>
        </section>

        {/* Mission */}
        <section className="mt-12">
          <h2 className="text-xl font-bold tracking-tight text-heading sm:text-2xl">
            {t("Mission")}
          </h2>
          <Card className="mt-4 p-6">
            <p className="border-l-2 border-brand pl-4 text-base leading-relaxed text-ink">
              {t(
                "Help a student understand what they are drawn to, what the realistic routes look like and what they cost — then hand that back to them and their family to decide with. Not to sort children into careers.",
              )}
            </p>
            <p className="mt-4 text-sm leading-relaxed text-muted">
              {t(
                "The measure is whether a conversation here leaves a family better able to ask a real teacher, a counsellor or an official website a sharper question. A suggestion from this app is the beginning of that, never the end of it.",
              )}
            </p>
          </Card>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="mt-12 scroll-mt-8">
          <h2 className="text-xl font-bold tracking-tight text-heading sm:text-2xl">
            {t("How it works")}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            {t("Three things happen in a normal visit, in this order.")}
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {STEPS.map((step, index) => (
              <Card key={step.title} className="p-5">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-mist text-brand">
                  <step.icon className="h-5 w-5" aria-hidden />
                </span>
                <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted">
                  {t("Step")} {index + 1}
                </p>
                <h3 className="mt-1 text-base font-semibold text-heading">{t(step.title)}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{t(step.body)}</p>
              </Card>
            ))}
          </div>
          <p className="mt-4 text-sm leading-relaxed text-muted">
            {t(
              "Under the surface: a Next.js app talks to a FastAPI service, which calls a language model for the replies and a speech model for the voice. Career, exam and institution records come from a Postgres database.",
            )}{" "}
            <a
              className="text-brand underline-offset-2 hover:underline"
              href="/privacy#data-sharing"
            >
              {t("Which outside services see your text")}
            </a>
            .
          </p>
        </section>

        {/* Values */}
        <section className="mt-12">
          <h2 className="text-xl font-bold tracking-tight text-heading sm:text-2xl">
            {t("What this project holds to")}
          </h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {VALUES.map((value) => (
              <Card key={value.title} className="p-5">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-teal-mist text-teal">
                  <value.icon className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="mt-4 text-base font-semibold text-heading">{t(value.title)}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{t(value.body)}</p>
                <p className="mt-3 flex gap-2 rounded-card bg-warning-mist p-3 text-xs leading-relaxed text-ink">
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-hidden />
                  {t(value.gap)}
                </p>
              </Card>
            ))}
          </div>
        </section>

        {/* Team */}
        <section className="mt-12">
          <h2 className="text-xl font-bold tracking-tight text-heading sm:text-2xl">
            {t("The team")}
          </h2>
          <div className="mt-4 rounded-card border border-line bg-canvas/50 p-5">
            <p className="text-sm leading-relaxed text-ink">
              {t(
                "There is no team to list. This is one person’s prototype project, published in a public repository, with no staff to name and no investors to thank.",
              )}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-ink">
              {t(
                "A normal About page would put a card here for each founder, an advisory board, and a sentence about investors. None of those exist, so this section names the operator instead of inventing people to fill it.",
              )}
            </p>
            <p className="mt-3 font-mono text-xs text-muted">
              {COMPANY} · {POSTAL_ADDRESS}
              {PHONE ? ` · ${PHONE}` : null}
            </p>
            <SampleNote />
          </div>
          <p className="mt-4 text-sm leading-relaxed text-muted">
            {t(
              "No career counsellor, psychologist or education researcher has reviewed the questions the guide asks or the answers it gives. That review is on the list of things this project still needs, and it is the reason the safety and disclaimer pages say what they say.",
            )}
          </p>
        </section>

        {/* Limits, again, because this is the page a parent reads */}
        <section className="mt-12">
          <div className="rounded-card border border-line bg-surface p-5">
            <h2 className="text-base font-semibold text-heading">{t("Read before a child uses it")}</h2>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted">
              <li className="flex gap-2.5">
                <EarOff className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
                {t(
                  "Progress lives in one browser. Clearing this site’s data, a private window or another device starts a new student, and nothing can be recovered.",
                )}
              </li>
              <li className="flex gap-2.5">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
                {t(
                  "Replies come from a language model and are not checked by a human before they reach the screen. The catalogue of careers, exams and scholarships is sample data.",
                )}
              </li>
              <li className="flex gap-2.5">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
                {t(
                  "The app is not an emergency service and nobody watches it in real time. If a child is in danger, contact real services and a trusted adult directly.",
                )}
              </li>
            </ul>
            <p className="mt-4 text-sm">
              <a className="text-brand underline-offset-2 hover:underline" href="/disclaimer">
                {t("Disclaimer")}
              </a>{" "}
              ·{" "}
              <a className="text-brand underline-offset-2 hover:underline" href="/privacy">
                {t("Privacy")}
              </a>{" "}
              ·{" "}
              <a className="text-brand underline-offset-2 hover:underline" href="/terms">
                {t("Terms")}
              </a>
            </p>
          </div>
        </section>

        {/* CTA */}
        <section className="mt-12">
          <Card className="flex flex-col items-start gap-6 p-7 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-heading sm:text-xl">
                {t("Begin with one conversation")}
              </h2>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
                {t(
                  "No sign-up, no test, no personal details to hand over. Answer one question and start talking.",
                )}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <LinkButton size="lg" href="/onboarding" className="shrink-0">
                {t("Get started")}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </LinkButton>
              <LinkButton size="lg" variant="outline" href={REPO_URL} className="shrink-0">
                {t("Open the GitHub repository")}
              </LinkButton>
            </div>
          </Card>
        </section>
      </main>
    </div>
  );
}
