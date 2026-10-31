"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import {
  ExternalLink,
  GraduationCap,
  Info,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
} from "lucide-react";

import { Screen } from "@/components/layout/app-shell";
import { Caption, Notice, day } from "@/components/admin/operator-ui";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox, Input, Select, Textarea } from "@/components/ui/field";
import { EmptyState, ErrorState, LoadingPanel } from "@/components/ui/feedback";
import { ApiError, api } from "@/lib/api";
import { useResource } from "@/lib/use-resource";
import { useT, useTf } from "@/lib/i18n";
import type {
  ExamAdminRow,
  ExamCreateInput,
  ExamGroupAdminRow,
  ExamGroupUpdateInput,
  ExamUpdateInput,
} from "@/lib/types";

/**
 * The exam catalogue: `/app/admin/exams`.
 *
 * What was a `const` in the student's bundle is a table here, which means a wrong sentence
 * about NEET or a notification that finally got read can be fixed without a deploy. The
 * screen is deliberately small: the doors, the exams under them, and one form to add an
 * exam. No funnel, no export, no bulk edit.
 *
 * Two rules the server enforces and this page repeats rather than works around:
 *
 * * **A date or a fee is a record, not a sentence.** `exam_date` and `fee_note` are refused
 *   unless the row carries a `source_url`, and a brand-new row has no such field in its
 *   body at all — so a new exam is a name, a conducting body and four sentences, and the
 *   figures come later, with the page they were read off. The public card then prints
 *   nothing until the row is verified, which is why leaving these boxes empty is the
 *   correct state rather than unfinished work.
 * * **Verification is stamped, not typed.** Ticking "verified" without a source is refused,
 *   and clearing the source of a verified row is refused, so a badge cannot outlive the
 *   thing that earned it. The date shown beside the tick is the server's, for today.
 *
 * Writes here share the operator's bucket (`RATE_LIMIT_ADMIN`, ten a minute). A 429 is the
 * throttle answering, not a broken form: it clears within the minute.
 */

const FIGURE_HINT =
  "Empty means the public card prints no date at all and names this year's official notification instead. That is the correct state until a person reads the figure.";

// ------------------------------------------------------------------ the exam editor

type ExamDraft = {
  name: string;
  authority: string;
  description: string;
  careers: string;
  timeline: string;
  preparation: string;
  exam_date: string;
  fee_note: string;
  source_url: string;
  verified: boolean;
  is_active: boolean;
};

function draftFrom(exam: ExamAdminRow): ExamDraft {
  return {
    name: exam.name,
    authority: exam.authority,
    description: exam.description,
    careers: exam.careers,
    timeline: exam.timeline,
    preparation: exam.preparation,
    exam_date: exam.exam_date ?? "",
    fee_note: exam.fee_note ?? "",
    source_url: exam.source_url ?? "",
    verified: exam.verified,
    is_active: exam.is_active,
  };
}

/** Only what moved is sent: an unchanged field in the body would log a change that did not happen. */
function patchFrom(exam: ExamAdminRow, draft: ExamDraft): ExamUpdateInput {
  const patch: ExamUpdateInput = {};
  const text = (field: keyof ExamDraft) => {
    const before = exam[field as keyof ExamAdminRow];
    const after = String(draft[field]);
    if (after.trim() !== String(before ?? "").trim()) {
      (patch as Record<string, string | null>)[field] = after.trim() || null;
    }
  };
  for (const field of [
    "name",
    "authority",
    "description",
    "careers",
    "timeline",
    "preparation",
    "exam_date",
    "fee_note",
    "source_url",
  ] as const) {
    text(field);
  }
  if (draft.verified !== exam.verified) patch.verified = draft.verified;
  if (draft.is_active !== exam.is_active) patch.is_active = draft.is_active;
  return patch;
}

