"use client";

import { useCallback, useState, type ChangeEvent } from "react";
import { ChevronUp, Pencil } from "lucide-react";

import { Screen } from "@/components/layout/app-shell";
import { Caption, Notice, Pager, fromLines, toLines } from "@/components/admin/operator-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/field";
import { EmptyState, ErrorState, LoadingPanel } from "@/components/ui/feedback";
import { PillGroup } from "@/components/ui/tabs";
import { ApiError, api } from "@/lib/api";
import { useResource } from "@/lib/use-resource";
import { useT, useTf } from "@/lib/i18n";
import type {
  AdminCareerPatch,
  AdminCareerRow,
  AdminQuestionPatch,
  AdminQuestionRow,
  Career,
  Category,
} from "@/lib/types";

/**
 * The catalogue: `/app/admin/content`.
 *
 * Three tabs, and only two of them hold a form.
 *
 * * **Careers.** A row here is something a child may be reading right now, so editing is
 *   allowed and certification is not. `needs_verification` is refused by the server in both
 *   directions — a flag meaning somebody checked the row against a source cannot be set by a
 *   form that has read no source — and `slug` is not editable because it is the address in
 *   somebody's saved list and in a report that has already been printed.
 * * **Questions.** An item nobody has answered may be reworded. An item with answers stored
 *   against it may not: editing the text under a stored answer would silently change what a
 *   completed sitting means, and a score is a claim about a child. The count of answers is
 *   printed on the row, so the refusal is visible before anybody types, and the server gives
 *   the same answer again if they type it anyway.
 * * **Blog.** No editor, and no fake one. A post is a markdown file in this repository
 *   beside the code that renders it; this API has no copy of that filesystem and no route
 *   that could publish a page. The tab says so in the API's own words and names the path and
 *   the way a post gets published. A Save button that discarded the text would be the worse
 *   product.
 *
 * Money never appears on this page. The catalogue, the bank and the recommendations are the
 * same for every account on every plan.
 */

const CAREER_FILTERS = [
  { value: "", label: "All entries" },
  { value: "true", label: "Waiting to be verified" },
  { value: "false", label: "Already checked" },
];

// ------------------------------------------------------------------ the career editor

/** The `string[]` fields, edited as one item per line. `official_links` is not among them. */
const LIST_FIELDS = [
  "typical_activities",
  "useful_skills",
  "school_subjects",
  "education_pathways",
  "entry_requirements",
  "preparation_stages",
  "benefits",
  "challenges",
  "explore_activities",
  "related_slugs",
  "interest_themes",
] as const;

const LIST_LABELS: Record<(typeof LIST_FIELDS)[number], string> = {
  typical_activities: "What the work looks like",
  useful_skills: "Skills that help",
  school_subjects: "School subjects behind it",
  education_pathways: "Education pathways",
  entry_requirements: "Entry requirements",
  preparation_stages: "How to prepare, in stages",
  benefits: "What people like about it",
  challenges: "What people find hard about it",
  explore_activities: "Things to try this month",
  related_slugs: "Related careers (slugs)",
  interest_themes: "Interest themes",
};

type CareerDraft = {
  title: string;
  category: string;
  min_class: string;
  summary: string;
  typical_day: string;
  costs_and_alternatives: string;
} & Record<(typeof LIST_FIELDS)[number], string>;

function draftFrom(career: Career): CareerDraft {
  return {
    title: career.title,
    category: career.category,
    min_class: String(career.min_class),
    summary: career.summary,
    typical_day: career.typical_day ?? "",
    costs_and_alternatives: career.costs_and_alternatives ?? "",
    typical_activities: toLines(career.typical_activities),
    useful_skills: toLines(career.useful_skills),
    school_subjects: toLines(career.school_subjects),
    education_pathways: toLines(career.education_pathways),
    entry_requirements: toLines(career.entry_requirements),
    preparation_stages: toLines(career.preparation_stages),
    benefits: toLines(career.benefits),
    challenges: toLines(career.challenges),
    explore_activities: toLines(career.explore_activities),
    related_slugs: toLines(career.related_slugs),
    interest_themes: toLines(career.interest_themes),
  };
}

