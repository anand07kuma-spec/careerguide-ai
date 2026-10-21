import { Compass, Home, Mic } from "lucide-react";
import { Wordmark } from "@/components/brand";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const PLACES = [
  { href: "/app", label: "My dashboard", hint: "Pick up where you left off" },
  { href: "/app/chat", label: "Talk to the guide", hint: "Type, or speak in Hindi or English" },
  { href: "/app/careers", label: "Career explorer", hint: "55 career profiles" },
  { href: "/app/interests", label: "Interests", hint: "One gentle question at a time" },
  { href: "/app/reports", label: "Career report", hint: "Exploratory, never a verdict" },
  { href: "/app/plans", label: "Study plans", hint: "Small steps you own" },
  { href: "/app/scholarships", label: "Scholarships", hint: "Routes that cost less" },
  { href: "/parent", label: "Parent dashboard", hint: "Summary, not surveillance" },
];

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-10 sm:py-16">
      <Wordmark />
      <Card className="mt-6 p-6 sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-dark">Page not found</p>
        <h1 className="mt-2 text-2xl font-bold text-ink">
          That address isn&apos;t part of CareerGuide AI
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Nothing is broken and no data was lost — the address in your browser bar does not match
          any screen here. Pick a place below, or check the spelling: most screens start with{" "}
          <code className="rounded bg-canvas px-1.5 py-0.5 text-ink">/app/</code> and use a plural
          ending, like <code className="rounded bg-canvas px-1.5 py-0.5 text-ink">/app/reports</code>.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <LinkButton href="/app">
            <Home className="h-4 w-4" aria-hidden />
            Go to my dashboard
          </LinkButton>
          <LinkButton href="/app/call" variant="outline">
            <Mic className="h-4 w-4" aria-hidden />
            Start a voice call
          </LinkButton>
          <LinkButton href="/" variant="ghost">
            <Compass className="h-4 w-4" aria-hidden />
            About CareerGuide AI
          </LinkButton>
        </div>
      </Card>

      <p className="mt-8 text-xs font-semibold uppercase tracking-wide text-muted">Or jump straight to</p>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2">
        {PLACES.map((place) => (
          <li key={place.href}>
            <LinkButton
              href={place.href}
              variant="ghost"
              size="sm"
              className="flex h-auto w-full flex-col items-start gap-0.5 rounded-xl border border-line bg-surface/60 px-4 py-3 text-left"
            >
              <span className="font-semibold text-ink">{place.label}</span>
              <span className="text-xs font-normal text-muted">{place.hint}</span>
            </LinkButton>
          </li>
        ))}
      </ul>
    </main>
  );
}