function ExamEditor({ exam, onSaved }: { exam: ExamAdminRow; onSaved: () => void }) {
  const t = useT();
  const tf = useTf();
  const [draft, setDraft] = useState<ExamDraft>(() => draftFrom(exam));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);

  const set = (field: keyof ExamDraft, value: string | boolean) =>
    setDraft((current) => ({ ...current, [field]: value }));

  const patch = patchFrom(exam, draft);
  const changed = Object.keys(patch).length > 0;

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      await api.adminPatchExam(exam.id, patch);
      setMessage({
        tone: "ok",
        text: draft.verified
          ? t("Saved. The server stamped today as the verification date.")
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
        <Input
          label="Name"
          value={draft.name}
          maxLength={120}
          onChange={(event) => set("name", event.target.value)}
        />
        <Input
          label="Conducting body, as the card prints it"
          value={draft.authority}
          maxLength={160}
          onChange={(event) => set("authority", event.target.value)}
          placeholder="Conducted by NTA"
          hint={t("Naming whose exam it is tells a family whose official site is the authority.")}
        />
      </div>

      <Textarea
        label="What it is for"
        rows={3}
        maxLength={4000}
        value={draft.description}
        onChange={(event) => set("description", event.target.value)}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Textarea
          label="Careers it opens"
          rows={3}
          maxLength={4000}
          value={draft.careers}
          onChange={(event) => set("careers", event.target.value)}
        />
        <Textarea
          label="When students usually notice it"
          rows={3}
          maxLength={4000}
          value={draft.timeline}
          onChange={(event) => set("timeline", event.target.value)}
        />
      </div>
      <Textarea
        label="In class 9 or 10 now — costs nothing"
        rows={3}
        maxLength={4000}
        value={draft.preparation}
        onChange={(event) => set("preparation", event.target.value)}
      />

      <div className="space-y-2 rounded-card border border-warning/30 bg-warning-mist/50 p-3">
        <p className="flex items-start gap-1.5 text-xs leading-relaxed text-ink">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {t(
            "The two boxes below are the only ones on this form that a child may read as a fact. They need the page they came from, and the server refuses them without it.",
          )}
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Date, as the notification states it"
            value={draft.exam_date}
            maxLength={120}
            onChange={(event) => set("exam_date", event.target.value)}
            placeholder="Leave empty until you have read it"
          />
          <Input
            label="Fee, as the notification states it"
            value={draft.fee_note}
            maxLength={200}
            onChange={(event) => set("fee_note", event.target.value)}
            placeholder="Leave empty until you have read it"
          />
        </div>
        <Input
          label="Source URL — the page you read this from"
          value={draft.source_url}
          maxLength={500}
          onChange={(event) => set("source_url", event.target.value)}
          placeholder="https://…/annual-notification"
          hint={
            exam.verified_at
              ? tf("Verified on {date}. Clearing this link while the row is verified is refused.", {
                  date: day(exam.verified_at),
                })
              : t("Without a source here, the verified tick cannot be set.")
          }
        />
      </div>

      <div className="space-y-2">
        <Checkbox
          label="Verified against the source"
          description={t("Refused without a source URL above. The date is stamped by the server, never typed.")}
          checked={draft.verified}
          onChange={(event) => set("verified", event.target.checked)}
        />
        <Checkbox
          label="On the page"
          description={t("Off means hidden, not deleted: the four sentences stay for when it is right again.")}
          checked={draft.is_active}
          onChange={(event) => set("is_active", event.target.checked)}
        />
      </div>

      {message ? <Notice tone={message.tone} text={message.text} /> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" loading={busy} disabled={!changed} onClick={() => void save()}>
          {t("Save changes")}
        </Button>
        {!changed ? <span className="text-xs text-muted">{t("Nothing has changed yet.")}</span> : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------- one exam row

function ExamRow({ exam, onSaved }: { exam: ExamAdminRow; onSaved: () => void }) {
  const t = useT();
  const tf = useTf();
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    try {
      await api.adminDeleteExam(exam.id);
      onSaved();
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : t("Could not be deleted."));
      setBusy(false);
    }
  }

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">{exam.name}</p>
          <p className="mt-0.5 text-xs text-muted">{exam.authority}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!exam.is_active ? <Badge tone="neutral">{t("Hidden")}</Badge> : null}
          <Badge tone={exam.verified ? "success" : "neutral"}>
            {exam.verified
              ? tf("Verified {date}", { date: day(exam.verified_at) })
              : t("No verified figure")}
          </Badge>
          <Button variant="outline" size="sm" onClick={() => setOpen(!open)}>
            <Pencil className="h-4 w-4" aria-hidden />
            {open ? t("Close") : t("Edit")}
          </Button>
        </div>
      </div>

      <p className="mt-2 text-sm leading-relaxed text-muted">
        {exam.exam_date || exam.fee_note
          ? tf("Public card shows: {figures}", {
              figures: [exam.exam_date, exam.fee_note].filter(Boolean).join(" · "),
            })
          : t("Public card shows no date and no fee — it names the official notification.")}
      </p>

      {open ? <ExamEditor exam={exam} onSaved={onSaved} /> : null}

      <div className="mt-3 border-t border-line pt-3">
        {confirmDelete ? (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="danger" loading={busy} onClick={() => void remove()}>
                <Trash2 className="h-4 w-4" aria-hidden />
                {t("Delete the row")}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                {t("Keep it")}
              </Button>
            </div>
            {message ? <Notice tone="bad" text={message} /> : null}
            <p className="text-xs leading-relaxed text-muted">
              {t(
                "Hiding it is usually the answer: a card can be wrong for a year and right again. Deleting removes the row and its verification, and there is no undo on this screen.",
              )}
            </p>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="h-4 w-4" aria-hidden />
            {t("Delete")}
          </Button>
        )}
      </div>
    </Card>
  );
}