/**
 * Only the fields that moved are sent. An empty patch is refused by the server, and sending
 * a field the operator did not touch would log a change that did not happen.
 */
function patchFrom(career: Career, draft: CareerDraft): AdminCareerPatch {
  const patch: AdminCareerPatch = {};
  if (draft.title.trim() !== career.title) patch.title = draft.title.trim();
  if (draft.category.trim() !== career.category) patch.category = draft.category.trim();
  if (draft.summary.trim() !== career.summary) patch.summary = draft.summary.trim();
  if (draft.typical_day.trim() !== (career.typical_day ?? "").trim()) {
    patch.typical_day = draft.typical_day.trim();
  }
  if (
    draft.costs_and_alternatives.trim() !== (career.costs_and_alternatives ?? "").trim()
  ) {
    patch.costs_and_alternatives = draft.costs_and_alternatives.trim();
  }
  const minClass = Number(draft.min_class);
  if (Number.isInteger(minClass) && minClass !== career.min_class) patch.min_class = minClass;
  for (const field of LIST_FIELDS) {
    const before = career[field];
    const after = fromLines(draft[field]);
    if (after.join("\n") !== before.join("\n")) patch[field] = after;
  }
  return patch;
}

function CareerEditor({ slug, onSaved }: { slug: string; onSaved: () => void }) {
  const t = useT();
  const tf = useTf();
  const [source, setSource] = useState<Career | null>(null);
  const [draft, setDraft] = useState<CareerDraft | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // The short row the list carries is not enough to edit from, so the whole entry is
  // read through the public route the students use — the same text, no second copy.
  const full = useResource(useCallback(() => api.career(slug), [slug]));
  const entry = full.data;

  // A form filled from data that just arrived is the one supported use of setState during
  // render: React throws this pass away and runs the component again before anything is
  // drawn, so no stale draft is ever on screen. An effect would paint one first.
  if (entry && entry !== source) {
    setSource(entry);
    setDraft(draftFrom(entry));
  }

  if (full.state === "loading" && !entry) return <LoadingPanel label="Reading the entry as it is stored" />;
  if (full.state === "error" && !entry) {
    return <ErrorState description={full.error} onRetry={full.reload} title="This entry would not load" />;
  }
  if (!entry || !draft) return null;

  const changed = Object.keys(patchFrom(entry, draft)).length;

  async function save() {
    if (!entry || !draft) return;
    const patch = patchFrom(entry, draft);
    const moved = Object.keys(patch).length;
    if (moved === 0) {
      setNotice({ tone: "bad", text: "Nothing has been changed yet, so there is nothing to save." });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      await api.adminUpdateCareer(slug, patch);
      setNotice({
        tone: "ok",
        text: tf(
          "Saved. The log says which {moved} field{s} moved, not what they now say.",
          { moved, s: moved > 1 ? "s" : "" },
        ),
      });
      full.reload();
      onSaved();
    } catch (error: unknown) {
      setNotice({
        tone: "bad",
        text:
          error instanceof ApiError
            ? error.message
            : "The server did not answer, so nothing was changed.",
      });
    } finally {
      setBusy(false);
    }
  }

  const field =
    (key: keyof CareerDraft) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setDraft({ ...draft, [key]: event.target.value });

  return (
    <div className="space-y-3 border-t border-line pt-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Input label="Title" value={draft.title} onChange={field("title")} maxLength={120} />
        <Input label="Category" value={draft.category} onChange={field("category")} maxLength={64} />
        <Input
          label="Reads from class"
          value={draft.min_class}
          onChange={field("min_class")}
          inputMode="numeric"
          hint="6 to 12. The server refuses anything outside that."
        />
      </div>

      <Textarea label="Summary" value={draft.summary} onChange={field("summary")} rows={3} hint="At least ten characters." />
      <Textarea label="A typical day" value={draft.typical_day} onChange={field("typical_day")} rows={3} />
      <Textarea
        label="Costs and alternatives"
        value={draft.costs_and_alternatives}
        onChange={field("costs_and_alternatives")}
        rows={3}
        hint="Do not add a salary, a placement rate or an admission promise here. This text is shown to a family as fact."
      />

      {LIST_FIELDS.map((key) => (
        <Textarea
          key={key}
          label={LIST_LABELS[key]}
          value={draft[key]}
          onChange={field(key)}
          rows={3}
          hint="One item per line."
        />
      ))}

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => void save()} loading={busy}>
          {changed > 0
            ? tf("Save {changed} change{s}", { changed, s: changed > 1 ? "s" : "" })
            : t("Save changes")}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => full.reload()}>
          {t("Discard my edits")}
        </Button>
      </div>

      {notice ? <Notice tone={notice.tone} text={notice.text} /> : null}

      <Caption>
        {t("Two things cannot be changed from this form. The address (")}
        <code className="font-mono text-[11px]">{entry.slug}</code>
        {t(") stays, because it lives in saved lists and printed reports. And “checked against a source” stays false until somebody reads a real source beside it — the server refuses that flag in both directions, and the links under “Official links” are edited in the seed file rather than here.")}
      </Caption>
    </div>
  );
}

