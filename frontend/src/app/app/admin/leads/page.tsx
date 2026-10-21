"use client";

import { useCallback, useState } from "react";
import { ChevronDown, ChevronUp, Inbox, Trash2 } from "lucide-react";

import { Screen } from "@/components/layout/app-shell";
import { Caption, Notice, dateTime, day } from "@/components/admin/operator-ui";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, Textarea } from "@/components/ui/field";
import { EmptyState, ErrorState, LoadingPanel } from "@/components/ui/feedback";
import { PillGroup } from "@/components/ui/tabs";
import { ApiError, api } from "@/lib/api";
import { useT, useTf } from "@/lib/i18n";
import { useResource } from "@/lib/use-resource";
import type { StudyLeadAdmin } from "@/lib/types";

/**
 * The enquiry queue: `/app/admin/leads`.
 *
 * Everything a family asked through the public study-abroad pages lands here, and this
 * screen can do exactly two things with it: mark where the enquiry has got to, and write a
 * note to itself. The name, the address, the phone number and the message are what a person
 * typed — the server will not accept a change to any of them, which is the difference
 * between an inbox and a place where somebody else's words get edited.
 *
 * Three facts the panel states rather than hides:
 *
 * * **Consent is shown, not assumed.** `consent_contact` is the ticked box on the form and
 *   `consent_contact_at` is when. An address arrived by mail merge is not permission to
 *   write to it, so the flag sits next to the address it covers.
 * * **The queue is the newest hundred.** The public form is throttled per network, not per
 *   account, so a school's counselling office can send a class at once. If the list is
 *   fuller than a page, the search box is the way down into it.
 * * **Deleting is final.** There is no archive and no undo on this side, so the button asks
 *   twice and the note travels with the row it belongs to.
 *
 * The same queue appears inside the study-abroad operator screen, which is where the
 * university directory and the stories live. This page is the enquiries on their own.
 */

const STATUSES = [
  { value: "", label: "All" },
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "closed", label: "Closed" },
];

const STATUS_TONE: Record<string, "neutral" | "brand" | "success" | "warning"> = {
  new: "warning",
  contacted: "brand",
  closed: "neutral",
};

const PAGE = 100;

