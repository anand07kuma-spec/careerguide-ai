"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Inbox, Plus, ShieldCheck, Trash2, University as UniversityIcon } from "lucide-react";

import { Screen } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Checkbox, Input, Select, Textarea } from "@/components/ui/field";
import { EmptyState, ErrorState, LoadingPanel } from "@/components/ui/feedback";
import { PillGroup } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { ApiError, api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { useResource } from "@/lib/use-resource";
import { useT, useTf } from "@/lib/i18n";
import type {
  StudyCountryCard,
  StudyLeadAdmin,
  StudyStoryAdmin,
  StudyStoryInput,
  UniversityAdmin,
  UniversityUpdate,
} from "@/lib/types";

/**
 * The operator's screen: `/app/admin/study-abroad`.
 *
 * It is deliberately small. The three tables a study-abroad section needs — enquiries,
 * the university directory, and the stories — are all here, and nothing else is: no
 * dashboard, no funnel chart, no bulk mail. What is here exists to answer one question
 * per table: who asked, is this row true yet, and may this story be published.
 *
 * Three rules the server enforces and this page repeats rather than works around:
 *
 * * **A row cannot certify itself.** `verified: true` is refused unless a `source_url`
 *   travels with it or is already on the row, and the date is stamped by the route. So
 *   the tick here is never the interesting control — the source field beside it is, and
 *   the Save button sends both together.
 * * **A story cannot be published without a consent date.** A quote goes on a public
 *   page when the named person's agreement has been recorded; this page cannot tick
 *   "published" past that, and says which field is missing.
 * * **An enquiry is answerable but not editable.** The name, address and message are
 *   what a person typed; only the status and the operator's own note can be changed.
 *
 * Access is the `is_admin` flag, which no screen and no signup sets — only
 * `python scripts/admin_grant.py --email <address>` on the server does. A 403 here is a
 * normal answer, and it is shown as one.
 */

const LEAD_STATUSES = [
  { value: "", label: "All" },
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "closed", label: "Closed" },
];

function day(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-IN");
}

function dateTime(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("en-IN");
}

/** The panel an action ends in: what the server said, in its own words. */
function Notice({ tone, text }: { tone: "ok" | "bad"; text: string }) {
  return (
    <p
      role={tone === "bad" ? "alert" : "status"}
      className={`rounded-card border p-3 text-xs leading-relaxed ${
        tone === "bad"
          ? "border-danger/30 bg-danger-mist text-ink"
          : "border-success/30 bg-success-mist text-ink"
      }`}
    >
      {text}
    </p>
  );
}

// ------------------------------------------------------------------ the enquiry table

