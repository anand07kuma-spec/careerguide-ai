import {
  ArrowRight,
  BadgeIndianRupee,
  Compass,
  EarOff,
  GraduationCap,
  HeartHandshake,
  Languages,
  Lock,
  Menu,
  MessagesSquare,
  Route,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import Link from "next/link";
import { HorizontalLogo, Wordmark } from "@/components/brand";
import { ThemeToggle } from "@/components/careers/theme-toggle";
import { HeroScene } from "@/components/home/hero-scene";
import {
  ConversationScene,
  DawnScene,
  DeskScene,
  TableScene,
} from "@/components/home/section-scenes";
import { SiteHeader } from "@/components/layout/site-header";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Metadata } from "next";

import { DEFAULT_DESCRIPTION, pageMeta } from "@/lib/site";

export const metadata: Metadata = pageMeta({
  title: "CareerGuide AI — Explore careers, one conversation at a time",
  absoluteTitle: true,
  path: "/",
  description: DEFAULT_DESCRIPTION,
  keywords: [
    "career guidance for students",
    "career explorer India",
    "Hindi career guidance",
    "parent career dashboard",
    "study plan",
  ],
});

const BENEFITS = [
  {
    icon: Sparkles,
    title: "Discover interests and strengths",
    body: "Start from what a student enjoys and notices, not from marks or a label.",
  },
  {
    icon: Compass,
    title: "Explore suitable career options",
    body: "See what a working day looks like, what it costs and where the route begins.",
  },
  {
    icon: Route,
    title: "Understand education and skill paths",
    body: "Streams, entrance exams, courses and skills, explained in order.",
  },
  {
    icon: BadgeIndianRupee,
    title: "Find scholarships and opportunities",
    body: "Free and low-cost routes sit beside expensive ones, so a budget never closes a door.",
  },
  {
    icon: HeartHandshake,
    title: "Get parent-supported guidance",
    body: "Parents see what a student chooses to share, and get calm ways to help.",
  },
  {
    icon: Target,
    title: "Decide without pressure",
    body: "Suggestions are starting points to explore, never a verdict on who a child can become.",
  },
];

const STEPS = [
  {
    title: "Choose Student or Parent",
    body: "Two ways in, so the guidance and dashboard fit who is using it.",
    icon: Users,
  },
  {
    title: "Create an account or log in",
    body: "A short signup with consent, or Google or an email sign-in on a new device.",
    icon: ShieldCheck,
  },
  {
    title: "Explore with the guide",
    body: "Talk in Hindi, English or Hinglish. Voice is optional; typing always works.",
    icon: MessagesSquare,
  },
  {
    title: "Continue the journey",
    body: "Reports, recommendations and small next steps stay in one place.",
    icon: GraduationCap,
  },
];

const PRIVACY = [
  {
    icon: EarOff,
    title: "No background listening",
    body: "The microphone is used only during a conversation a student starts.",
  },
  {
    icon: Lock,
    title: "No raw audio saved",
    body: "Speech-to-text happens in the browser; the recording is not stored.",
  },
  {
    icon: Users,
    title: "Sharing belongs to the student",
    body: "A parent sees only what the student agrees to share, with consent recorded.",
  },
  {
    icon: ShieldCheck,
    title: "No paid placement",
    body: "No institution can pay to change a career suggestion.",
  },
];

