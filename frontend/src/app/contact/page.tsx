"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import {
  LegalLayout,
  LegalSection,
  REPO_URL,
  type SectionRef,
} from "@/components/legal/legal-layout";
import { IdentityCard } from "@/components/legal/identity-card";
import { Button, LinkButton } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/field";
import { useT } from "@/lib/i18n";

/**
 * Contact.
 *
 * This page used to carry no form at all, on the grounds that a form which
 * looks working but posts nowhere is a lie. It has one now because there is a
 * real endpoint behind it — and the endpoint reports 503 when the deployment
 * has no mail transport, which this page then shows instead of a success
 * message. The GitHub repository stays listed as the channel that works today.
 */

const SECTIONS: SectionRef[] = [
  { id: "send-a-message", title: "Send a message" },
  { id: "what-happens", title: "What happens to what you write" },
  { id: "grievance-officer", title: "Grievance officer" },
  { id: "business-contact", title: "Business contact" },
  { id: "response-time", title: "How long an answer takes" },
  { id: "danger", title: "If a child is in danger right now" },
  { id: "other-channel", title: "The channel that always works" },
];

const SUBJECTS = [
  { value: "general", label: "General" },
  { value: "privacy", label: "Privacy" },
  { value: "grievance", label: "Grievance" },
  { value: "technical", label: "Technical" },
];

type Status =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent" }
  | { kind: "invalid"; fields: Record<string, string> }
  | { kind: "not-configured"; missing: string[] }
  | { kind: "failed" };