// ------------------------------------------------------------------- one door

function GroupCard({
  group,
  onSaved,
}: {
  group: ExamGroupAdminRow;
  onSaved: () => void;
}) {
  const t = useT();
  const tf = useTf();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(group.title);
  const [description, setDescription] = useState(group.description);
  const [isActive, setIsActive] = useState(group.is_active);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteNote, setDeleteNote] = useState<string | null>(null);

  const patch: ExamGroupUpdateInput = {};
  if (title.trim() !== group.title) patch.title = title.trim();
  if (description.trim() !== group.description) patch.description = description.trim();
  if (isActive !== group.is_active) patch.is_active = isActive;
  const changed = Object.keys(patch).length > 0;

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      await api.adminPatchExamGroup(group.id, patch);
      setMessage({ tone: "ok", text: t("Saved.") });
      onSaved();
    } catch (error) {
      setMessage({
        tone: "bad",
        text: error instanceof ApiError ? error.message : t("The door could not be saved."),
      });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setDeleteNote(null);
    try {
      await api.adminDeleteExamGroup(group.id);
      onSaved();
    } catch (error) {
      // The server refuses a door that still has exams under it, in its own words.
      setDeleteNote(error instanceof ApiError ? error.message : t("Could not be deleted."));
      setBusy(false);
      onSaved();
    }
  }

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">
            {group.title}
            {!group.is_active ? <span className="ml-2 text-xs font-normal text-muted">{t("hidden")}</span> : null}
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted">{group.description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="brand">
            {tf("{count} exam{s}", { count: group.exams.length, s: group.exams.length === 1 ? "" : "s" })}
          </Badge>
          <Button variant="outline" size="sm" onClick={() => setOpen(!open)}>
            <Pencil className="h-4 w-4" aria-hidden />
            {open ? t("Close") : t("Edit the door")}
          </Button>
        </div>
      </div>

      {open ? (
        <div className="mt-4 space-y-3 border-t border-line pt-4">
          <Input
            label="Heading, as students see it"
            value={title}
            maxLength={120}
            onChange={(event) => setTitle(event.target.value)}
          />
          <Textarea
            label="What this door is for"
            rows={2}
            maxLength={4000}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
          <Checkbox
            label="On the page"
            description={t("A door with nothing under it does not show to students either way.")}
            checked={isActive}
            onChange={(event) => setIsActive(event.target.checked)}
          />
          {message ? <Notice tone={message.tone} text={message.text} /> : null}
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm" loading={busy} disabled={!changed} onClick={() => void save()}>
              {t("Save changes")}
            </Button>
            {!changed ? <span className="text-xs text-muted">{t("Nothing has changed yet.")}</span> : null}
          </div>
        </div>
      ) : null}

      <div className="mt-4 space-y-2">
        {group.exams.map((exam) => (
          <ExamRow key={exam.id} exam={exam} onSaved={onSaved} />
        ))}
      </div>

      <div className="mt-3 border-t border-line pt-3">
        {confirmDelete ? (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="danger" loading={busy} onClick={() => void remove()}>
                {t("Delete the door")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setConfirmDelete(false);
                  setDeleteNote(null);
                }}
              >
                {t("Keep it")}
              </Button>
            </div>
            {deleteNote ? <Notice tone="bad" text={deleteNote} /> : null}
            <p className="text-xs leading-relaxed text-muted">
              {t(
                "A door that still has exams under it is refused, so nothing a student is reading disappears with a heading. Hide it instead, or move the exams out first.",
              )}
            </p>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="h-4 w-4" aria-hidden />
            {t("Delete")}
          </Button>
        )}
      </div>
    </Card>
  );
}

