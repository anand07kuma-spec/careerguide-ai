"use client";

import Link from "next/link";
import {
  Bookmark,
  ChevronRight,
  Compass,
  EyeOff,
  FileText,
  Info,
  LifeBuoy,
  Mail,
  Mic,
  ShieldCheck,
  Smartphone,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { Wordmark } from "@/components/brand";
import { useT } from "@/lib/i18n";
import { DetailNote, SettingsCard, SettingsItem, StatusPill } from "./settings-page-shell";

const BUILD_NOTES: { icon: LucideIcon; text: string }[] = [
  {
    icon: Bookmark,
    text: "The guide's replies come from whichever model the server is configured with. Anything written from sample content carries a 'Demo guide answer' label on the reply itself, so the answer tells you which one you are reading.",
  },
  {
    icon: ShieldCheck,
    text: "The career catalogue is seeded sample data. Fees, entrances and eligibility change yearly — always verify against official sources before deciding anything.",
  },
  {
    icon: Mic,
    text: "Speech recognition depends on your browser: it works best in recent Chrome and Edge on desktop, and typing always remains available as a fallback.",
  },
  {
    icon: EyeOff,
    text: "Nothing is sold here except the plans on /pricing, and those are switched off until the operator sets real payment keys. No course, coaching class or institution is sold, and guidance is never influenced by partners or by what a family paid.",
  },
  {
    icon: Smartphone,
    text: "Sign-in is optional in this build. A browser identity keeps your work without any account, and Google or email sign-in can open the same account from another device when the operator has configured it. Whichever you use, the server — not a link or a typed role — decides whether an account is a student or a parent.",
  },
  {
    icon: Info,
    text: "Qualified legal review (including child-data rules like India's DPDP Act) is needed before any real deployment with children. This build makes no compliance claim.",
  },
];

const SUPPORT_LINKS = [
  {
    href: "/contact",
    icon: Mail,
    label: "Contact us",
    hint: "Ask a question or report something that looks wrong.",
  },
  {
    href: "/privacy",
    icon: ShieldCheck,
    label: "Privacy policy",
    hint: "What this build stores and why.",
  },
  {
    href: "/terms",
    icon: FileText,
    label: "Terms of use",
    hint: "The rules this build is offered under.",
  },
];

const FEATURES: { href: string; label: string; hint: string }[] = [
  {
    href: "/app/chat",
    label: "AI career chat",
    hint: "Ask questions in English, Hindi or Hinglish, by voice or by typing.",
  },
  {
    href: "/app/assessments",
    label: "Three assessments",
    hint: "Short question sets about what you enjoy and find easy — never a verdict.",
  },
  {
    href: "/app/careers",
    label: "Career explorer",
    hint: "Browse careers with the routes, subjects and entrance exams that lead to them.",
  },
  {
    href: "/app/resume",
    label: "Resume builder",
    hint: "Write a first resume with a live print preview.",
  },
  {
    href: "/app/reports",
    label: "Reports",
    hint: "Read the career report again, or print it as a PDF.",
  },
];

export function AboutSettings() {
  const t = useT();
  return (
    <div className="space-y-4">
      <SettingsCard
        icon={Sparkles}
        tone="bg-tile-blue text-on-tile-blue"
        title="Product Identity"
        description="Who made this, and what it is for."
      >
        <div className="px-5 py-5 sm:px-6">
          <Wordmark className="text-lg" />
          <p className="mt-2 text-sm text-muted">{t("Your Future, Our Guidance")}</p>
        </div>
      </SettingsCard>

      <SettingsCard
        icon={Compass}
        tone="bg-tile-lavender text-on-tile-lavender"
        title="About the Platform"
        description="Student-focused AI career guidance and exploration."
        bodyClassName="divide-y divide-settings-line"
      >
        <div className="space-y-3 px-5 py-4 sm:px-6">
          <p className="text-sm leading-relaxed text-muted">
            {t(
              "CareerGuide AI is for students in classes 6 to 12. It talks through the subjects you like, the work those subjects lead to, and the routes — including affordable ones — that reach those jobs.",
            )}
          </p>
          <p className="text-sm leading-relaxed text-muted">
            {t(
              "It explains and explores. It does not rank you, score you, or tell you what you are allowed to become, and a conversation here is never a substitute for a teacher, a counsellor or a parent's judgment.",
            )}
          </p>
        </div>
      </SettingsCard>

      <SettingsCard
        icon={Info}
        tone="bg-tile-mint text-on-tile-mint"
        title="Platform Information"
        description="What this build is, and what is switched on inside it."
        bodyClassName="divide-y divide-settings-line"
      >
        <SettingsItem
          title="Version"
          description="This build does not publish a version number. Whoever runs the site can see the exact deployment on the server; this page would rather say that than print a made-up number."
        >
          <StatusPill tone="neutral">{t("Not published")}</StatusPill>
        </SettingsItem>
        <SettingsItem
          title="Demo mode"
          description="When no AI key is configured on the server, replies come from a built-in demo guide and are labelled as such. The Settings → Language & Voice page shows which speech service is in use."
        />
        <div className="px-5 pt-4 sm:px-6">
          <p className="text-sm font-medium text-ink">{t("Available features")}</p>
        </div>
        <ul className="divide-y divide-settings-line">
          {FEATURES.map((feature) => (
            <li key={feature.href}>
              <Link
                href={feature.href}
                className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-settings-hover focus-visible:bg-settings-hover focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand sm:px-6"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-ink">{t(feature.label)}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-muted">
                    {t(feature.hint)}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </SettingsCard>

      <SettingsCard
        icon={LifeBuoy}
        tone="bg-tile-peach text-on-tile-peach"
        title="Help & Support"
        description="Where to ask, and the pages that explain what this build does with your work."
        bodyClassName="divide-y divide-settings-line"
      >
        <ul>
          {SUPPORT_LINKS.map((link) => {
            const Icon = link.icon;
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-settings-hover focus-visible:bg-settings-hover focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand sm:px-6"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-subtle text-subtle-ink">
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-ink">{t(link.label)}</span>
                    <span className="block text-xs leading-relaxed text-muted">{t(link.hint)}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      </SettingsCard>

      <SettingsCard
        icon={FileText}
        tone="bg-tile-yellow text-on-tile-yellow"
        title="Important Information"
        description="The limitations this build is honest about. Terms and the privacy policy are linked above."
      >
        <div className="px-5 py-4 sm:px-6">
          <ul className="space-y-3 text-sm leading-relaxed text-muted">
            {BUILD_NOTES.map((note) => {
              const Icon = note.icon;
              return (
                <li key={note.text} className="flex gap-2.5">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-teal" aria-hidden />
                  <span>{t(note.text)}</span>
                </li>
              );
            })}
          </ul>
          <DetailNote className="mt-4">
            {t(
              "CareerGuide AI is a guide, not an authority. Fees, eligibility and exam dates change every year, so check the official source before acting on anything you read here.",
            )}
          </DetailNote>
        </div>
      </SettingsCard>
    </div>
  );
}