function CareerRow({ career, onChanged }: { career: AdminCareerRow; onChanged: () => void }) {
  const t = useT();
  const tf = useTf();
  const [open, setOpen] = useState(false);
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
            {career.title}
            {career.needs_verification ? (
              <Badge tone="warning">{t("Waiting to be verified")}</Badge>
            ) : (
              <Badge tone="success">{t("Verified")}</Badge>
            )}
            <Badge tone="neutral">{tf("Class {n}+", { n: career.min_class })}</Badge>
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {career.category} · <span className="font-mono">{career.slug}</span>
          </p>
          <p className="mt-2 text-sm leading-relaxed text-ink">{career.summary}</p>
        </div>
        <Button variant={open ? "secondary" : "outline"} size="sm" onClick={() => setOpen(!open)}>
          {open ? <ChevronUp className="h-4 w-4" aria-hidden /> : <Pencil className="h-4 w-4" aria-hidden />}
          {open ? t("Close") : t("Edit")}
        </Button>
      </div>
      {open ? (
        <div className="mt-3">
          <CareerEditor slug={career.slug} onSaved={onChanged} />
        </div>
      ) : null}
    </Card>
  );
}

function CareersPanel() {
  const t = useT();
  const tf = useTf();
  const [search, setSearch] = useState("");
  const [applied, setApplied] = useState("");
  const [verify, setVerify] = useState("");
  const [offset, setOffset] = useState(0);

  const load = useCallback(
    () =>
      api.adminCareers({
        q: applied.trim() || undefined,
        to_verify: verify === "" ? undefined : verify === "true",
        limit: 20,
        offset,
      }),
    [applied, verify, offset],
  );
  const page = useResource(load);
  const categories = useResource(useCallback(() => api.categories(), []));

  return (
    <div className="space-y-4">
      <form
        className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          setApplied(search);
          setOffset(0);
        }}
      >
        <Input
          label="Find an entry"
          placeholder="A word in a title or a slug"
          value={search}
          maxLength={80}
          onChange={(event) => setSearch(event.target.value)}
        />
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
                setOffset(0);
              }}
            >
              {t("Clear")}
            </Button>
          ) : null}
        </div>
      </form>

      <PillGroup
        items={CAREER_FILTERS}
        value={verify}
        onChange={(next) => {
          setVerify(next);
          setOffset(0);
        }}
      />

      {categories.data && categories.data.length > 0 ? (
        <p className="text-xs leading-relaxed text-muted">
          {t("Categories in use:")} {categories.data.map((c: Category) => `${c.name} (${c.count})`).join(", ")}.
        </p>
      ) : null}

      {page.state === "loading" && !page.data ? <LoadingPanel label="Reading the catalogue" /> : null}
      {page.state === "error" && !page.data ? (
        <ErrorState description={page.error} onRetry={page.reload} title="The catalogue would not load" />
      ) : null}

      {page.data ? (
        page.data.items.length === 0 ? (
          <EmptyState
            title="Nothing matches"
            description={
              applied.trim()
                ? tf(
                    "No career has “{applied}” in its title or slug. The catalogue is only what the seed file and this screen put in it.",
                    { applied: applied.trim() },
                  )
                : "No entry has that verification state."
            }
          />
        ) : (
          <div className="space-y-3">
            {page.data.items.map((career) => (
              <CareerRow key={career.slug} career={career} onChanged={page.reload} />
            ))}
          </div>
        )
      ) : null}

      {page.data ? (
        <Pager
          total={page.data.total}
          limit={page.data.limit}
          offset={page.data.offset}
          onMove={setOffset}
          unit="entries"
        />
      ) : null}

      <Caption>
        {page.data
          ? `${tf("{total} entries in the catalogue.", { total: page.data.total })} `
          : ""}
        {t("“Waiting to be verified” is the working list: every seeded row carries it, and the honest way to clear it is to read a real source beside the entry, then edit the text here. Switching the flag without reading anything is refused by the server, not by this page.")}
      </Caption>
    </div>
  );
}