// -------------------------------------------------------------------- add an exam

function AddExamForm({ groups, onAdded }: { groups: ExamGroupAdminRow[]; onAdded: () => void }) {
  const t = useT();
  const [groupId, setGroupId] = useState("");
  const [name, setName] = useState("");
  const [authority, setAuthority] = useState("");
  const [description, setDescription] = useState("");
  const [careers, setCareers] = useState("");
  const [timeline, setTimeline] = useState("");
  const [preparation, setPreparation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);

  const ready =
    groupId !== "" &&
    Boolean(name.trim()) &&
    Boolean(authority.trim()) &&
    Boolean(description.trim()) &&
    Boolean(careers.trim()) &&
    Boolean(timeline.trim()) &&
    Boolean(preparation.trim());

  async function add() {
    setBusy(true);
    setMessage(null);
    try {
      const body: ExamCreateInput = {
        group_id: Number(groupId),
        name: name.trim(),
        authority: authority.trim(),
        description: description.trim(),
        careers: careers.trim(),
        timeline: timeline.trim(),
        preparation: preparation.trim(),
      };
      await api.adminCreateExam(body);
      setMessage({
        tone: "ok",
        text: t("Added with no date, no fee and no verification — which is the only correct way for a row to arrive."),
      });
      setName("");
      setAuthority("");
      setDescription("");
      setCareers("");
      setTimeline("");
      setPreparation("");
      onAdded();
    } catch (error) {
      setMessage({
        tone: "bad",
        text: error instanceof ApiError ? error.message : t("The exam could not be added."),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-3 p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Select
          label="Under which door"
          value={groupId}
          onChange={(event) => setGroupId(event.target.value)}
          options={groups.map((group) => ({ value: String(group.id), label: group.title }))}
          placeholder="Choose a door"
        />
        <Input
          label="Name"
          value={name}
          maxLength={120}
          onChange={(event) => setName(event.target.value)}
          placeholder="JEE Main"
        />
        <Input
          label="Conducting body"
          value={authority}
          maxLength={160}
          onChange={(event) => setAuthority(event.target.value)}
          placeholder="Conducted by NTA"
        />
      </div>

      <Textarea
        label="What it is for"
        rows={2}
        maxLength={4000}
        value={description}
        onChange={(event) => setDescription(event.target.value)}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Textarea
          label="Careers it opens"
          rows={2}
          maxLength={4000}
          value={careers}
          onChange={(event) => setCareers(event.target.value)}
        />
        <Textarea
          label="When students usually notice it"
          rows={2}
          maxLength={4000}
          value={timeline}
          onChange={(event) => setTimeline(event.target.value)}
        />
      </div>
      <Textarea
        label="In class 9 or 10 now — costs nothing"
        rows={2}
        maxLength={4000}
        value={preparation}
        onChange={(event) => setPreparation(event.target.value)}
      />

      <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        {t(
          "All six of these are what a student will read, so they are written here rather than left as a stub — the server refuses a row whose sentences are too short to be sentences. A new exam has no date, no fee and no verification; those enter later, from the edit card, with the page they were read from.",
        )}
      </p>
      {message ? <Notice tone={message.tone} text={message.text} /> : null}
      <Button size="sm" loading={busy} disabled={!ready} onClick={() => void add()}>
        <Plus className="h-4 w-4" aria-hidden />
        {t("Add the exam")}
      </Button>
    </Card>
  );
}

// ------------------------------------------------------------------------- the screen

export default function ExamsAdminScreen() {
  const t = useT();
  const tf = useTf();
  const load = useCallback(() => api.adminExams(), []);
  const list = useResource<ExamGroupAdminRow[]>(load, true);
  const groups = list.data ?? [];
  const [adding, setAdding] = useState(false);

  const examCount = groups.reduce((total, group) => total + group.exams.length, 0);
  const unverified = groups.reduce(
    (total, group) => total + group.exams.filter((exam) => !exam.verified).length,
    0,
  );

  if (list.state === "loading" && list.data === null) {
    return (
      <Screen title="Exams — operator">
        <LoadingPanel label="Loading the exam catalogue" />
      </Screen>
    );
  }

  if (list.state === "error") {
    return (
      <Screen title="Exams — operator">
        <ErrorState description={list.error ?? undefined} onRetry={list.reload} />
      </Screen>
    );
  }

  return (
    <Screen
      title="Exams — operator"
      description="The map a class 11 or 12 student reads. The sentences are general information; a date or a fee is a record, and a record needs the page it came from."
      badge={
        <Badge tone="brand" icon={<ShieldCheck className="h-3.5 w-3.5" aria-hidden />}>
          {t("Admin")}
        </Badge>
      }
      action={
        <Link
          className="inline-flex items-center gap-1.5 text-sm text-brand underline-offset-2 hover:underline"
          href="/app/exams"
          target="_blank"
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          {t("See the student's map")}
        </Link>
      }
    >
      <div className="space-y-5">
        <Card className="space-y-1 p-4">
          <p className="text-sm text-ink">
            {tf("{doors} doors and {exams} exams.", { doors: groups.length, exams: examCount })}
          </p>
          <Caption>
            {unverified === 0
              ? t("Every row has a verified figure recorded against a source.")
              : tf("{count} of them have no verified date or fee, so their cards print the official notification instead. That is the state the seed was written in, and it is a correct state — not a queue to empty.", {
                  count: unverified,
                })}
          </Caption>
          <Caption>{t(FIGURE_HINT)}</Caption>
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs leading-relaxed text-muted">
            {t("Writes here are limited to ten a minute. A refusal prints the server's own sentence below the button.")}
          </p>
          {groups.length > 0 ? (
            <Button variant="outline" size="sm" onClick={() => setAdding(!adding)}>
              <Plus className="h-4 w-4" aria-hidden />
              {adding ? t("Cancel") : t("Add an exam")}
            </Button>
          ) : null}
        </div>

        {adding && groups.length > 0 ? (
          <AddExamForm groups={groups} onAdded={list.reload} />
        ) : null}

        {groups.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title="The catalogue is empty"
            description="No door and no exam has been written into the database. The public page shows this as an empty map rather than filling it in from memory."
            action={
              <LinkButton href="/app/admin/content" variant="outline" size="sm">
                {t("The careers catalogue")}
              </LinkButton>
            }
          />
        ) : (
          <div className="space-y-4">
            {groups.map((group) => (
              <GroupCard key={group.id} group={group} onSaved={list.reload} />
            ))}
          </div>
        )}
      </div>
    </Screen>
  );
}
