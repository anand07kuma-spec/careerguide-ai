import {
  ArrowRight,
  BadgeIndianRupee,
  Briefcase,
  EarOff,
  Languages,
  Lock,
  Mic,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { Wordmark } from "@/components/brand";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const FEATURES = [
  {
    icon: Mic,
    title: "Talk, don't type",
    body: "Speak naturally in Hindi, English or Hinglish. The guide listens, replies out loud, and always keeps the text on screen so nothing is missed.",
  },
  {
    icon: Briefcase,
    title: "Explore careers properly",
    body: "Over forty career profiles across every field — what a working day really looks like, what it costs, what to check next, and routes from smaller towns.",
  },
  {
    icon: Sparkles,
    title: "Interests, not labels",
    body: "Suggestions are built from what you actually say. They are starting points to explore, never a verdict on who a child can become.",
  },
  {
    icon: Users,
    title: "Parents in the loop",
    body: "A student chooses what a parent sees. Guardians get guidance on supporting a child without pressure, and no hidden monitoring.",
  },
  {
    icon: BadgeIndianRupee,
    title: "Money talked about honestly",
    body: "Scholarships, low-cost routes and free practice are shown alongside every expensive path, so a budget never closes a door.",
  },
  {
    icon: Lock,
    title: "Data kept small",
    body: "No raw microphone recording, no continuous listening, no selling of a child's conversations. Delete a transcript any time.",
  },
];

const STEPS = [
  {
    title: "A grown-up gives permission",
    body: "Onboarding takes two minutes and starts with consent. You choose whether voice is used and what a parent may see.",
  },
  {
    title: "Have a real conversation",
    body: "Answer in your own words and language. The guide asks one question at a time, like a friendly senior, not an examiner.",
  },
  {
    title: "See what fits and explore it",
    body: "Careers are matched to themes you mentioned, with the evidence shown so you can disagree with a suggestion.",
  },
  {
    title: "Plan the next small step",
    body: "Turn interest into a free, doable plan — a book, a video, a project, a conversation with someone who does the work.",
  },
];

const HONEST_LIMITS = [
  "It does not predict the future and is not an aptitude or IQ test.",
  "It will never tell a child a career is impossible because of marks, income, gender, region or disability.",
  "Fees, exam dates, seats and scheme rules change every year — every listing asks you to verify on the official site.",
  "Institutions that pay for a listing are labelled, and payment never changes a career suggestion.",
  "Spoken replies need internet. If voice fails, the same answer is still readable as text.",
];

export default function LandingPage() {
  return (
    <div className="bg-canvas">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Wordmark />
          <nav className="hidden items-center gap-7 text-sm font-medium text-muted md:flex">
            <a className="hover:text-ink" href="#how">
              How it works
            </a>
            <a className="hover:text-ink" href="#parents">
              For parents
            </a>
            <a className="hover:text-ink" href="#safety">
              Safety and privacy
            </a>
          </nav>
          <div className="flex items-center gap-2">
            {/* Below `sm` the header has room for one action only, and that is the
                one that matters. The hero's own "Sign in" is a scroll below, so
                nothing becomes unreachable by hiding the duplicate. */}
            <LinkButton size="sm" variant="ghost" href="/login" className="hidden sm:inline-flex">
              Sign in
            </LinkButton>
            <LinkButton size="sm" href="/onboarding">
              Get started
              <ArrowRight className="h-4 w-4" aria-hidden />
            </LinkButton>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            className="pointer-events-none absolute inset-x-0 -top-24 h-64 bg-brand-mist opacity-60 blur-3xl"
            aria-hidden
          />
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:py-20">
            <div>
              <Badge tone="teal" className="mb-5">
                For students in class 3 to 12, and the parents who support them
              </Badge>
              <h1 className="text-balance text-4xl font-bold leading-[1.1] tracking-tight text-navy sm:text-5xl">
                Career guidance that feels like a conversation, not an examination.
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
                Talk about what you enjoy, what you are curious about and what worries you.
                CareerGuide AI helps you explore real careers, understand the routes and costs,
                and take one small next step — in Hindi, English or Hinglish.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <LinkButton size="lg" href="/onboarding">
                  Start exploring
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </LinkButton>
                <LinkButton size="lg" variant="outline" href="/onboarding?role=parent">
                  I am a parent
                </LinkButton>
              </div>
              <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
                <li className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-success" aria-hidden />
                  No career is called impossible
                </li>
                <li className="flex items-center gap-2">
                  <EarOff className="h-4 w-4 text-success" aria-hidden />
                  Never listens in the background
                </li>
                <li className="flex items-center gap-2">
                  <Languages className="h-4 w-4 text-success" aria-hidden />
                  Hindi · English · Hinglish
                </li>
              </ul>
            </div>

            {/* Static preview of the conversation, so the product is visible immediately */}
            <Card className="overflow-hidden p-0 shadow-lift">
              <div className="flex items-center gap-3 border-b border-line bg-navy px-5 py-4">
                <Wordmark tone="white" compact />
                <span className="ml-auto text-xs font-medium text-white/60">A typical first chat</span>
              </div>
              <div className="space-y-4 px-5 py-6 text-sm leading-relaxed">
                <p className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-brand px-4 py-3 text-white">
                  Mujhe drawing pasand hai, but papa-engineer banna chahte hain. Kya dono possible hai?
                </p>
                <p className="max-w-[88%] rounded-2xl rounded-bl-md bg-canvas px-4 py-3 text-ink">
                  Both can stay open — many products, games and buildings need designers, and some
                  engineering jobs include drawing too. May I ask one small thing? When you draw, is
                  it characters, or how things are built, or colours and layouts?
                </p>
                <p className="ml-auto max-w-[70%] rounded-2xl rounded-br-md bg-brand px-4 py-3 text-white">
                  How things are built, jaise rooms aur machines
                </p>
                <p className="max-w-[88%] rounded-2xl rounded-bl-md border border-brand-mist bg-brand-mist/40 px-4 py-3 text-ink">
                  That is a real interest theme worth exploring. Three paths to look at together:
                  architecture, industrial design and mechanical drafting. None of them needs an
                  expensive course to test first.
                </p>
              </div>
              <div className="border-t border-line bg-canvas px-5 py-3 text-xs text-muted">
                Exploratory suggestion based on what was said. Not a prediction, and no paid course is
                being recommended.
              </div>
            </Card>
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-6xl px-4 pb-4 sm:px-6">
          <h2 className="text-2xl font-bold tracking-tight text-navy sm:text-3xl">
            Everything a first conversation should do
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((item) => (
              <Card key={item.title} className="p-5">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-mist text-brand">
                  <item.icon className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="mt-4 text-base font-semibold text-navy">{item.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{item.body}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-14 sm:px-6 lg:py-20">
          <div className="cg-card overflow-hidden">
            <div className="grid gap-px bg-line lg:grid-cols-4">
              {STEPS.map((step, index) => (
                <div key={step.title} className="bg-surface p-6">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-navy text-sm font-semibold text-white">
                    {index + 1}
                  </span>
                  <h3 className="mt-4 text-base font-semibold text-navy">{step.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Parents */}
        <section id="parents" className="mx-auto max-w-6xl scroll-mt-20 px-4 pb-14 sm:px-6">
          <div className="grid items-center gap-8 lg:grid-cols-[0.95fr_1.05fr]">
            <div>
              <Badge tone="brand" className="mb-4">
                For parents and guardians
              </Badge>
              <h2 className="text-2xl font-bold tracking-tight text-navy sm:text-3xl">
                Help without pressure
              </h2>
              <p className="mt-4 leading-relaxed text-muted">
                Most arguments about careers start because neither side knows what the other is
                afraid of. The parent dashboard shows what interests your child is exploring and
                what evidence sits behind a suggestion — never a secret score, never a diagnosis,
                never a message your child did not choose to share.
              </p>
              <ul className="mt-5 space-y-2.5 text-sm">
                <li className="flex gap-2.5">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
                  Sharing settings belong to the student. Conversations stay private unless they opt in.
                </li>
                <li className="flex gap-2.5">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
                  Wording that helps you discuss a choice calmly, instead of insisting on one.
                </li>
                <li className="flex gap-2.5">
                  <BadgeIndianRupee className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
                  Realistic cost pictures, including lower-cost routes and what to verify yourself.
                </li>
              </ul>
            </div>
            <Card className="p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                An example of what the parent view says
              </p>
              <p className="mt-3 border-l-2 border-brand pl-4 text-sm leading-relaxed text-ink">
                “Your child keeps coming back to how things are put together. That is an
                observation from two conversations, not a conclusion. Before deciding anything,
                try one low-risk step together: a free design video, then a walk through a workshop
                or office where such work happens. Architecture, industrial design and mechanical
                drafting all begin from this interest, and their costs differ a lot — worth checking
                government college fees before ruling anything out.”
              </p>
              <p className="mt-4 text-xs text-muted">
                No institution is named, no fee is claimed, and no career is presented as settled.
              </p>
            </Card>
          </div>
        </section>

        {/* Safety */}
        <section id="safety" className="scroll-mt-20 bg-navy py-14 text-white lg:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              What CareerGuide AI will not do
            </h2>
            <p className="mt-3 max-w-2xl leading-relaxed text-white/70">
              A guidance tool for children is only useful if it can be trusted. These limits are
              built into the app, not written as policy you have to read.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  icon: EarOff,
                  title: "No background listening",
                  body: "The microphone turns on only while you hold a conversation open, and raw audio is not stored.",
                },
                {
                  icon: Lock,
                  title: "No selling of private chats",
                  body: "Children's conversations are never shared with advertisers or institutions for money.",
                },
                {
                  icon: ShieldCheck,
                  title: "No persuasive upselling",
                  body: "It will never push a paid course, coaching institute or college on a family.",
                },
                {
                  icon: Users,
                  title: "No judgement from accent or voice",
                  body: "Ability is never inferred from how a child speaks, their pitch, speed or accent.",
                },
                {
                  icon: Sparkles,
                  title: "No diagnosis",
                  body: "It does not label mental health, intelligence or personality. If something serious comes up, it points to a trusted adult and Childline 1098.",
                },
                {
                  icon: Briefcase,
                  title: "No fabricated results",
                  body: "No invented salaries, placements, admissions or cut-offs. Anything uncertain is marked for verification.",
                },
              ].map((item) => (
                <div key={item.title} className="rounded-card border border-white/10 bg-white/5 p-5">
                  <item.icon className="h-5 w-5 text-brand-light" aria-hidden />
                  <h3 className="mt-3 text-sm font-semibold">{item.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-white/65">{item.body}</p>
                </div>
              ))}
            </div>

            <div className="mt-10 rounded-card border border-warning/30 bg-warning/10 p-5">
              <h3 className="text-sm font-semibold text-warning-mist">Please read this honestly</h3>
              <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-white/80">
                {HONEST_LIMITS.map((line) => (
                  <li key={line}>· {line}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Closing CTA */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <Card className="flex flex-col items-start gap-6 p-8 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-navy sm:text-2xl">
                Begin with one conversation
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
                No test to prepare for, no form full of personal details. Just a few honest answers
                about what you like and what you are curious about.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <LinkButton size="lg" className="shrink-0" href="/onboarding">
                Get started
                <ArrowRight className="h-4 w-4" aria-hidden />
              </LinkButton>
              <LinkButton size="lg" variant="outline" href="/login" className="shrink-0">
                Sign in
              </LinkButton>
            </div>
          </Card>
        </section>
      </main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Wordmark compact />
          <p className="max-w-md text-xs leading-relaxed">
            CareerGuide AI supports exploration. It is not a replacement for a qualified career
            counsellor, teacher or doctor.
          </p>
        </div>
      </footer>
    </div>
  );
}