// ---------------------------------------------------------------- the question editor

const ASSESSMENT_TYPES = [
  { value: "", label: "Every questionnaire" },
  { value: "interest", label: "Interests" },
  { value: "personality", label: "Personality" },
  { value: "aptitude", label: "Aptitude" },
];

function QuestionEditor({ question, onSaved }: { question: AdminQuestionRow; onSaved: () => void }) {
  const t = useT();
  const tf = useTf();
  const [draft, setDraft] = useState({
    text_en: question.text_en,
    text_hi: question.text_hi,
    dimension: question.dimension,
    keyed: question.keyed === "-" ? "-" : "+",
    response_type: question.response_type,
    correct_value: question.correct_value ?? "",
    order: String(question.order),
  });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);

  function patch(): AdminQuestionPatch {
    const next: AdminQuestionPatch = {};
    if (draft.text_en.trim() !== question.text_en) next.text_en = draft.text_en.trim();
    if (draft.text_hi.trim() !== question.text_hi) next.text_hi = draft.text_hi.trim();
    if (draft.dimension.trim() !== question.dimension) next.dimension = draft.dimension.trim();
    if (draft.keyed !== question.keyed) next.keyed = draft.keyed as "+" | "-";
    if (draft.response_type.trim() !== question.response_type) {
      next.response_type = draft.response_type.trim();
    }
    if (draft.correct_value.trim() !== (question.correct_value ?? "")) {
      next.correct_value = draft.correct_value.trim();
    }
    const order = Number(draft.order);
    if (Number.isInteger(order) && order !== question.order) next.order = order;
    return next;
  }

  const changed = Object.keys(patch()).length;

  async function save() {
    const body = patch();
    if (Object.keys(body).length === 0) {
      setNotice({ tone: "bad", text: "Nothing has been changed yet, so there is nothing to save." });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      await api.adminUpdateQuestion(question.id, body);
      setNotice({ tone: "ok", text: "Reworded. The log names the field; it does not keep a copy of the new wording." });
      onSaved();
    } catch (error: unknown) {
      setNotice({
        tone: "bad",
        text:
          error instanceof ApiError
            ? error.message
            : "The server did not answer, so this item still reads as it did.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 border-t border-line pt-3">
      <Textarea
        label="English wording"
        value={draft.text_en}
        onChange={(event) => setDraft({ ...draft, text_en: event.target.value })}
        rows={2}
        maxLength={400}
      />
      <Textarea
        label="हिन्दी wording"
        value={draft.text_hi}
        onChange={(event) => setDraft({ ...draft, text_hi: event.target.value })}
        rows={2}
        maxLength={400}
        hint="A child answering in Hindi sees this one. Five characters at least."
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          label="Dimension"
          value={draft.dimension}
          onChange={(event) => setDraft({ ...draft, dimension: event.target.value })}
          maxLength={24}
          hint="The theme this item scores toward."
        />
        <Input
          label="Response type"
          value={draft.response_type}
          onChange={(event) => setDraft({ ...draft, response_type: event.target.value })}
          maxLength={8}
          hint="How the answer arrives, eg likert."
        />
        <Select
          label="Keyed"
          options={[
            { value: "+", label: "+ counts toward it" },
            { value: "-", label: "− counts against it" },
          ]}
          value={draft.keyed}
          onChange={(event) => setDraft({ ...draft, keyed: event.target.value })}
        />
        <Input
          label="Order"
          value={draft.order}
          onChange={(event) => setDraft({ ...draft, order: event.target.value })}
          inputMode="numeric"
          hint="0 to 200."
        />
      </div>
      <Input
        label="Correct value (only for a scored item)"
        value={draft.correct_value}
        onChange={(event) => setDraft({ ...draft, correct_value: event.target.value })}
        maxLength={8}
        hint="Leave it alone unless this question has one right answer."
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => void save()} loading={busy}>
          {changed > 0
            ? tf("Save {changed} change{s}", { changed, s: changed > 1 ? "s" : "" })
            : t("Save changes")}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onSaved()}>
          {t("Done")}
        </Button>
      </div>

      {notice ? <Notice tone={notice.tone} text={notice.text} /> : null}

      <Caption>
        {tf(
          "The options ({count}) are not editable on this screen: they are authored with the item in",
          { count: question.options.length },
        )}{" "}
        <code className="font-mono text-[11px]">backend/data/assessment_questions.json</code>
        {t(", and a reworded question with unchanged options is easy to get wrong in a form. Change the wording here, the choices there.")}
      </Caption>
    </div>
  );
}