/** Decorative waveform beside the sample conversation. */
function Waveform() {
  const bars = [34, 58, 46, 78, 52, 90, 40, 66, 100, 48, 72, 38];
  return (
    <div aria-hidden className="hidden h-10 items-end gap-1 sm:flex">
      {bars.map((height, index) => (
        <span
          key={index}
          className="w-1 rounded-full bg-gradient-to-t from-brand/15 to-teal/80"
          style={{ height: `${height}%` }}
        />
      ))}
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="bg-canvas">
      <SiteHeader width="page" sticky skipTo="#main-content" innerClassName="min-h-16">
        <HorizontalLogo />
        <nav className="hidden items-center gap-1 text-sm font-medium text-muted md:flex" aria-label="Sections">
          <a className="rounded-full px-3 py-1.5 transition-colors hover:bg-canvas hover:text-ink" href="#how">
            How it works
          </a>
          <a className="rounded-full px-3 py-1.5 transition-colors hover:bg-canvas hover:text-ink" href="#parents">
            For parents
          </a>
          <a className="rounded-full px-3 py-1.5 transition-colors hover:bg-canvas hover:text-ink" href="#privacy">
            Privacy
          </a>
          <Link className="rounded-full px-3 py-1.5 transition-colors hover:bg-canvas hover:text-ink" href="/pricing">
            Pricing
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle label="Switch between light and dark theme" />
          <LinkButton size="sm" href="/get-started" className="hidden md:inline-flex">
            Get started
            <ArrowRight className="h-4 w-4" aria-hidden />
          </LinkButton>

          <details className="group relative md:hidden">
            <summary
              aria-label="Open menu"
              className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-full border border-line bg-surface text-muted transition-colors hover:border-brand-light hover:text-ink [&::-webkit-details-marker]:hidden"
            >
              <Menu className="h-5 w-5" aria-hidden />
            </summary>
            <nav
              aria-label="Sections"
              className="absolute right-0 top-full z-40 mt-2 w-64 rounded-card border border-line bg-surface p-2 shadow-lift"
            >
              <a className="block rounded-control px-3 py-2.5 text-sm font-medium text-ink hover:bg-canvas" href="#how">
                How it works
              </a>
              <a className="block rounded-control px-3 py-2.5 text-sm font-medium text-ink hover:bg-canvas" href="#parents">
                For parents
              </a>
              <a className="block rounded-control px-3 py-2.5 text-sm font-medium text-ink hover:bg-canvas" href="#privacy">
                Privacy
              </a>
              <Link className="block rounded-control px-3 py-2.5 text-sm font-medium text-ink hover:bg-canvas" href="/pricing">
                Pricing
              </Link>
              <Link className="block rounded-control px-3 py-2.5 text-sm font-medium text-ink hover:bg-canvas" href="/careers">
                Explore careers
              </Link>
              <div className="mt-1 border-t border-line p-2 pt-3">
                <LinkButton size="sm" href="/get-started" className="w-full">
                  Get started
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </LinkButton>
              </div>
            </nav>
          </details>
        </div>
      </SiteHeader>

      <main id="main-content" tabIndex={-1}>
        {/* Hero — one painted, full-attention moment. The illustration is drawn at
            full bleed; a gradient from the left carries the headline's contrast, and
            on a phone a second gradient keeps the lower half readable over the art. */}
        <section className="relative isolate overflow-hidden bg-navy text-white">
          <HeroScene />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(5,12,26,0.95)_0%,rgba(5,12,26,0.9)_28%,rgba(5,12,26,0.64)_50%,rgba(5,12,26,0.26)_72%,rgba(5,12,26,0.06)_100%)]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgba(5,12,26,0.78)_0%,rgba(5,12,26,0.3)_42%,transparent_68%)] sm:hidden"
          />

          <div className="relative mx-auto flex min-h-[540px] max-w-page items-center px-4 pb-14 pt-12 sm:min-h-[600px] sm:px-6 sm:py-16 lg:min-h-[640px] lg:py-20">
            <div className="max-w-[41rem]">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/[0.08] px-3.5 py-1.5 text-xs font-medium text-white/85 backdrop-blur-md">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-teal-bright" />
                For students in Class 6 to 12, and the parents who support them
              </span>
              <h1 className="mt-5 text-balance text-[2.1rem] font-black leading-[1.05] tracking-[-0.03em] text-white sm:text-[2.85rem] lg:text-[3.3rem]">
                Career guidance that feels like a{" "}
                <span className="text-brand-light">conversation</span>, not an examination.
              </h1>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-white/80 sm:text-lg">
                Talk about what you enjoy, what you are curious about and what worries you.
                CareerGuide AI helps you explore real careers, understand the routes and costs,
                and take one small next step — in Hindi, English or Hinglish.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <LinkButton
                  size="lg"
                  href="/get-started"
                  className="bg-[#f2563b] px-5 text-[#180b06] shadow-[0_18px_40px_-16px_rgba(242,86,59,0.85)] hover:bg-[#ff6a4d] hover:shadow-[0_20px_44px_-16px_rgba(242,86,59,0.95)] sm:px-7"
                >
                  Get Started
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </LinkButton>
                <LinkButton
                  size="lg"
                  variant="secondary"
                  href="/careers"
                  className="border border-white/35 bg-white/10 px-5 text-white backdrop-blur-md hover:bg-white/[0.18] hover:text-white sm:px-7"
                >
                  Explore Careers
                </LinkButton>
              </div>
              <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-white/75">
                <li className="flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-teal-bright" aria-hidden />
                  No email or password to start
                </li>
                <li className="flex items-center gap-1.5">
                  <EarOff className="h-3.5 w-3.5 text-teal-bright" aria-hidden />
                  Voice off until you turn it on
                </li>
                <li className="flex items-center gap-1.5">
                  <Languages className="h-3.5 w-3.5 text-teal-bright" aria-hidden />
                  Hindi · English · Hinglish
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* The sample conversation, on its own light shelf just below the painted hero. */}
        <section className="mx-auto max-w-page px-4 pb-2 pt-12 sm:px-6 lg:pt-16">
          <div className="grid items-center gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:gap-14">
            <div className="max-w-md">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">
                A glimpse
              </p>
              <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-heading sm:text-4xl">
                This is what a conversation looks like
              </h2>
              <p className="mt-3 leading-relaxed text-muted">
                No test to prepare for and no long form. The guide asks what a student enjoys,
                notices and worries about, then suggests routes worth exploring — in Hindi,
                English or Hinglish.
              </p>
              <DeskScene className="mt-7" />
            </div>

            <div className="relative min-w-0">
              <div
                aria-hidden
                className="pointer-events-none absolute -inset-6 rounded-[36px] bg-[radial-gradient(60%_60%_at_55%_25%,rgba(37,99,235,0.14),transparent_70%)]"
              />
              <Card className="relative overflow-hidden rounded-card p-0 shadow-lift">
                <div className="flex items-center gap-3 border-b border-line bg-surface px-5 py-4">
                  <Wordmark compact />
                  <span className="ml-auto shrink-0 rounded-full border border-line bg-canvas px-2.5 py-1 text-[11px] font-medium text-muted">
                    Sample conversation
                  </span>
                </div>
                <div className="space-y-3.5 bg-surface px-5 py-5 text-sm leading-relaxed">
                  <p className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-brand-solid px-4 py-3 text-on-brand shadow-[0_10px_20px_-14px_rgb(37_99_235/0.9)]">
                    Mujhe drawing pasand hai, but papa-engineer banna chahte hain. Kya dono possible hai?
                  </p>
                  <p className="max-w-[88%] rounded-2xl rounded-bl-md bg-canvas px-4 py-3 text-ink">
                    Both can stay open. Many products, games and buildings need designers, and some
                    engineering jobs include drawing too. When you draw, is it characters, how things
                    are built, or colours and layouts?
                  </p>
                  <p className="ml-auto max-w-[70%] rounded-2xl rounded-br-md bg-brand-solid px-4 py-3 text-on-brand shadow-[0_10px_20px_-14px_rgb(37_99_235/0.9)]">
                    How things are built, jaise rooms aur machines
                  </p>
                  <p className="max-w-[88%] rounded-2xl rounded-bl-md border border-brand-mist bg-brand-mist/40 px-4 py-3 text-ink">
                    That is a real interest theme worth exploring. Three paths to look at together:
                    architecture, industrial design and mechanical drafting. None of them needs an
                    expensive course to test first.
                  </p>
                </div>
                <div className="flex items-center justify-between gap-4 border-t border-line bg-canvas px-5 py-3">
                  <p className="text-xs leading-relaxed text-muted">
                    Shown to illustrate the experience. Real suggestions come only from the
                    student&apos;s own conversation.
                  </p>
                  <Waveform />
                </div>
              </Card>
            </div>
          </div>
        </section>

        {/* Benefits — compact, one line each. */}
        <section className="mx-auto max-w-page px-4 py-12 sm:px-6 lg:py-14">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">Why it helps</p>
            <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-heading sm:text-4xl">
              Built around the questions students actually have
            </h2>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {BENEFITS.map((item) => (
              <Card key={item.title} className="cg-lift p-4">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-brand-mist text-brand-dark">
                  <item.icon className="h-4 w-4" aria-hidden />
                </span>
                <h3 className="mt-3 text-base font-semibold tracking-tight text-heading">{item.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">{item.body}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* How it works — four connected steps. */}
        <section id="how" className="scroll-mt-20 border-y border-line bg-surface py-12 lg:py-14">
          <div className="mx-auto max-w-page px-4 sm:px-6">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">The journey</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-heading sm:text-4xl">How it works</h2>
              <p className="mt-3 text-base leading-relaxed text-muted">
                Four steps, and none of them asks a child to guess what they want to become.
              </p>
            </div>
            <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_0.85fr] lg:items-center lg:gap-12">
              <ol className="grid gap-7 sm:grid-cols-2 sm:gap-x-8">
                {STEPS.map((step, index) => {
                  const Icon = step.icon;
                  return (
                    <li key={step.title} className="relative">
                      <span className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-solid text-on-brand shadow-[0_14px_28px_-16px_rgb(37_99_235/0.9)] ring-8 ring-surface">
                        <Icon className="h-4 w-4" aria-hidden />
                      </span>
                      <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-brand">
                        Step {index + 1}
                      </p>
                      <h3 className="mt-1 text-base font-semibold text-heading">{step.title}</h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-muted">{step.body}</p>
                    </li>
                  );
                })}
              </ol>
              <ConversationScene className="mx-auto w-full max-w-md lg:max-w-none" />
            </div>
            <p className="mt-6 flex items-start gap-2 text-xs leading-relaxed text-muted">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-dark" aria-hidden />
              Signup starts with consent. A parent or guardian agrees for a user under 18, and both
              confirmations are required before anything is stored.
            </p>
          </div>
        </section>

        {/* Parents + privacy — two halves of the same promise. */}
        <section id="parents" className="mx-auto max-w-page scroll-mt-20 px-4 py-12 sm:px-6 lg:py-14">
          <div className="grid items-start gap-8 lg:grid-cols-2 lg:gap-12">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-brand-mist px-3.5 py-1.5 text-xs font-semibold text-brand-dark">
                <Users className="h-3.5 w-3.5" aria-hidden />
                For parents and guardians
              </span>
              <h2 className="mt-5 text-3xl font-bold tracking-tight text-heading sm:text-4xl">
                Support without pressure
              </h2>
              <p className="mt-4 leading-relaxed text-muted">
                A parent dashboard shows what a child is exploring and the evidence behind a
                suggestion — not a secret score, not a diagnosis, and never a conversation the
                student did not choose to share.
              </p>
              <TableScene className="mt-6" />
              <ul className="mt-6 space-y-3.5 text-sm">
                <li className="flex gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-mist text-brand-dark">
                    <Users className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="leading-relaxed text-ink">
                    See interests being explored and the reasoning behind a suggestion.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-mist text-brand-dark">
                    <HeartHandshake className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="leading-relaxed text-ink">
                    Get calm wording for a career conversation, instead of an argument.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-mist text-brand-dark">
                    <BadgeIndianRupee className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="leading-relaxed text-ink">
                    Compare realistic costs, including lower-cost routes and what to verify.
                  </span>
                </li>
              </ul>
              <p className="mt-5 text-xs leading-relaxed text-muted">
                Linking a parent to a student uses the student&apos;s own sharing code and consent.
                A role chosen on this website never grants access to another account.
              </p>
            </div>

            <div id="privacy" className="scroll-mt-20">
              <div className="relative overflow-hidden rounded-card bg-navy p-5 text-white shadow-lift sm:p-7">
                <div aria-hidden className="pointer-events-none absolute inset-0 cg-grid-lines opacity-30" />
                <div
                  aria-hidden
                  className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-teal/20 blur-3xl"
                />
                <div className="relative">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-light">
                    Private by design
                  </p>
                  <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
                    Small data, clear limits
                  </h2>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    {PRIVACY.map((item) => (
                      <div key={item.title} className="rounded-card border border-white/10 bg-white/[0.04] p-3.5">
                        <item.icon className="h-4 w-4 text-teal-bright" aria-hidden />
                        <h3 className="mt-2 text-sm font-semibold">{item.title}</h3>
                        <p className="mt-1 text-xs leading-relaxed text-white/65">{item.body}</p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 text-xs leading-relaxed text-white/60">
                    The guide does not predict results, guarantee admission, jobs or salary, or
                    label a child&apos;s personality. If something serious comes up, it points to a
                    trusted adult and Childline 1098. Fees, exams and dates should always be
                    verified on official sources.
                  </p>
                  <Link
                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-light underline-offset-4 hover:underline"
                    href="/privacy"
                  >
                    Read the privacy policy
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Closing CTA */}
        <section className="mx-auto max-w-page px-4 pb-12 sm:px-6 lg:pb-14">
          <div className="relative overflow-hidden rounded-card bg-navy px-6 py-8 text-white shadow-float sm:px-10 lg:px-14">
            <div aria-hidden className="pointer-events-none absolute inset-0 cg-aurora opacity-60" />
            <div aria-hidden className="pointer-events-none absolute inset-0 cg-grid-lines opacity-25" />
            <div className="relative grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-center lg:gap-10">
              <div className="max-w-2xl">
                <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
                  Begin with one conversation
                </h2>
                <p className="mt-3 text-base leading-relaxed text-white/70">
                  No test to prepare for and no long form. Choose who is using CareerGuide, then
                  start with a few honest answers.
                </p>
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <LinkButton size="lg" className="shrink-0" href="/get-started">
                    Get Started
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </LinkButton>
                  <Link
                    className="text-sm font-medium text-white/75 underline-offset-4 hover:text-white hover:underline"
                    href="/login"
                  >
                    Already have a code? Log in
                  </Link>
                </div>
              </div>
              <DawnScene className="mx-auto w-full max-w-md lg:mx-0 lg:w-80" />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