export default function ContactPage() {
  const t = useT();
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setStatus({ kind: "sending" });
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.get("name"),
          email: data.get("email"),
          subject: data.get("subject"),
          message: data.get("message"),
          // The honeypot. A person never sees this field.
          company: data.get("company") ?? "",
        }),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        error?: string;
        fields?: Record<string, string>;
        missing?: string[];
      };
      if (result.ok) {
        setStatus({ kind: "sent" });
        // Only an accepted message is cleared. A rejected one — or one this
        // deployment could not send — leaves the text in the box to fix or copy.
        form.reset();
      } else if (result.error === "invalid") {
        setStatus({ kind: "invalid", fields: result.fields ?? {} });
      } else if (result.error === "not_configured") {
        setStatus({ kind: "not-configured", missing: result.missing ?? [] });
      } else {
        setStatus({ kind: "failed" });
      }
    } catch {
      setStatus({ kind: "failed" });
    }
  }

  const errorFor = (key: string) =>
    status.kind === "invalid" && status.fields[key]
      ? status.fields[key] === "required"
        ? t("Please fill this in.")
        : status.fields[key] === "invalid_email"
          ? t("That does not look like an email address.")
          : status.fields[key] === "too_short"
            ? t("A little more detail, please — at least ten characters.")
            : status.fields[key] === "too_long"
              ? t("That is longer than this form can send.")
              : t("Choose one of the listed options.")
      : undefined;

  return (
    <LegalLayout
      badge={t("Contact")}
      title={t("Contact")}
      current="/contact"
      sections={SECTIONS}
      intro={t(
        "How to reach this project, what happens to a message you send, and what to do if a child is in danger right now.",
      )}
    >
      <LegalSection id="send-a-message" title={t("Send a message")}>
        <p>
          {t(
            "This form posts to one address that a person reads. It is not a support desk, and it is not watched in real time.",
          )}
        </p>

        {status.kind === "sent" ? (
          <p className="rounded-card bg-success-mist p-4 text-sm font-medium text-success" role="status">
            {t("Sent. The message went to the address this deployment reads. There is no promised reply time.")}
          </p>
        ) : null}
        {status.kind === "not-configured" ? (
          <div className="rounded-card border border-warning/40 bg-warning-mist p-4 text-sm text-ink" role="alert">
            <p className="font-semibold">
              {t("This deployment has no mail transport, so nothing was sent.")}
            </p>
            <p className="mt-1 text-xs leading-relaxed">
              {t("Missing on the server:")}{" "}
              <span className="font-mono">{status.missing.join(", ") || t("unknown")}</span>.{" "}
              {t("Until those environment variables are set, use the GitHub repository below — that is a channel that works today.")}
            </p>
          </div>
        ) : null}
        {status.kind === "failed" ? (
          <p className="rounded-card border border-danger/30 bg-danger-mist p-4 text-sm text-ink" role="alert">
            {t("The message could not be delivered. Try again, or use the GitHub repository below.")}
          </p>
        ) : null}

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label={t("Name")}
              name="name"
              required
              maxLength={80}
              autoComplete="name"
              error={errorFor("name")}
              placeholder={t("How should we address you?")}
            />
            <Input
              label={t("Email")}
              name="email"
              type="email"
              required
              maxLength={160}
              autoComplete="email"
              error={errorFor("email")}
              hint={t("Used only to reply to this message. It is not stored in the app's database.")}
            />
          </div>

          <Select
            label={t("Subject")}
            name="subject"
            required
            error={errorFor("subject")}
            placeholder={t("Choose a subject")}
            options={SUBJECTS.map((item) => ({ value: item.value, label: t(item.label) }))}
          />

          <Textarea
            label={t("Message")}
            name="message"
            required
            rows={6}
            maxLength={4000}
            error={errorFor("message")}
            placeholder={t("What would you like to tell us?")}
          />

          {/* Honeypot: bots fill every field they find, people never see this one. */}
          <div hidden aria-hidden>
            <label htmlFor="contact-company">{t("Company")}</label>
            <input id="contact-company" name="company" tabIndex={-1} autoComplete="off" />
          </div>

          <p className="text-xs leading-relaxed text-muted">
            {t(
              "Please do not write a child’s conversation, nickname or device id into this form. If the problem is a leak of a child’s data, describe it without quoting it.",
            )}
          </p>

          <Button type="submit" loading={status.kind === "sending"}>
            {t("Send message")}
          </Button>
        </form>
      </LegalSection>

      <LegalSection id="what-happens" title={t("What happens to what you write")}>
        <p>
          {t(
            "The form posts to this site's own endpoint, which hands the text to an email service (Resend) for delivery to one mailbox. Nothing is written into the application database, no conversation is attached, and the message body is not written to the server logs.",
          )}
        </p>
        <p>
          {t(
            "The reply address is the email you type, so whoever answers can reply to you. If the mail service is not configured on this deployment, the form says so on screen and sends nothing — it will not show you a success message that no mailbox received.",
          )}
        </p>
      </LegalSection>

      <LegalSection id="grievance-officer" title={t("Grievance officer")}>
        <p>
          {t(
            "A service for users in India names a grievance officer who answers within a stated period. Those details are kept in one place in this project's code and every legal page reads them from there, so this list and the one on the privacy policy cannot drift apart.",
          )}
        </p>
        <IdentityCard fields="officer" />
      </LegalSection>

      <LegalSection id="business-contact" title={t("Business contact")}>
        <p>
          {t(
            "The same details, written out for anyone who wants to know who runs the site rather than who answers a complaint.",
          )}
        </p>
        <IdentityCard fields="business" showNote={false} />
      </LegalSection>

      <LegalSection id="response-time" title={t("How long an answer takes")}>
        <p>
          {t(
            "The period named above is the one a configured deployment answers within. Where the note on these cards says the details are still samples, there is no queue yet and nobody reading one, so the honest version of that promise is: write it down, expect silence, and use the repository if the question is about something broken.",
          )}
        </p>
        <p>
          {t(
            "What can be said either way: a privacy or grievance message is the one kind that should be answered first, and the GitHub issue is visible to everyone, which usually makes it the fastest of the two.",
          )}
        </p>
      </LegalSection>

      <LegalSection id="danger" title={t("If a child is in danger right now")}>
        <p>
          {t(
            "Do not wait on this page or on the app. Talk to a trusted adult immediately. In India, Childline 1098 is a national helpline for child protection. The app’s built-in safety reply points the same way, but the app itself is not monitored and cannot dispatch help.",
          )}
        </p>
      </LegalSection>

      <LegalSection id="other-channel" title={t("The channel that always works")}>
        <p>
          {t(
            "The only place a message is certain to be seen is the project’s public GitHub repository — bug reports, wrong career information and privacy concerns included.",
          )}
        </p>
        <p>
          <LinkButton href={REPO_URL} variant="secondary">
            <ExternalLink className="h-4 w-4" aria-hidden />
            {t("Open the GitHub repository")}
          </LinkButton>
        </p>
        <p className="text-xs">
          {t("It is a public repository. Nothing private about a child belongs in it.")}{" "}
          <Link className="text-brand underline-offset-2 hover:underline" href="/privacy">
            {t("Read the privacy policy")}
          </Link>
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