function QuestionRow({ question, onChanged }: { question: AdminQuestionRow; onChanged: () => void }) {
  const t = useT();
  const tf = useTf();
  const [open, setOpen] = useState(false);
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
            <span className="font-mono text-xs">{question.code}</span>
            <Badge tone="neutral">{question.assessment_type}</Badge>
            <Badge tone={question.editable ? "brand" : "warning"}>
              {question.editable
                ? t("No answers yet")
                : tf("{answers} answers stored", { answers: question.answers })}
            </Badge>
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-ink">{question.text_en}</p>
          <p className="mt-1 text-sm leading-relaxed text-muted">{question.text_hi}</p>
          <p className="mt-1.5 text-xs text-muted">
            {question.dimension} · {t("keyed")} {question.keyed} · {question.response_type} · {t("order")}{" "}
            {question.order}
            {question.correct_value ? ` · ${t("correct")} ${question.correct_value}` : ""}
            {question.options.length > 0
              ? ` · ${tf("{count} options", { count: question.options.length })}`
              : ""}
          </p>
        </div>
        {question.editable ? (
          <Button variant={open ? "secondary" : "outline"} size="sm" onClick={() => setOpen(!open)}>
            {open ? <ChevronUp className="h-4 w-4" aria-hidden /> : <Pencil className="h-4 w-4" aria-hidden />}
            {open ? t("Close") : t("Reword")}
          </Button>
        ) : (
          <Badge tone="warning">{t("Locked")}</Badge>
        )}
      </div>

      {question.editable && open ? (
        <div className="mt-3">
          <QuestionEditor question={question} onSaved={onChanged} />
        </div>
      ) : null}

      {!question.editable ? (
        <p className="mt-3 rounded-card border border-warning/30 bg-warning-mist p-3 text-xs leading-relaxed text-ink">
          {tf(
            "{answers} children have answered this item, so it is part of a score that has already been handed over. Its wording is fixed. To change what it asks, author a new code in",
            { answers: question.answers },
          )}{" "}
          <span className="font-mono">backend/data/assessment_questions.json</span>{" "}
          {t("and ship a new bank version — the old answers then still mean the question they were asked.")}
        </p>
      ) : null}
    </Card>
  );
}

