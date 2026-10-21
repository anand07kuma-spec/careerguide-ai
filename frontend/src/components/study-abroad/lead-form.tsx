"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Checkbox, Input, Select, Textarea } from "@/components/ui/field";
import { ApiError, api } from "@/lib/api";
import type { LeadStage, StudyLeadOut } from "@/lib/types";
import { useT } from "@/lib/i18n";

/**
 * The enquiry form. It posts to `POST /api/study-abroad/leads`, which stores a row
 * and tries to mail two people, and it reports back exactly that much.
 *
 * Three things this form will not do:
 *
 * * **It does not book anything.** There is no calendar behind it and no slot is held.
 *   The submit button says "Send enquiry" and the panel that replaces the form repeats
 *   what the mail says — nothing is scheduled until somebody replies.
 * * **It does not show a green tick the server did not earn.** A stored enquiry with
 *   no acknowledgement mail is shown as that, in the words the server chose, because a
 *   family who was promised a reply in the form of a checkmark will wait for one that
 *   was never sent.
 * * **It does not ask about a child.** No school, no city, no marks, no documents.
 *   Those would be a minor's record sitting in a sales table, and the route refuses
 *   them as unexpected fields anyway.
 *
 * `company` is the honeypot: a field rendered `hidden` that a bot fills and a person
 * never sees. The route's answer to it is shaped like success, which is why nothing
 * here needs to know about it.
 */

const STAGES: { value: LeadStage; label: string }[] = [
  { value: "class-9", label: "Class 9" },
  { value: "class-10", label: "Class 10" },
  { value: "class-11", label: "Class 11" },
  { value: "class-12", label: "Class 12" },
  { value: "in-college", label: "Already in college" },
  { value: "other", label: "Somewhere else" },
];

type Status =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "done"; result: StudyLeadOut }
  | { kind: "refused"; message: string };

export function LeadForm({
  intro,
  countrySlug,
  countryName,
  serviceSlug,
  serviceName,
}: {
  intro: string;
  /** Sent with the enquiry so the person who reads it knows which page it came from. */
  countrySlug?: string;
  countryName?: string;
  serviceSlug?: string;
  serviceName?: string;
}) {
  const t = useT();
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("name") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    const stage = String(data.get("stage") ?? "");
    const phone = String(data.get("phone") ?? "").trim();
    const message = String(data.get("message") ?? "").trim();

    // Refused here for the same reason the route refuses it: without the tick there is
    // no permission to keep an address, and sending the request anyway would put one in
    // a server that has to be told to forget it.
    if (!data.get("consent")) {
      setStatus({ kind: "refused", message: t("Tick the box first — nothing is stored without it.") });
      return;
    }
    if (name.length < 2 || !email) {
      setStatus({ kind: "refused", message: t("A name and an email address are needed to reply.") });
      return;
    }

    setStatus({ kind: "sending" });
    try {
      const result = await api.createStudyLead({
        name,
        email,
        phone: phone || null,
        stage: (stage || null) as LeadStage | null,
        country_slug: countrySlug ?? null,
        service_slug: serviceSlug ?? null,
        message: message || null,
        source_page: window.location.pathname,
        consent_contact: true,
        company: String(data.get("company") ?? ""),
      });
      setStatus({ kind: "done", result });
    } catch (error) {
      // The route's own sentences are the good ones here — they name what was missing
      // and whether anything was stored, which a generic "submission failed" does not.
      setStatus({
        kind: "refused",
        message:
          error instanceof ApiError
            ? error.message
            : t("The enquiry could not be sent. Check your connection and try again."),
      });
    }
  }

  if (status.kind === "done") {
    const { result } = status;
    return (
      <div className="space-y-3 rounded-card border border-brand/30 bg-brand-mist p-5" role="status">
        <p className="text-sm font-semibold text-heading">
          {t("Your enquiry is stored. Nothing else has happened yet.")}
        </p>
        <p className="text-sm leading-relaxed text-ink">
          {result.reason === "sent"
            ? t("A copy has been sent to the address you gave, so check your inbox for it.")
            : `${t("No confirmation mail left this server:")}${result.note ? ` ${result.note}` : ""}`}
        </p>
        <p className="text-sm leading-relaxed text-ink">
          {t(
            "No consultation is booked by this form. No date or time is held for anyone, and no university or visa outcome is promised. If a reply comes, it comes to the address you typed.",
          )}
        </p>
        {!result.notified_operator ? (
          <p className="text-xs leading-relaxed text-ink">
            {t(
              "This deployment has no operator address configured, so nobody was mailed about it either. The /contact page is the channel that does not depend on that setting.",
            )}{" "}
            <Link className="underline underline-offset-2" href="/contact">
              {t("Open contact")}
            </Link>
          </p>
        ) : null}
      </div>
    );
  }

  const about = [countryName, serviceName].filter(Boolean).join(" · ");

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <p className="text-sm leading-relaxed text-muted">{t(intro)}</p>
      {about ? (
        <p className="text-xs text-muted">
          {t("This enquiry will say it came from:")} <span className="font-medium text-ink">{about}</span>
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label={t("Name")}
          name="name"
          required
          maxLength={80}
          autoComplete="name"
          placeholder={t("Who should we address?")}
        />
        <Input
          label={t("Email")}
          name="email"
          type="email"
          required
          maxLength={254}
          autoComplete="email"
          hint={t("Used only to reply to this enquiry. It is not added to any mailing list.")}
          placeholder="you@example.com"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label={t("Phone (optional)")}
          name="phone"
          type="tel"
          maxLength={24}
          autoComplete="tel"
          placeholder="+91…"
          hint={t("Only if you would rather be called. It is never shared with a university.")}
        />
        <Select
          label={t("Where the student is (optional)")}
          name="stage"
          placeholder="Not stated"
          options={STAGES.map((item) => ({ value: item.value, label: t(item.label) }))}
        />
      </div>

      <Textarea
        label={t("What would you like to ask? (optional)")}
        name="message"
        rows={5}
        maxLength={2000}
        placeholder={t("One or two sentences is enough for a first conversation.")}
        hint={t(
          "Please leave out the school name, marks, documents and any other detail that identifies the student by record. A first conversation does not need them.",
        )}
      />

      <Checkbox
        name="consent"
        label={t("You may contact me at this address about this enquiry.")}
        description={t(
          "Without this tick nothing is stored at all. The enquiry can be deleted on request — see the privacy policy.",
        )}
      />

      {/* Honeypot: bots fill every field they find, people never see this one. */}
      <div hidden aria-hidden>
        <label htmlFor="lead-company">Company</label>
        <input id="lead-company" name="company" tabIndex={-1} autoComplete="off" />
      </div>

      {status.kind === "refused" ? (
        <p
          className="rounded-card border border-danger/30 bg-danger-mist p-4 text-sm text-ink"
          role="alert"
        >
          {status.message}
        </p>
      ) : null}

      <Button type="submit" loading={status.kind === "sending"}>
        {t("Send enquiry")}
      </Button>
    </form>
  );
}