function LeadRow({
  lead,
  onTouched,
}: {
  lead: StudyLeadAdmin;
  onTouched: (next: StudyLeadAdmin) => void;
}) {
  const t = useT();
  const tf = useTf();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(lead.status);
  const [note, setNote] = useState(lead.admin_note ?? "");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const dirty = status !== lead.status || note.trim() !== (lead.admin_note ?? "").trim();

  async function save() {
    setBusy(true);
    setNotice(null);
    try {
      const saved = await api.handleStudyLead(lead.id, {
        status: status as "new" | "contacted" | "closed",
        admin_note: note,
      });
      onTouched(saved);
      setNotice({
        tone: "ok",
        text: saved.handled_at
          ? tf("Saved. Their own words were not touched, and the handling is stamped {at}.", {
              at: dateTime(saved.handled_at),
            })
          : "Saved. Their own words were not touched.",
      });
    } catch (error: unknown) {
      setNotice({
        tone: "bad",
        text: error instanceof ApiError ? error.message : "The server did not answer, so nothing was saved.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setNotice(null);
    try {
      await api.deleteStudyLead(lead.id);
      onTouched({ ...lead, status: "deleted" });
    } catch (error: unknown) {
      setNotice({
        tone: "bad",
        text: error instanceof ApiError ? error.message : "The server did not answer, so it is still here.",
      });
      setBusy(false);
    }
  }

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
            {lead.name}
            <Badge tone={STATUS_TONE[lead.status] ?? "neutral"}>
              {lead.status === "new" ? t("New") : lead.status === "contacted" ? t("Contacted") : t("Closed")}
            </Badge>
            {lead.consent_contact ? (
              <Badge tone="success">{t("Contact allowed")}</Badge>
            ) : (
              <Badge tone="danger">{t("No consent to contact")}</Badge>
            )}
          </p>
          <p className="mt-1 text-xs text-muted">
            {lead.email}
            {lead.phone ? ` · ${lead.phone}` : ""} · {tf("asked {date}", { date: day(lead.created_at) })}
            {lead.consent_contact_at
              ? ` · ${tf("consent {date}", { date: day(lead.consent_contact_at) })}`
              : ""}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {lead.stage ? tf("Stage: {stage}", { stage: lead.stage }) : t("No stage given")}
            {lead.source_page ? ` · ${tf("from {page}", { page: lead.source_page })}` : ""}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button variant={open ? "secondary" : "outline"} size="sm" onClick={() => setOpen(!open)}>
            {open ? <ChevronUp className="h-4 w-4" aria-hidden /> : <ChevronDown className="h-4 w-4" aria-hidden />}
            {open ? t("Hide") : t("Read it")}
          </Button>
        </div>
      </div>

      {open ? (
        <div className="mt-3 space-y-3 border-t border-line pt-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted">{t("Their message, as typed")}</p>
            <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-ink">
              {lead.message?.trim() ? lead.message : t("They sent no message — only the form and their details.")}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              label="Where this has got to"
              options={STATUSES.filter((option) => option.value !== "")}
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              hint="An enquiry nobody has answered yet is still “new”."
            />
            <Textarea
              label="Note to yourself"
              value={note}
              rows={3}
              maxLength={2000}
              onChange={(event) => setNote(event.target.value)}
              hint="Only you and the other operators read this. It is not sent to the family."
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => void save()} loading={busy} disabled={!dirty}>
              {dirty ? t("Save") : t("Nothing to save")}
            </Button>
            {confirmDelete ? (
              <>
                <Button variant="danger" size="sm" loading={busy} onClick={() => void remove()}>
                  <Trash2 className="h-4 w-4" aria-hidden />
                  {t("Yes, delete it")}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                  {t("Keep it")}
                </Button>
              </>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="h-4 w-4" aria-hidden />
                {t("Delete")}
              </Button>
            )}
          </div>

          {confirmDelete && !busy ? (
            <p className="text-xs leading-relaxed text-danger">
              {t(
                "Deleting removes the row and there is no undo and no archive. Closing the enquiry keeps it on the list and says it is finished, which is nearly always what is wanted.",
              )}
            </p>
          ) : null}

          {notice ? <Notice tone={notice.tone} text={notice.text} /> : null}

          {lead.handled_at ? (
            <p className="text-xs text-muted">{tf("Last handled {at}.", { at: dateTime(lead.handled_at) })}</p>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

export default function AdminLeadsScreen() {
  const t = useT();
  const tf = useTf();
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [applied, setApplied] = useState("");

  const load = useCallback(
    () =>
      api.adminStudyLeads({
        status: status || undefined,
        search: applied.trim() || undefined,
        limit: PAGE,
      }),
    [status, applied],
  );
  const page = useResource(load);

  /**
   * An enquiry that has just been handled is remembered here and folded into the loaded
   * queue at render, so the row shows its new state without the whole list being refetched
   * under the note the operator just wrote. `null` is a delete, and an entry for a row that
   * is not in this filter any more simply never comes up.
   */
  const [handled, setHandled] = useState<Record<number, StudyLeadAdmin | null>>({});
  const rows = (page.data ?? [])
    .map((lead) => (lead.id in handled ? handled[lead.id] : lead))
    .filter((lead): lead is StudyLeadAdmin => lead !== null);

  return (
    <Screen
      title="Enquiries"
      description="What families and schools asked us through the study-abroad pages, in the order it arrived. Their words stay as they typed them."
      badge={<Badge tone="brand">{t("Admin")}</Badge>}
      action={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={page.reload} loading={page.state === "loading"}>
            {t("Reload")}
          </Button>
          <LinkButton variant="ghost" size="sm" href="/study-abroad" target="_blank">
            {t("The public form")}
          </LinkButton>
        </div>
      }
    >
      <div className="space-y-5">
        <PillGroup items={STATUSES} value={status} onChange={setStatus} />

        <form
          className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            setApplied(search);
          }}
        >
          <div className="flex items-end">
            <input
              aria-label={t("Search the enquiries")}
              className="h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink placeholder:text-muted/70 focus:border-brand focus:outline-none"
              placeholder={t("A name, an address, or a word in a message")}
              value={search}
              maxLength={120}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="flex items-end gap-2">
            <Button type="submit" size="sm">
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
          </div>
        </form>

        {page.state === "loading" && rows.length === 0 ? <LoadingPanel label="Opening the queue" /> : null}

        {page.state === "error" && rows.length === 0 ? (
          <ErrorState
            title="The queue would not load"
            description={page.error}
            onRetry={page.reload}
            extra={
              <p className="mt-2 text-xs leading-relaxed text-muted">
                {t(
                  "This list comes from the study-abroad routes, which are behind the same operator flag as the rest of this area. A server that is running but refusing you is a different answer from a server that is not running at all, and the message above says which.",
                )}
              </p>
            }
          />
        ) : null}

        {page.data ? (
          rows.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title={applied || status ? "Nothing matches this" : "No enquiries yet"}
              description={
                applied || status
                  ? "Not an error — this filter has no rows. Try All, or clear the search."
                  : "Nobody has sent the study-abroad form yet. When they do, it appears here and a copy goes to the address in LEAD_NOTIFY_EMAIL."
              }
            />
          ) : (            <div className="space-y-3">
              {rows.map((lead) => (
                <LeadRow
                  key={lead.id}
                  lead={lead}
                  onTouched={(next) =>
                    setHandled((current) => ({
                      ...current,
                      [next.id]: next.status === "deleted" ? null : next,
                    }))
                  }
                />
              ))}
            </div>
          )
        ) : null}

        {page.data ? (
          <Caption>
            {rows.length === 0
              ? "Nothing with this filter, and no enquiry is hidden from it."
              : rows.length >= PAGE
                ? tf(
                    "Only the newest {n} enquiries are listed; the oldest in view is from {date}. An older one is found by searching rather than by paging, because the public form is throttled per network and a school can send a class at once.",
                    { n: PAGE, date: day(rows[rows.length - 1].created_at) },
                  )
                : tf("All {n} with this filter are in view; the oldest is from {date}.", {
                    n: rows.length,
                    date: day(rows[rows.length - 1].created_at),
                  })}
          </Caption>
        ) : null}

        <Card className="border-line">
          <p className="text-sm font-semibold text-ink">{t("What this queue is, and is not")}</p>
          <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-muted">
            <li>
              {t(
                "It is a copy of what a person chose to send. An enquiry does not create an account, does not start a conversation, and does not appear anywhere in a child’s profile.",
              )}
            </li>
            <li>
              {t(
                "A contact address here is for answering this enquiry. It is not added to a mailing list, and there is no route that reads this table to send anything else.",
              )}
            </li>
            <li>
              {t(
                "An enquiry from a school about a class is the same row as one from a parent about a child. Nothing in this table decides what either of them is recommended.",
              )}
            </li>
          </ul>
        </Card>
      </div>
    </Screen>
  );
}