function QuestionsPanel() {
  const t = useT();
  const [type, setType] = useState("");
  const [offset, setOffset] = useState(0);
  const load = useCallback(
    () => api.adminQuestions({ assessment_type: type || undefined, limit: 50, offset }),
    [type, offset],
  );
  const page = useResource(load);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <Select
          label="Questionnaire"
          options={ASSESSMENT_TYPES}
          value={type}
          onChange={(event) => {
            setType(event.target.value);
            setOffset(0);
          }}
        />
        <div className="flex items-end">
          <Button variant="outline" size="sm" onClick={page.reload}>
            {t("Reload")}
          </Button>
        </div>
      </div>

      {page.state === "loading" && !page.data ? <LoadingPanel label="Reading the question bank" /> : null}
      {page.state === "error" && !page.data ? (
        <ErrorState
          description={page.error}
          onRetry={page.reload}
          title="The bank would not load"
          extra={
            <p className="mt-2 text-xs leading-relaxed text-muted">
              {t("On a fresh database the question bank is not in it yet: the 75 items are seeded from")}{" "}
              <code className="font-mono text-[11px]">backend/data/assessment_questions.json</code> {t("by")}{" "}
              <code className="font-mono text-[11px]">scripts/seed.py</code>
              {t(", not at boot. Run the seed and reload this tab.")}
            </p>
          }
        />
      ) : null}

      {page.data ? (
        page.data.items.length === 0 ? (
          <EmptyState
            title="No items in the bank yet"
            description="This table has no questions, so there is nothing to reword. Seed them with scripts/seed.py."
          />
        ) : (
          <div className="space-y-3">
            {page.data.items.map((question) => (
              <QuestionRow key={question.id} question={question} onChanged={page.reload} />
            ))}
          </div>
        )
      ) : null}

      {page.data ? (
        <Pager
          total={page.data.total}
          limit={page.data.limit}
          offset={page.data.offset}
          onMove={setOffset}
          unit="items"
        />
      ) : null}

      <Caption>
        Adding, removing and re-scoring items is not done from this screen — a bank is authored in
        the seed file so that a sitting can be marked the same way twice, and a versioned file is
        what makes that true. What is offered here is the one safe edit: the wording of an item
        nobody has answered.
      </Caption>
    </div>
  );
}

// ------------------------------------------------------------------------- the blog tab

function BlogPanel() {
  const t = useT();
  const status = useResource(useCallback(() => api.adminBlog(), []));

  if (status.state === "loading" && !status.data) return <LoadingPanel label="Asking the server about the blog" />;
  if (status.state === "error" && !status.data) {
    return <ErrorState description={status.error} onRetry={status.reload} title="The server did not answer" />;
  }
  if (!status.data) return null;

  return (
    <div className="space-y-4">
      <Card className="border-line">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="neutral">{t("Not editable here")}</Badge>
          <p className="text-sm font-semibold text-ink">{t("Posts are files, not rows")}</p>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-ink">{status.data.note}</p>
        <dl className="mt-3 space-y-1 text-xs text-muted">
          <div>
            <dt className="inline font-medium text-ink">{t("Where:")}</dt>{" "}
            <dd className="inline font-mono">{status.data.where}</dd>
          </div>
          <div>
            <dt className="inline font-medium text-ink">{t("How a post goes live:")}</dt>{" "}
            <dd className="inline">{status.data.how}</dd>
          </div>
        </dl>
      </Card>
      <p className="text-xs leading-relaxed text-muted">
        {t("There is no form below this panel, and there will not be one until the posts live in the database. A box that took your text and had nowhere to put it would look like a blog editor and behave like a deleted draft, which is the failure this tab exists to avoid.")}
      </p>
    </div>
  );
}

// ------------------------------------------------------------------------- the screen

export default function AdminContentScreen() {
  const t = useT();
  const [tab, setTab] = useState("careers");

  return (
    <Screen
      title="Content"
      description="The career catalogue a child reads, the questionnaire bank they answer, and the blog. Two of the three are editable here; the third is a file beside the code."
      badge={<Badge tone="brand">{t("Admin")}</Badge>}
    >
      <div className="space-y-5">
        <PillGroup
          items={[
            { value: "careers", label: "Careers" },
            { value: "questions", label: "Questions" },
            { value: "blog", label: "Blog" },
          ]}
          value={tab}
          onChange={setTab}
        />
        {tab === "careers" ? <CareersPanel /> : null}
        {tab === "questions" ? <QuestionsPanel /> : null}
        {tab === "blog" ? <BlogPanel /> : null}
      </div>
    </Screen>
  );
}