function LeadRow({ lead, onSaved }: { lead: StudyLeadAdmin; onSaved: () => void }) {
  const t = useT();
  const tf = useTf();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(lead.status);
  const [note, setNote] = useState(lead.admin_note ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      await api.handleStudyLead(lead.id, { status: status as "new" | "contacted" | "closed", admin_note: note });
      setMessage({ tone: "ok", text: t("Saved. Their own words were not touched.") });
      onSaved();
    } catch (error) {
      setMessage({ tone: "bad", text: error instanceof ApiError ? error.message : t("Could not be saved.") });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await api.deleteStudyLead(lead.id);
      onSaved();
    } catch (error) {
      setMessage({ tone: "bad", text: error instanceof ApiError ? error.message : t("Could not be deleted.") });
      setBusy(false);
    }
  }

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">{lead.name}</p>
          <p className="mt-0.5 break-words text-xs text-muted">
            <a className="text-brand underline-offset-2 hover:underline" href={`mailto:${lead.email}`}>
              {lead.email}
            </a>
            {lead.phone ? ` · ${lead.phone}` : ""}
            {lead.stage ? ` · ${lead.stage}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={lead.status === "new" ? "brand" : lead.status === "closed" ? "neutral" : "teal"}>
            {lead.status}
          </Badge>
          <Button variant="outline" size="sm" onClick={() => setOpen((next) => !next)}>
            {open ? t("Close") : t("Handle")}
          </Button>
        </div>
      </div>

      {lead.message ? (
        <p className="mt-3 whitespace-pre-line rounded-card bg-canvas p-3 text-sm leading-relaxed text-ink">
          {lead.message}
        </p>
      ) : null}

      <p className="mt-3 text-[11px] leading-relaxed text-muted">
        {t("Asked on")} {dateTime(lead.created_at)}
        {lead.source_page ? ` ${tf("from {source}", { source: lead.source_page })}` : ""} · {t("consent to be contacted recorded")}{" "}
        {lead.consent_contact ? dateTime(lead.consent_contact_at) : t("NOT RECORDED")} · {t("last handled")}{" "}
        {dateTime(lead.handled_at)}
      </p>

      {open ? (
        <div className="mt-4 space-y-3 border-t border-line pt-4">
          <Select
            label="Status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            options={[
              { value: "new", label: "New — nobody has replied" },
              { value: "contacted", label: "Contacted — we have written back" },
              { value: "closed", label: "Closed — nothing further" },
            ]}
          />
          <Textarea
            label="Note for whoever reads this next"
            rows={3}
            maxLength={2000}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={t("What was agreed, and what is still owed.")}
          />
          {message ? <Notice tone={message.tone} text={message.text} /> : null}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" loading={busy} onClick={() => void save()}>
              {t("Save")}
            </Button>
            {confirmDelete ? (
              <>
                <Button variant="danger" size="sm" loading={busy} onClick={() => void remove()}>
                  {t("Delete the record")}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                  {t("Keep it")}
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="h-4 w-4" aria-hidden />
                {t("Delete")}
              </Button>
            )}
          </div>
          {confirmDelete ? (
            <p className="text-xs leading-relaxed text-muted">
              {t("Deleting removes the row entirely: the address, the message and the consent timestamp with it. That is the answer to a request to be forgotten, and there is no undo on this screen.")}
            </p>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

function LeadsPanel() {
  const t = useT();
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [applied, setApplied] = useState("");
  const load = useCallback(
    () => api.adminStudyLeads({ status: status || undefined, search: applied || undefined, limit: 200 }),
    [status, applied],
  );
  const list = useResource<StudyLeadAdmin[]>(load, true);
  const rows = list.data ?? [];

  if (list.state === "loading" && list.data === null) return <LoadingPanel label="Loading enquiries" />;
  if (list.state === "error") {
    return <ErrorState description={list.error ?? undefined} onRetry={list.reload} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <PillGroup items={LEAD_STATUSES} value={status} onChange={setStatus} />
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            setApplied(search.trim());
            list.reload();
          }}
        >
          <input
            aria-label={t("Search enquiries")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("name or address")}
            maxLength={80}
            className="h-9 rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-brand"
          />
          <Button type="submit" variant="outline" size="sm">
            {t("Search")}
          </Button>
          {applied ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch("");
                setApplied("");
              }}
            >
              {t("Clear")}
            </Button>
          ) : null}
        </form>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No enquiry has arrived"
          description={
            applied || status
              ? "Nothing matches this filter. The unfiltered list is the number to trust."
              : "The public form at /study-abroad is the only thing that writes here. An empty table means nobody has asked yet — which is the honest state, not a loading one."
          }
        />
      ) : (
        <div className="space-y-3">
          {rows.map((lead) => (
            <LeadRow key={lead.id} lead={lead} onSaved={list.reload} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- the university table

/** The five fields a family actually wants, plus the source that makes them quotable. */
function UniversityEditor({ row, onSaved }: { row: UniversityAdmin; onSaved: () => void }) {
  const t = useT();
  const tf = useTf();
  const [city, setCity] = useState(row.city);
  const [officialUrl, setOfficialUrl] = useState(row.official_url);
  const [summary, setSummary] = useState(row.summary ?? "");
  const [tuition, setTuition] = useState(row.tuition_note ?? "");
  const [intakes, setIntakes] = useState(row.intakes.join(", "));
  const [english, setEnglish] = useState(row.english_test_note ?? "");
  const [deadline, setDeadline] = useState(row.deadline_note ?? "");
  const [source, setSource] = useState(row.source_url ?? "");
  const [verified, setVerified] = useState(row.verified);
  const [sponsored, setSponsored] = useState(row.sponsored);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);

  async function save() {
    const patch: UniversityUpdate = {};
    if (city !== row.city) patch.city = city;
    if (officialUrl !== row.official_url) patch.official_url = officialUrl;
    if (summary !== (row.summary ?? "")) patch.summary = summary || null;
    if (tuition !== (row.tuition_note ?? "")) patch.tuition_note = tuition || null;
    if (intakes !== row.intakes.join(", "))
      patch.intakes = intakes
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);
    if (english !== (row.english_test_note ?? "")) patch.english_test_note = english || null;
    if (deadline !== (row.deadline_note ?? "")) patch.deadline_note = deadline || null;
    if (source !== (row.source_url ?? "")) patch.source_url = source || null;
    if (verified !== row.verified) patch.verified = verified;
    if (sponsored !== row.sponsored) patch.sponsored = sponsored;
    if (Object.keys(patch).length === 0) {
      setMessage({ tone: "ok", text: t("Nothing had changed, so nothing was written.") });
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      await api.updateStudyUniversity(row.slug, patch);
      setMessage({
        tone: "ok",
        text: verified
          ? t("Saved, and the verification date was stamped by the server for today.")
          : t("Saved."),
      });
      onSaved();
    } catch (error) {
      setMessage({
        tone: "bad",
        text: error instanceof ApiError ? error.message : t("The row could not be saved."),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 space-y-3 border-t border-line pt-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input label="City" value={city} maxLength={80} onChange={(e) => setCity(e.target.value)} />
        <Input
          label="Official URL"
          value={officialUrl}
          maxLength={400}
          onChange={(e) => setOfficialUrl(e.target.value)}
        />
      </div>
      <Textarea
        label="One-line description"
        rows={2}
        maxLength={4000}
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
      />
      <Textarea
        label="Tuition, read from the university's own page"
        rows={2}
        maxLength={4000}
        value={tuition}
        onChange={(e) => setTuition(e.target.value)}
        placeholder={t(
          "Leave empty until you have read the figure. The public page then prints 'not verified yet'.",
        )}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          label="Intakes (comma separated)"
          value={intakes}
          maxLength={400}
          onChange={(e) => setIntakes(e.target.value)}
          placeholder="September, January"
        />
        <Input
          label="English test requirement"
          value={english}
          maxLength={400}
          onChange={(e) => setEnglish(e.target.value)}
        />
      </div>
      <Input
        label="Application deadline"
        value={deadline}
        maxLength={400}
        onChange={(e) => setDeadline(e.target.value)}
      />
      <Input
        label="Source URL — the page you read this from"
        value={source}
        maxLength={500}
        onChange={(e) => setSource(e.target.value)}
        placeholder="https://…/fees-and-funding"
        hint={
          row.verified_at
            ? tf(
                "Verified on {date}. Clearing this link while the row is verified is refused.",
                { date: day(row.verified_at) },
              )
            : "Without a source here, the verified tick below cannot be set."
        }
      />
      <div className="space-y-2">
        <Checkbox
          label="Verified against the source"
          description="The server stamps the date and refuses this without a source URL."
          checked={verified}
          onChange={(event) => setVerified(event.target.checked)}
        />
        <Checkbox
          label="This is a paid listing"
          description="A university that pays is stated as paying wherever it appears."
          checked={sponsored}
          onChange={(event) => setSponsored(event.target.checked)}
        />
      </div>

      {message ? <Notice tone={message.tone} text={message.text} /> : null}
      <Button size="sm" loading={busy} onClick={() => void save()}>
        {t("Save changes")}
      </Button>
    </div>
  );
}

// Named rather than inlined so the sentence under the list can tell the difference between
// the directory and what one request handed back. The server accepts up
// to 2000; nothing about the current file needs more.
const DIRECTORY_ROW_LIMIT = 1000;

function UniversitiesPanel({ countries }: { countries: StudyCountryCard[] }) {
  const t = useT();
  const tf = useTf();
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const [unverifiedOnly, setUnverifiedOnly] = useState(true);
  const [country, setCountry] = useState("");
  const [search, setSearch] = useState("");
  const [applied, setApplied] = useState("");
  const load = useCallback(
    () =>
      api.adminStudyUniversities({
        unverified_only: unverifiedOnly,
        country: country || undefined,
        search: applied || undefined,
        limit: DIRECTORY_ROW_LIMIT,
      }),
    [unverifiedOnly, country, applied],
  );
  const list = useResource<UniversityAdmin[]>(load, true);
  const rows = list.data ?? [];

  if (list.state === "loading" && list.data === null) return <LoadingPanel label="Loading the directory" />;
  if (list.state === "error") return <ErrorState description={list.error ?? undefined} onRetry={list.reload} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Checkbox
          label="Only rows with nothing verified"
          checked={unverifiedOnly}
          onChange={(event) => setUnverifiedOnly(event.target.checked)}
        />
        <Select
          label="Country"
          value={country}
          onChange={(event) => setCountry(event.target.value)}
          options={[
            { value: "", label: "Every destination" },
            ...countries.map((item) => ({ value: item.slug, label: item.name })),
          ]}
          className="h-9"
        />
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            setApplied(search.trim());
            list.reload();
          }}
        >
          <input
            aria-label={t("Search universities")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("name or city")}
            maxLength={80}
            className="h-9 rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-brand"
          />
          <Button type="submit" variant="outline" size="sm">
            {t("Search")}
          </Button>
        </form>
      </div>

      <p className="text-xs leading-relaxed text-muted">
        {tf("{count} row{s} shown", { count: rows.length, s: rows.length === 1 ? "" : "s" })}
        {unverifiedOnly ? ` ${t("that are still unverified")}` : ""}.
        {rows.length === DIRECTORY_ROW_LIMIT
          ? ` ${t("That is one answer, not the whole directory — narrow it by destination or by name before counting what is left.")}`
          : ""}{" "}
        {t("The seed wrote a name, a city, a funding type and a domain — nothing else. Every field below that is empty prints to the public as “not verified yet”, and it stays that way until a person reads the figure and records where.")}
      </p>

      {rows.length === 0 ? (
        <EmptyState
          icon={UniversityIcon}
          title="Nothing matches this filter"
          description="Turn off the unverified-only box to see the whole directory, or add a university below."
        />
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <Card key={row.slug} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">
                    <a
                      className="underline-offset-2 hover:underline"
                      href={row.official_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {row.name}
                    </a>
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {row.city} · {row.kind} · {row.country_slug}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {row.sponsored ? <Badge tone="warning">{t("Paid listing")}</Badge> : null}
                  <Badge tone={row.verified ? "success" : "neutral"}>
                    {row.verified ? tf("Verified {date}", { date: day(row.verified_at) }) : t("Unverified")}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setOpenSlug(openSlug === row.slug ? null : row.slug)}
                  >
                    {openSlug === row.slug ? t("Close") : t("Edit")}
                  </Button>
                </div>
              </div>
              {openSlug === row.slug ? (
                <UniversityEditor key={row.slug} row={row} onSaved={list.reload} />
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------------- the story table

function StoryEditor({
  existing,
  countries,
  onSaved,
  onCancel,
}: {
  existing: StudyStoryAdmin | null;
  countries: StudyCountryCard[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const [headline, setHeadline] = useState(existing?.headline ?? "");
  const [body, setBody] = useState(existing?.body ?? "");
  const [attribution, setAttribution] = useState(existing?.attribution ?? "");
  const [year, setYear] = useState(existing?.year ? String(existing.year) : "");
  const [country, setCountry] = useState(existing?.country_slug ?? "");
  const [consent, setConsent] = useState(
    existing?.consent_confirmed_at ? existing.consent_confirmed_at.slice(0, 10) : "",
  );
  const [published, setPublished] = useState(existing?.published ?? false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);

  async function save() {
    const payload: StudyStoryInput = {
      headline,
      body,
      attribution,
      // The route replaces the whole row, so the institution link this form has no
      // control for is sent back exactly as it was read. Left out, editing a headline
      // would unlink the story from the university it is about.
      country_slug: country || null,
      university_slug: existing?.university_slug ?? null,
      year: year ? Number(year) : null,
      consent_confirmed_at: consent ? `${consent}T00:00:00+00:00` : null,
      published,
    };
    setBusy(true);
    setMessage(null);
    try {
      if (existing) await api.updateStudyStory(existing.id, payload);
      else await api.createStudyStory(payload);
      setMessage({ tone: "ok", text: existing ? t("Saved.") : t("Added as a draft.") });
      onSaved();
      onCancel();
    } catch (error) {
      setMessage({
        tone: "bad",
        text: error instanceof ApiError ? error.message : t("The story could not be saved."),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-3 p-4">
      <Input
        label="Headline"
        value={headline}
        maxLength={160}
        onChange={(e) => setHeadline(e.target.value)}
        placeholder="What the student says happened"
      />
      <Textarea
        label="The story, in their words"
        rows={5}
        maxLength={8000}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        hint="Write what they said, not what it proves. No outcome is promised by quoting one family."
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          label="Named as"
          value={attribution}
          maxLength={80}
          onChange={(e) => setAttribution(e.target.value)}
          placeholder="Riya, class of 2026"
          hint="However they asked to be named. Nothing that locates them."
        />
        <Input
          label="Year (optional)"
          value={year}
          inputMode="numeric"
          maxLength={4}
          onChange={(e) => setYear(e.target.value.replace(/\D/g, ""))}
        />
      </div>
      <Select
        label="Which destination this is about"
        value={country}
        onChange={(e) => setCountry(e.target.value)}
        options={[
          { value: "", label: "None — a general account" },
          ...countries.map((item) => ({ value: item.slug, label: item.name })),
        ]}
        hint="It links the story to a country page. A story needs no destination to be true."
      />
      <Input
        label="They agreed to this being published on"
        type="date"
        value={consent}
        onChange={(e) => setConsent(e.target.value)}
        hint="A story cannot go public without this date. It is the day they said yes, not today's date."
      />
      <Checkbox
        label="Published on the public pages"
        checked={published}
        onChange={(event) => setPublished(event.target.checked)}
      />
      {message ? <Notice tone={message.tone} text={message.text} /> : null}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" loading={busy} onClick={() => void save()}>
          {existing ? t("Save") : t("Add as draft")}
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          {t("Cancel")}
        </Button>
      </div>
      <p className="text-[11px] leading-relaxed text-muted">
        {t("A published story appears on /study-abroad. Withdraw it by clearing the tick; the words stay until the family asks for them to be deleted, and deletion here removes the row completely.")}
      </p>
    </Card>
  );
}

function StoriesPanel({ countries }: { countries: StudyCountryCard[] }) {
  const t = useT();
  const [editing, setEditing] = useState<StudyStoryAdmin | "new" | null>(null);
  const list = useResource(useCallback(() => api.adminStudyStories(), []), true);
  const rows = list.data ?? [];

  async function remove(story: StudyStoryAdmin) {
    try {
      await api.deleteStudyStory(story.id);
      list.reload();
    } catch {
      // The row is still there and the list will show it; a silent failure would be worse.
    }
  }

  if (list.state === "loading" && list.data === null) return <LoadingPanel label="Loading stories" />;

  return (
    <div className="space-y-4">
      {list.state === "error" ? <ErrorState description={list.error ?? undefined} onRetry={list.reload} /> : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs leading-relaxed text-muted">
          {t("This table starts empty and stays empty until a named person agrees. Nothing here can invent a story, and the public page says there are none rather than showing a quote nobody wrote.")}
        </p>
        <Button size="sm" variant="outline" onClick={() => setEditing("new")}>
          <Plus className="h-4 w-4" aria-hidden />
          {t("Add a story")}
        </Button>
      </div>

      {editing ? (
        <StoryEditor
          existing={editing === "new" ? null : editing}
          countries={countries}
          onSaved={list.reload}
          onCancel={() => setEditing(null)}
        />
      ) : null}

      {rows.length === 0 && !editing ? (
        <EmptyState
          icon={Inbox}
          title="No story has been recorded"
          description="Add one only when somebody has agreed to being named, and note the date they said so."
        />
      ) : (
        <div className="space-y-3">
          {rows.map((story) => (
            <Card key={story.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">{story.headline}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {story.attribution}
                    {story.year ? ` · ${story.year}` : ""} · {t("consent")} {day(story.consent_confirmed_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={story.published ? "success" : "neutral"}>
                    {story.published ? t("Published") : t("Draft")}
                  </Badge>
                  <Button variant="outline" size="sm" onClick={() => setEditing(story)}>
                    {t("Edit")}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => void remove(story)}>
                    <Trash2 className="h-4 w-4" aria-hidden />
                    {t("Delete")}
                  </Button>
                </div>
              </div>
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink">{story.body}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------------- the screen

type Access = "loading" | "admin" | "forbidden" | "offline";

export default function StudyAbroadAdminScreen() {
  const t = useT();
  const { status: session } = useSession();
  const [access, setAccess] = useState<Access>("loading");
  const [tab, setTab] = useState("leads");
  const [countries, setCountries] = useState<StudyCountryCard[]>([]);

  useEffect(() => {
    if (session !== "ready") return;
    let active = true;
    api
      .adminStudyMe()
      .then(() => active && setAccess("admin"))
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof ApiError && error.status === 403) setAccess("forbidden");
        else if (error instanceof ApiError && error.status === 401) setAccess("forbidden");
        else setAccess("offline");
      });
    return () => {
      active = false;
    };
  }, [session]);

  useEffect(() => {
    if (access !== "admin") return;
    let active = true;
    api
      .studyCountries()
      .then((rows) => active && setCountries(rows))
      .catch(() => active && setCountries([]));
    return () => {
      active = false;
    };
  }, [access]);

  if (access === "loading") {
    return (
      <Screen title="Study abroad — operator">
        <LoadingPanel label="Checking this account" />
      </Screen>
    );
  }

  if (access !== "admin") {
    return (
      <Screen title="Study abroad — operator">
        <ErrorState
          title="This screen is not open to this account"
          description={
            access === "offline"
              ? "The server could not be reached, so it could not say whether this account is the operator's."
              : "Only the account holding the is_admin flag may read enquiries or edit the directory. That flag is not something a screen or a signup can set."
          }
          extra={
            <div className="mt-3 space-y-2">
              <p className="text-xs leading-relaxed text-muted">
                {t("On the server, run")}{" "}
                <code className="rounded bg-canvas px-1.5 py-0.5 font-mono text-[11px]">
                  python scripts/admin_grant.py --email the-address-on-the-account
                </code>{" "}
                {t("for the confirmed address this account signs in with, then reload this page. Pass")}{" "}
                <code className="rounded bg-canvas px-1.5 py-0.5 font-mono text-[11px]">--revoke</code>{" "}
                {t("to take it back.")}
              </p>
              <LinkButton variant="outline" size="sm" href="/study-abroad">
                {t("The public pages")}
              </LinkButton>
            </div>
          }
        />
      </Screen>
    );
  }

  return (
    <Screen
      title="Study abroad — operator"
      description="Enquiries, the university directory, and the stories. The three tables that hold what a family reads and what they told us."
      badge={
        <Badge tone="brand" icon={<ShieldCheck className="h-3.5 w-3.5" aria-hidden />}>
          {t("Admin")}
        </Badge>
      }
      action={
        <Link
          className="text-sm text-brand underline-offset-2 hover:underline"
          href="/study-abroad"
          target="_blank"
        >
          {t("See the public pages")}
        </Link>
      }
    >
      <div className="space-y-5">
        <PillGroup
          items={[
            { value: "leads", label: "Enquiries" },
            { value: "universities", label: "Universities" },
            { value: "stories", label: "Stories" },
          ]}
          value={tab}
          onChange={setTab}
        />
        {tab === "leads" ? <LeadsPanel /> : null}
        {tab === "universities" ? <UniversitiesPanel countries={countries} /> : null}
        {tab === "stories" ? <StoriesPanel countries={countries} /> : null}
      </div>
    </Screen>
  );
}
