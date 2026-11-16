"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Eye,
  FileUser,
  GraduationCap,
  Plus,
  Printer,
  Rocket,
  Save,
  Sparkles,
  Trash2,
  UserRound,
  Wrench,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/field";
import { ErrorState, LoadingPanel } from "@/components/ui/feedback";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/lib/api";
import { useT, useTf } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { CLASS_OPTIONS } from "@/lib/types";
import type { Resume, ResumeInput, ResumeSkill, ResumeSuggestion } from "@/lib/types";
import { classLabel, cn, relativeTime } from "@/lib/utils";
import { useResource } from "@/lib/use-resource";

/**
 * The caps the save route refuses, written here as well so a student is stopped at
 * the keyboard rather than by a 422 after pressing Save. The character numbers come
 * from `backend/app/schemas.py`; the list lengths are what bound the document as a
 * whole, since it arrives as one body and lands in one column.
 */
const LIMIT = {
  education: 8,
  skills: 20,
  projects: 10,
  target_role: 120,
  school: 120,
  year: 16,
  result: 48,
  skill_name: 80,
  project_title: 200,
  project_detail: 600,
} as const;

/** A class line is never anonymous on the server, so a new row starts on a real class. */
const CLASS_CHOICES = CLASS_OPTIONS.map((option) => ({ ...option }));

const LEVEL_CHOICES = [
  { value: "learning", label: "Learning it" },
  { value: "comfortable", label: "Comfortable with it" },
  { value: "confident", label: "Confident with it" },
];

/** The same three words the picker offers, so the printed page cannot say something
 * the student never had the option to choose. */
function levelLabel(level: ResumeSkill["level"]) {
  return LEVEL_CHOICES.find((option) => option.value === level)?.label ?? "";
}

/**
 * A4 at 96dpi. The preview is drawn at this width and then scaled to its column, so
 * a line breaks where it will break on paper instead of wherever the pane happens to
 * end. The padding on the sheet is the `@page` margin from `globals.css`, converted
 * (12mm ≈ 45px, 14mm ≈ 53px), so the miniature is the page.
 */
const A4 = { width: 794, height: 1123 };

/**
 * What the screen holds, in the shape a form needs.
 *
 * The server calls a blank school `null`; a text box cannot hold that, so the editor
 * keeps empty strings and `toInput` turns them back at the boundary.
 */
interface Draft {
  target_role: string;
  education: { class_level: string; school: string; year: string; result: string }[];
  skills: { name: string; level: ResumeSkill["level"] }[];
  projects: { title: string; detail: string; year: string }[];
}

function seed(resume: Resume): Draft {
  return {
    target_role: resume.target_role ?? "",
    education: resume.education.map((entry) => ({
      class_level: entry.class_level,
      school: entry.school ?? "",
      year: entry.year ?? "",
      result: entry.result ?? "",
    })),
    skills: resume.skills.map((skill) => ({ ...skill })),
    projects: resume.projects.map((project) => ({
      title: project.title,
      detail: project.detail ?? "",
      year: project.year ?? "",
    })),
  };
}

/** Empty boxes are stored as nothing at all, so a printed line never reads "School:". */
function toInput(draft: Draft): ResumeInput {
  const text = (value: string) => value.trim() || null;
  return {
    target_role: text(draft.target_role),
    education: draft.education.map((entry) => ({
      class_level: entry.class_level,
      school: text(entry.school),
      year: text(entry.year),
      result: text(entry.result),
    })),
    skills: draft.skills.map((skill) => ({ name: skill.name.trim(), level: skill.level })),
    projects: draft.projects.map((project) => ({
      title: project.title.trim(),
      detail: text(project.detail),
      year: text(project.year),
    })),
  };
}

function classNumber(value: string) {
  return Number(value.replace("class-", "")) || 0;
}

function isBlank(draft: ResumeInput) {
  return (
    draft.education.length === 0 &&
    draft.skills.filter((skill) => skill.name !== "").length === 0 &&
    draft.projects.filter((project) => project.title !== "").length === 0
  );
}

export default function ResumePage() {
  const { status, user, profile } = useSession();
  const load = useCallback(() => api.resume(), []);
  const { state, data, error, reload } = useResource(load, status === "ready");

  return (
    <div className="w-full px-4 py-6 sm:px-6 sm:py-9 lg:px-8 print:p-0">
      {state === "loading" && !data ? (
        <>
          <ResumeHero />
          <div className="mt-5">
            <LoadingPanel label="Loading your resume…" />
          </div>
        </>
      ) : null}
      {state === "error" && !data ? (
        <>
          <ResumeHero />
          <div className="mt-5">
            <ErrorState
              title="We couldn't load your resume"
              description={error ?? undefined}
              onRetry={reload}
            />
          </div>
        </>
      ) : null}
      {data ? (
        // Keyed by the server's own stamp, so the boxes are seeded from what is actually
        // stored and start again after a save instead of holding a copy already written.
        <ResumeEditor
          key={data.saved_at ?? "not-started"}
          resume={data}
          name={user?.display_name ?? ""}
          classLevel={profile?.class_level ?? null}
          onSaved={reload}
        />
      ) : null}
    </div>
  );
}

// ----------------------------------------------------------------------- hero

/**
 * The room the builder sits in. The chips are facts the screen already holds — the
 * save state, how many class lines there are, how many named skills — and never a
 * completion percentage, because nothing in this app measures how finished a
 * student's own document is.
 */
function ResumeHero({ chips }: { chips?: ReactNode }) {
  const t = useT();
  return (
    <section className="relative isolate overflow-hidden rounded-card bg-navy px-5 py-6 text-white shadow-lift sm:px-8 sm:py-8">
      <div aria-hidden className="pointer-events-none absolute inset-0 cg-aurora opacity-70" />
      <div aria-hidden className="pointer-events-none absolute inset-0 cg-grid-lines opacity-20" />
      <div className="relative">
        <p className="text-2xs font-semibold uppercase tracking-[0.18em] text-brand-light">
          {t("Resume builder")}
        </p>
        <h1 className="mt-2 max-w-2xl text-2xl font-semibold tracking-tight sm:text-3xl">
          {t("Build Your Student Resume")}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/70">
          {t(
            "A one-page document you write yourself: the classes you did, the skills you would stand behind, the things you tried. Nothing here is scored, and this app sends your resume to no one.",
          )}
        </p>
        {chips ? <div className="mt-4 flex flex-wrap items-center gap-2">{chips}</div> : null}
      </div>
    </section>
  );
}

function HeroChip({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.07] px-3 py-1 text-2xs font-medium leading-normal break-words text-white/85">
      {icon}
      {children}
    </span>
  );
}

// --------------------------------------------------------------------- editor

function ResumeEditor({
  resume,
  name,
  classLevel,
  onSaved,
}: {
  resume: Resume;
  name: string;
  classLevel: string | null;
  onSaved: () => void;
}) {
  const t = useT();
  const tf = useTf();
  const { toast } = useToast();

  const [draft, setDraft] = useState<Draft>(() => seed(resume));
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const [spending, setSpending] = useState<"skills" | "projects" | null>(null);
  const [offer, setOffer] = useState<{
    which: "skills" | "projects";
    suggestion: ResumeSuggestion;
  } | null>(null);
  const [offerFailure, setOfferFailure] = useState<string | null>(null);

  const payload = toInput(draft);
  const dirty = JSON.stringify(payload) !== JSON.stringify(toInput(seed(resume)));
  const untitled =
    draft.skills.some((skill) => skill.name.trim() === "") ||
    draft.projects.some((project) => project.title.trim() === "");
  const skillCount = draft.skills.filter((skill) => skill.name.trim() !== "").length;
  const classCount = draft.education.length;

  const statusText = dirty
    ? t("Unsaved changes")
    : resume.saved_at
      ? tf("Saved {when}", { when: relativeTime(resume.saved_at) })
      : t("Not saved yet");

  function patch<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function editRow<K extends "education" | "skills" | "projects">(
    key: K,
    index: number,
    value: Draft[K][number],
  ) {
    const next = [...draft[key]] as Draft[K];
    next[index] = value;
    patch(key, next);
  }

  async function save() {
    setBusy(true);
    setFailure(null);
    try {
      await api.saveResume(payload);
      toast("Your resume is saved.", "success");
      // Read the document back rather than keeping a copy of what we hoped was written.
      onSaved();
    } catch (caught) {
      // A refusal comes back as the server's own sentence, so it goes through the
      // same lookup as the copy written here.
      setFailure(
        t(caught instanceof ApiError ? caught.message : "Something went wrong. Please try again."),
      );
    } finally {
      setBusy(false);
    }
  }

  /**
   * One button per section, and each applies only its own half of the reply.
   *
   * The endpoint returns both lists, so two presses are two calls. That is
   * deliberate: a single button that rewrote two lists the student may have been
   * editing is how work gets lost, and the route is rate-limited for the cost of the
   * outside call it spends.
   */
  async function suggest(which: "skills" | "projects") {
    const role = draft.target_role.trim();
    if (role.length < 2) {
      setOffer(null);
      setOfferFailure(t("Type the career you are aiming at first — the suggestions read it."));
      return;
    }
    setSpending(which);
    setOfferFailure(null);
    try {
      const suggestion = await api.resumeSuggest(role);
      setOffer({ which, suggestion });
      apply(which, suggestion);
    } catch (caught) {
      setOffer(null);
      setOfferFailure(
        caught instanceof ApiError
          ? caught.message
          : t("The suggestions did not arrive. Try again in a moment."),
      );
    } finally {
      setSpending(null);
    }
  }

  /** Suggestions are appended, never dropped on top of what the student typed. */
  function apply(which: "skills" | "projects", suggestion: ResumeSuggestion) {
    const noun = which === "skills" ? "skill" : "project";
    if (which === "skills") {
      const have = new Set(draft.skills.map((skill) => skill.name.trim().toLowerCase()));
      const fresh = suggestion.skills.filter(
        (skill) => skill.name.trim() !== "" && !have.has(skill.name.trim().toLowerCase()),
      );
      const room = Math.max(0, LIMIT.skills - draft.skills.length);
      const added = fresh.slice(0, room);
      if (added.length > 0) {
        patch("skills", [
          ...draft.skills,
          ...added.map((skill) => ({ name: skill.name.trim(), level: skill.level })),
        ]);
      }
      report(added.length, fresh.length - room, noun);
      return;
    }
    const have = new Set(draft.projects.map((project) => project.title.trim().toLowerCase()));
    const fresh = suggestion.projects.filter(
      (project) => project.title.trim() !== "" && !have.has(project.title.trim().toLowerCase()),
    );
    const room = Math.max(0, LIMIT.projects - draft.projects.length);
    const added = fresh.slice(0, room);
    if (added.length > 0) {
      patch("projects", [
        ...draft.projects,
        ...added.map((project) => ({
          title: project.title.trim(),
          detail: project.detail ?? "",
          year: project.year ?? "",
        })),
      ]);
    }
    report(added.length, fresh.length - room, noun);
  }

  function report(added: number, skipped: number, noun: string) {
    if (added > 0) {
      toast(tf("Added {n} {noun} ideas to your list.", { n: added, noun }), "success");
    } else {
      toast(tf("Nothing new there — your {noun} list already has them.", { noun }), "info");
    }
    if (skipped > 0) {
      toast(tf("{n} more did not fit — remove one to add another.", { n: skipped }), "info");
    }
  }

  const chips = (
    <>
      <HeroChip
        icon={
          <span
            aria-hidden
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              dirty ? "bg-warning" : resume.saved_at ? "bg-success" : "bg-white/40",
            )}
          />
        }
      >
        {statusText}
      </HeroChip>
      <HeroChip icon={<GraduationCap className="h-3.5 w-3.5" aria-hidden />}>
        {tf(classCount === 1 ? "{n} class" : "{n} classes", { n: classCount })}
      </HeroChip>
      <HeroChip icon={<Wrench className="h-3.5 w-3.5" aria-hidden />}>
        {tf(skillCount === 1 ? "{n} skill" : "{n} skills", { n: skillCount })}
      </HeroChip>
    </>
  );

  return (
    <>
      <div className="space-y-4 print:hidden">
        <ResumeHero chips={chips} />

        {/* Kept in normal document flow. A sticky strip had to float above the
            sections it was meant to serve, and its translucent surface let headings
            and inputs show through as it passed over them. */}
        <div className="rounded-card border border-line bg-surface px-3 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <span
              aria-live="polite"
              className="inline-flex min-h-9 min-w-0 items-center gap-1.5 rounded-full bg-canvas px-3 text-xs font-medium text-muted"
            >
              <span
                aria-hidden
                className={cn(
                  "h-1.5 w-1.5 shrink-0 rounded-full",
                  dirty ? "bg-warning" : resume.saved_at ? "bg-success" : "bg-muted",
                )}
              />
              <span className="truncate">{statusText}</span>
            </span>
            <Button
              size="sm"
              variant="outline"
              className="ml-auto min-h-11 xl:hidden"
              onClick={() => setPreviewOpen(true)}
            >
              <Eye className="h-4 w-4" aria-hidden />
              {t("Preview")}
            </Button>
            <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
              <Button
                size="sm"
                className="min-h-11"
                onClick={() => void save()}
                loading={busy}
                disabled={untitled || !dirty}
              >
                <Save className="h-4 w-4" aria-hidden />
                {t("Save")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="min-h-11 whitespace-nowrap"
                onClick={() => window.print()}
                disabled={untitled}
              >
                <Printer className="h-4 w-4" aria-hidden />
                {t("Download as PDF")}
              </Button>
            </div>
          </div>
        </div>

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] xl:gap-6">
          <div className="min-w-0 space-y-4">
            {untitled ? (
              <p
                role="alert"
                className="rounded-control border border-warning/25 bg-warning-mist/50 px-4 py-3 text-sm font-medium text-warning"
              >
                {t(
                  "An empty line cannot be saved: give every skill and every project a name or a title, or remove it.",
                )}
              </p>
            ) : null}
            {failure ? (
              <p
                role="alert"
                className="rounded-control border border-danger/25 bg-danger-mist/50 px-4 py-3 text-sm font-medium text-danger"
              >
                {failure}
              </p>
            ) : null}

            <EditorSection
              title="Personal details"
              description="These come from your account. This app keeps no phone number, address, photo or date of birth, and a printed page does not add them."
              icon={<UserRound className="h-4.5 w-4.5" aria-hidden />}
              accent="indigo"
              action={
                <LinkButton href="/app/profile" size="sm" variant="ghost" className="min-h-11">
                  {t("Edit in My Profile")}
                </LinkButton>
              }
            >
              <dl className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-control bg-canvas px-4 py-3">
                  <dt className="text-2xs font-semibold uppercase tracking-[0.12em] text-muted">
                    {t("Name")}
                  </dt>
                  <dd className="mt-1 truncate text-sm font-medium text-ink">
                    {name || t("Not given yet")}
                  </dd>
                </div>
                <div className="rounded-control bg-canvas px-4 py-3">
                  <dt className="text-2xs font-semibold uppercase tracking-[0.12em] text-muted">
                    {t("Class")}
                  </dt>
                  <dd className="mt-1 truncate text-sm font-medium text-ink">
                    {classLabel(classLevel) ?? t("Not given yet")}
                  </dd>
                </div>
              </dl>
            </EditorSection>

            <EditorSection
              title="What are you aiming at?"
              description="One job title, in your own words. The two suggest buttons read it, and nothing else uses it."
              icon={<FileUser className="h-4.5 w-4.5" aria-hidden />}
              accent="brand"
            >
              <div className="rounded-control border border-brand/20 bg-gradient-to-br from-brand-mist/60 via-surface to-surface p-4">
                <Input
                  label="The career you want to write for"
                  value={draft.target_role}
                  maxLength={LIMIT.target_role}
                  placeholder="e.g. Software Engineer"
                  hint="Spelling it the way a job posting does helps. A title this app has no profile for gets the general list rather than a guess dressed up as a match."
                  className="h-12 bg-surface text-base font-medium"
                  onChange={(event) => patch("target_role", event.target.value)}
                />
              </div>
            </EditorSection>

            <EditorSection
              title="Education"
              description="The classes you have done or are in, with whatever your board calls the result — marks, percentage, grade or 'appearing'."
              icon={<GraduationCap className="h-4.5 w-4.5" aria-hidden />}
              accent="teal"
              action={
                <Button
                  size="sm"
                  variant="outline"
                  className="min-h-11"
                  disabled={draft.education.length >= LIMIT.education}
                  onClick={() =>
                    patch("education", [
                      ...draft.education,
                      {
                        class_level:
                          CLASS_CHOICES.find(
                            (option) =>
                              !draft.education.some((entry) => entry.class_level === option.value),
                          )?.value ?? "class-10",
                        school: "",
                        year: "",
                        result: "",
                      },
                    ])
                  }
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  {t("Add a class")}
                </Button>
              }
            >
              {draft.education.length === 0 ? (
                <p className="rounded-control border border-dashed border-line bg-canvas/40 px-4 py-6 text-center text-sm text-muted">
                  {t("No classes listed yet. Class 10 and Class 12 are the two most people start with.")}
                </p>
              ) : (
                <ol className="relative mt-1 space-y-5 before:absolute before:bottom-3 before:left-4 before:top-3 before:w-px before:bg-line">
                  {draft.education.map((entry, index) => (
                    <li key={index} className="relative pl-11">
                      <span
                        aria-hidden
                        className="absolute left-0 top-0 flex h-8 w-8 items-center justify-center rounded-full bg-teal-mist text-xs font-semibold text-teal ring-4 ring-surface"
                      >
                        {classNumber(entry.class_level)}
                      </span>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <Select
                          label="Class"
                          aria-label={`Class on line ${index + 1}`}
                          value={entry.class_level}
                          options={CLASS_CHOICES}
                          onChange={(event) =>
                            editRow("education", index, { ...entry, class_level: event.target.value })
                          }
                        />
                        <Input
                          label="Year"
                          value={entry.year}
                          maxLength={LIMIT.year}
                          placeholder="e.g. 2025"
                          onChange={(event) =>
                            editRow("education", index, { ...entry, year: event.target.value })
                          }
                        />
                        <Input
                          label="School or board"
                          value={entry.school}
                          maxLength={LIMIT.school}
                          placeholder="e.g. CBSE, state board, Open schooling"
                          onChange={(event) =>
                            editRow("education", index, { ...entry, school: event.target.value })
                          }
                        />
                        <Input
                          label="Result"
                          value={entry.result}
                          maxLength={LIMIT.result}
                          placeholder="e.g. 82%, B+, appearing"
                          onChange={(event) =>
                            editRow("education", index, { ...entry, result: event.target.value })
                          }
                        />
                      </div>
                      <div className="mt-1 flex justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="min-h-11 text-muted hover:bg-danger-mist hover:text-danger"
                          aria-label={`Remove class ${index + 1}`}
                          onClick={() =>
                            patch(
                              "education",
                              draft.education.filter((_, i) => i !== index),
                            )
                          }
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                          {t("Remove")}
                        </Button>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
              {draft.education.length >= LIMIT.education ? (
                <p className="mt-3 text-xs text-muted">
                  {tf("This document holds up to {n} class lines.", { n: LIMIT.education })}
                </p>
              ) : null}
            </EditorSection>

            <EditorSection
              title="Skills"
              description="Only what you could talk about if someone asked. A word is worth more than a percentage here."
              icon={<Wrench className="h-4.5 w-4.5" aria-hidden />}
              accent="indigo"
              action={
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-11 border-brand/25 text-brand-dark"
                    onClick={() => void suggest("skills")}
                    loading={spending === "skills"}
                  >
                    <Sparkles className="h-4 w-4" aria-hidden />
                    {t("AI Suggest")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="min-h-11"
                    disabled={draft.skills.length >= LIMIT.skills}
                    onClick={() => patch("skills", [...draft.skills, { name: "", level: "" }])}
                  >
                    <Plus className="h-4 w-4" aria-hidden />
                    {t("Add a skill")}
                  </Button>
                </div>
              }
            >
              {draft.skills.length === 0 ? (
                <p className="rounded-control border border-dashed border-line bg-canvas/40 px-4 py-6 text-center text-sm text-muted">
                  {t("Nothing here yet. Write one yourself, or ask for ideas and keep only what fits you.")}
                </p>
              ) : (
                <ul className="divide-y divide-line border-y border-line">
                  {draft.skills.map((skill, index) => (
                    <li
                      key={index}
                      className="grid grid-cols-1 gap-3 py-3 sm:grid-cols-[minmax(0,1fr)_11rem_2.75rem] sm:items-end"
                    >
                      <Input
                        label={index === 0 ? "Skill" : undefined}
                        aria-label={`Skill ${index + 1}`}
                        value={skill.name}
                        maxLength={LIMIT.skill_name}
                        placeholder="e.g. Excel spreadsheets"
                        error={skill.name.trim() === "" ? t("A skill needs a name.") : undefined}
                        onChange={(event) =>
                          editRow("skills", index, { ...skill, name: event.target.value })
                        }
                      />
                      <Select
                        aria-label={`Level for skill ${index + 1}`}
                        placeholder="How far along?"
                        value={skill.level}
                        options={LEVEL_CHOICES}
                        onChange={(event) =>
                          editRow("skills", index, {
                            ...skill,
                            level: event.target.value as ResumeSkill["level"],
                          })
                        }
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="justify-self-end text-muted hover:bg-danger-mist hover:text-danger sm:mb-0.5"
                        aria-label={`Remove skill ${index + 1}`}
                        onClick={() => patch("skills", draft.skills.filter((_, i) => i !== index))}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              {draft.skills.length >= LIMIT.skills ? (
                <p className="mt-3 text-xs text-muted">
                  {tf("This document holds up to {n} skills.", { n: LIMIT.skills })}
                </p>
              ) : null}
              <SuggestionNotice which="skills" offer={offer} failure={offerFailure} />
            </EditorSection>

            <EditorSection
              title="Projects"
              description="Anything you made, organised or tried — a school project, a game, a notebook, a team you helped run. The year and the detail are optional."
              icon={<Rocket className="h-4.5 w-4.5" aria-hidden />}
              accent="teal"
              action={
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-11 border-brand/25 text-brand-dark"
                    onClick={() => void suggest("projects")}
                    loading={spending === "projects"}
                  >
                    <Sparkles className="h-4 w-4" aria-hidden />
                    {t("AI Suggest")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="min-h-11"
                    disabled={draft.projects.length >= LIMIT.projects}
                    onClick={() =>
                      patch("projects", [...draft.projects, { title: "", detail: "", year: "" }])
                    }
                  >
                    <Plus className="h-4 w-4" aria-hidden />
                    {t("Add a project")}
                  </Button>
                </div>
              }
            >
              {draft.projects.length === 0 ? (
                <p className="rounded-control border border-dashed border-line bg-canvas/40 px-4 py-6 text-center text-sm text-muted">
                  {t("Nothing here yet. One small thing you actually did is worth more than four you read about.")}
                </p>
              ) : (
                <div className="space-y-4">
                  {draft.projects.map((project, index) => (
                    <div key={index} className={cn("space-y-3", index > 0 && "border-t border-line pt-4")}>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_7rem_2.75rem] sm:items-end">
                        <Input
                          label={index === 0 ? "Title" : undefined}
                          aria-label={`Project ${index + 1} title`}
                          value={project.title}
                          maxLength={LIMIT.project_title}
                          placeholder="e.g. A timetable app for my class"
                          error={project.title.trim() === "" ? t("A project needs a title.") : undefined}
                          onChange={(event) =>
                            editRow("projects", index, { ...project, title: event.target.value })
                          }
                        />
                        <Input
                          aria-label={`Project ${index + 1} year`}
                          value={project.year}
                          maxLength={LIMIT.year}
                          placeholder="Year"
                          onChange={(event) =>
                            editRow("projects", index, { ...project, year: event.target.value })
                          }
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="justify-self-end text-muted hover:bg-danger-mist hover:text-danger sm:mb-0.5"
                          aria-label={`Remove project ${index + 1}`}
                          onClick={() =>
                            patch(
                              "projects",
                              draft.projects.filter((_, i) => i !== index),
                            )
                          }
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </Button>
                      </div>
                      <Textarea
                        label={index === 0 ? "What it was, in a line or two" : undefined}
                        aria-label={`Project ${index + 1} detail`}
                        value={project.detail}
                        rows={2}
                        maxLength={LIMIT.project_detail}
                        placeholder="What you did, and what happened."
                        onChange={(event) =>
                          editRow("projects", index, { ...project, detail: event.target.value })
                        }
                      />
                    </div>
                  ))}
                </div>
              )}
              {draft.projects.length >= LIMIT.projects ? (
                <p className="mt-3 text-xs text-muted">
                  {tf("This document holds up to {n} projects.", { n: LIMIT.projects })}
                </p>
              ) : null}
              <SuggestionNotice which="projects" offer={offer} failure={offerFailure} />
            </EditorSection>

            <div className="flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Button
                  className="whitespace-nowrap"
                  onClick={() => void save()}
                  loading={busy}
                  disabled={untitled || !dirty}
                >
                  <Save className="h-4 w-4" aria-hidden />
                  {t("Save resume")}
                </Button>
                <Button
                  variant="outline"
                  className="whitespace-nowrap"
                  onClick={() => window.print()}
                  disabled={untitled}
                >
                  <Printer className="h-4 w-4" aria-hidden />
                  {t("Download as PDF")}
                </Button>
              </div>
              <p className="max-w-xl text-xs leading-relaxed text-muted sm:text-right">
                {t(
                  "Saving needs no account and sends your CV nowhere. Printing uses your browser's own Save as PDF — this app builds no file and keeps no copy of a printed page.",
                )}
              </p>
            </div>
          </div>

          <aside className="hidden min-w-0 xl:sticky xl:top-6 xl:block">
            {/* The paper rides along with the page until it meets the top of the
                viewport. It is a column of the grid, so it cannot cover the editor
                or the toolbar, and it has no height cap or inner scrollbar. */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-heading">
                  <Eye className="h-4 w-4 text-brand" aria-hidden />
                  {t("Live preview")}
                </h2>
                <Badge tone="neutral">A4</Badge>
              </div>
              <A4Preview mode="page">
                <ResumeDocument draft={payload} name={name} classLevel={classLevel} withEmptyHint />
              </A4Preview>
              <p className="text-2xs leading-relaxed text-muted">
                {t(
                  "This is the same sheet your browser prints. Unsaved changes are included too, and a long resume continues onto more pages.",
                )}
              </p>
              <p className="text-2xs leading-relaxed text-muted">
                {t("In the print dialog, open More settings and set Headers and footers to Off.")}
              </p>
            </div>
          </aside>
        </div>
      </div>

      <Modal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title="Resume preview"
        description="This is the sheet your browser prints, including anything not saved yet."
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              {t("Close")}
            </Button>
            <Button onClick={() => window.print()} disabled={untitled}>
              <Printer className="h-4 w-4" aria-hidden />
              {t("Download as PDF")}
            </Button>
          </>
        }
      >
        <A4Preview mode="full">
          <ResumeDocument draft={payload} name={name} classLevel={classLevel} withEmptyHint />
        </A4Preview>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          {t("In the print dialog, open More settings and set Headers and footers to Off.")}
        </p>
      </Modal>

      <PrintedResume draft={payload} name={name} classLevel={classLevel} />
    </>
  );
}

// ------------------------------------------------------------------ a section

type Accent = "brand" | "teal" | "indigo";

const ACCENTS: Record<Accent, string> = {
  brand: "bg-brand-mist text-brand",
  teal: "bg-teal-mist text-teal",
  indigo: "bg-indigo-100 text-indigo-700",
};

/**
 * One section of the editor. Page-local rather than a `CardHeader` variant so each
 * section can carry its own accent tile — one colour per part of the document, all
 * three from the same navy/blue/teal family.
 */
function EditorSection({
  title,
  description,
  icon,
  accent,
  action,
  children,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  accent: Accent;
  action?: ReactNode;
  children: ReactNode;
}) {
  const t = useT();
  return (
    // A flat surface and one hairline, with no card shadow: the sections read as
    // parts of one document rather than five competing boxes.
    <section className="rounded-card border border-line/80 bg-surface p-4 sm:p-5">
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={cn(
              "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-control",
              ACCENTS[accent],
            )}
          >
            {icon}
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold leading-tight text-heading">{t(title)}</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">{t(description)}</p>
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

// ----------------------------------------------------------------- suggestion box

/**
 * Says which of this app's two sources produced the lines that just appeared.
 *
 * `demo_generated` is true when no provider is configured, when the configured one
 * could not be reached, or when it answered with something unusable — and in every
 * one of those cases the list came from the career profiles stored in this app. A
 * box that still read "AI suggested" then would be printing a claim that is false.
 *
 * The server's own sentence replaces the first line rather than sitting under it: on
 * the catalogue path both say the suggestions came from this app's career profiles,
 * and a student who reads that twice learns nothing the second time.
 */
function SuggestionNotice({
  which,
  offer,
  failure,
}: {
  which: "skills" | "projects";
  offer: { which: "skills" | "projects"; suggestion: ResumeSuggestion } | null;
  failure: string | null;
}) {
  const t = useT();
  const tf = useTf();

  if (failure) {
    return (
      <div
        role="alert"
        className="mt-3 flex items-start gap-2.5 rounded-control border border-danger/25 bg-danger-mist/50 px-3.5 py-3 text-sm text-danger"
      >
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <p className="min-w-0">{failure}</p>
      </div>
    );
  }
  if (!offer || offer.which !== which) return null;

  const { suggestion } = offer;
  const noun = which === "skills" ? t("skills") : t("project ideas");

  return (
    <div className="mt-3 flex items-start gap-2.5 rounded-control border border-brand/20 bg-brand-mist/40 px-3.5 py-3 text-sm leading-relaxed text-brand-dark">
      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
      <div className="min-w-0">
        <p className="font-medium">
          {suggestion.error
            ? t(suggestion.error)
            : suggestion.demo_generated
              ? tf("These {noun} came from the career profiles inside this app. No AI model was used.", {
                  noun,
                })
              : tf("These {noun} were drafted by the {provider} model.", { noun, provider: suggestion.provider })}
        </p>
        {/* Only the catalogue has a career page to name. After a model has answered, a
            second line claiming these are "the general skills this app keeps" would
            contradict the line above it that says the model wrote them. */}
        {suggestion.demo_generated ? (
          <p className="mt-1">
            {suggestion.matched_career
              ? tf("They are the {noun} listed on the career page for {career}.", {
                  noun,
                  career: suggestion.matched_career,
                })
              : tf("No career page matched that title, so these are the general {noun} this app keeps.", { noun })}
          </p>
        ) : null}
        <p className="mt-1 text-muted">
          {t("Keep only the lines that are true for you. Change or delete any of them — nothing is saved until you press Save.")}
        </p>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ A4 preview

/**
 * The white sheet, at paper width and scaled to whatever column holds it.
 *
 * `page` shows one A4 page and says so when the draft runs past it; `full` lets the
 * sheet grow so the preview dialog can show the whole thing. The transform is
 * measured from the column rather than guessed, so the miniature keeps A4 proportions
 * at every width instead of stretching.
 */
function A4Preview({ children, mode = "page" }: { children: ReactNode; mode?: "page" | "full" }) {
  const t = useT();
  const frame = useRef<HTMLDivElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({
    scale: 0.5,
    height: A4.height * 0.5,
    overflowing: false,
  });

  useEffect(() => {
    const outer = frame.current;
    const inner = sheet.current;
    if (!outer || !inner) return;
    const measure = () => {
      const width = outer.clientWidth;
      if (width === 0) return;
      const scale = Math.min(1, width / A4.width);
      const natural = Math.max(A4.height, inner.scrollHeight);
      const overflowing = inner.scrollHeight > A4.height + 1;
      const height = Math.round((mode === "full" ? natural : A4.height) * scale);
      setView((current) =>
        current.scale === scale && current.height === height && current.overflowing === overflowing
          ? current
          : { scale, height, overflowing },
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(outer);
    observer.observe(inner);
    return () => observer.disconnect();
  }, [mode]);

  return (
    <div className="space-y-2">
      <div
        ref={frame}
        className="relative w-full overflow-hidden rounded-[6px] bg-white shadow-[0_18px_40px_-24px_rgb(11_23_48/0.55)] ring-1 ring-black/10"
        style={{ height: view.height }}
      >
        <div
          ref={sheet}
          className="absolute left-0 top-0 bg-white px-[45px] py-[53px] text-black"
          style={{
            width: A4.width,
            minHeight: A4.height,
            transform: `scale(${view.scale})`,
            transformOrigin: "top left",
          }}
        >
          {children}
        </div>
      </div>
      {mode === "page" && view.overflowing ? (
        <p className="text-2xs leading-relaxed text-muted">
          {t("The first A4 page is shown here. The rest continues on the next page in the PDF.")}
        </p>
      ) : null}
    </div>
  );
}

// ------------------------------------------------------------- the printed sheet

/**
 * On paper only.
 *
 * A stack of labelled boxes reads badly on one A4 sheet, so the document is drawn
 * again here from the same state the Save button would send. It prints what is on
 * the screen rather than only what was last saved, because a student who has just
 * typed three lines expects those lines on the page they carry away with them.
 */
function PrintedResume({
  draft,
  name,
  classLevel,
}: {
  draft: ResumeInput;
  name: string;
  classLevel: string | null;
}) {
  if (isBlank(draft)) return null;

  return (
    <section className="hidden bg-white text-[13px] leading-relaxed text-black print:block">
      <ResumeDocument draft={draft} name={name} classLevel={classLevel} />
    </section>
  );
}

/**
 * A section label in the document: a short accent rule, the words, then a hairline
 * that runs to the right edge. The rule is a border rather than a background so it
 * survives a print dialog with "Background graphics" switched off.
 */
function SheetHeading({ children }: { children: ReactNode }) {
  return (
    <h3 className="flex items-center gap-3">
      <span className="border-l-[3px] border-[#1d4ed8] pl-2 text-[11px] font-semibold uppercase leading-[1.3] tracking-[0.14em] text-[#0b1730]">
        {children}
      </span>
      <span aria-hidden className="h-0 flex-1 border-t border-neutral-300" />
    </h3>
  );
}

/**
 * The document itself, drawn once and used by both the preview and the printer.
 *
 * The preview is the paper's own miniature, so any rule changed here changes both —
 * which is the only way the sheet on screen can stay the sheet that comes out of the
 * browser's Save as PDF.
 *
 * The base type size lives here rather than on either wrapper: the paper, the dialog
 * and the printed page must set the same measure, and a wrapper-only size made the
 * miniature's lines 16px against the printer's 13px.
 */
function ResumeDocument({
  draft,
  name,
  classLevel,
  withEmptyHint = false,
}: {
  draft: ResumeInput;
  name: string;
  classLevel: string | null;
  withEmptyHint?: boolean;
}) {
  const t = useT();
  const tf = useTf();

  const education = [...draft.education].sort(
    (a, b) => classNumber(a.class_level) - classNumber(b.class_level),
  );
  const skills = draft.skills.filter((skill) => skill.name.trim() !== "");
  const projects = draft.projects.filter((project) => project.title.trim() !== "");
  const empty = education.length === 0 && skills.length === 0 && projects.length === 0;
  const school = name || t("My Resume");

  return (
    <div className="cg-resume-sheet flex min-h-[1000px] flex-col text-[13px] leading-[1.6] text-neutral-800">
      <header className="border-b-2 border-[#0b1730] pb-4">
        <h2 className="text-[28px] font-semibold leading-[1.15] tracking-tight text-[#0b1730]">
          {school}
        </h2>
        {classLevel || draft.target_role ? (
          <p className="mt-1.5 text-[12.5px] text-neutral-600">
            {classLevel ? <span className="font-medium text-neutral-700">{classLabel(classLevel)}</span> : null}
            {classLevel && draft.target_role ? (
              <span aria-hidden className="mx-2 text-neutral-400">
                |
              </span>
            ) : null}
            {draft.target_role ? (
              <span>
                {t("Aiming at")}:{" "}
                <span className="font-medium text-neutral-800">{draft.target_role}</span>
              </span>
            ) : null}
          </p>
        ) : null}
      </header>

      {empty && withEmptyHint ? (
        <div className="mt-14 rounded-lg border border-dashed border-neutral-300 px-6 py-14 text-center">
          <p className="text-sm font-medium">{t("Your sheet starts here")}</p>
          <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-neutral-600">
            {t("Add a class, skill or project, and it appears on this sheet as you type.")}
          </p>
        </div>
      ) : null}

      {education.length > 0 ? (
        <section className="mt-6">
          <SheetHeading>{t("Education")}</SheetHeading>
          <ul className="mt-3 space-y-2.5">
            {education.map((entry, index) => (
              <li
                key={index}
                className="flex items-baseline justify-between gap-6 break-inside-avoid"
              >
                <div className="min-w-0">
                  <p className="font-medium text-neutral-900">{classLabel(entry.class_level)}</p>
                  {entry.school ? (
                    <p className="mt-0.5 text-[12.5px] text-neutral-600">{entry.school}</p>
                  ) : null}
                </div>
                {entry.year || entry.result ? (
                  <p className="shrink-0 text-right text-[12.5px] text-neutral-600">
                    {entry.year ? (
                      <span className="font-medium tabular-nums text-neutral-700">{entry.year}</span>
                    ) : null}
                    {entry.year && entry.result ? (
                      <span aria-hidden className="mx-1.5 text-neutral-400">
                        ·
                      </span>
                    ) : null}
                    {entry.result ? <span>{entry.result}</span> : null}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {projects.length > 0 ? (
        <section className="mt-6">
          <SheetHeading>{t("Projects")}</SheetHeading>
          <ul className="mt-3 space-y-4">
            {projects.map((project, index) => (
              <li key={index} className="break-inside-avoid">
                <div className="flex items-baseline justify-between gap-4">
                  <p className="min-w-0 break-words text-[13.5px] font-semibold text-neutral-900">
                    {project.title}
                  </p>
                  {project.year ? (
                    <span className="shrink-0 text-[12px] tabular-nums text-neutral-500">
                      {project.year}
                    </span>
                  ) : null}
                </div>
                {project.detail ? (
                  <p className="mt-1 break-words text-[12.5px] leading-[1.65] text-neutral-600">
                    {project.detail}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {skills.length > 0 ? (
        <section className="mt-6">
          <SheetHeading>{t("Skills")}</SheetHeading>
          <ul className="mt-3 grid list-disc grid-cols-2 gap-x-8 gap-y-2 pl-4 marker:text-neutral-400">
            {skills.map((skill, index) => (
              // Inline, not flex: as flex items the name and the level are two boxes with
              // no gap, and the space that opens " — Learning it" collapses on paper.
              <li key={index} className="min-w-0 break-words pl-1 text-[12.5px]">
                <span className="font-medium text-neutral-800">{skill.name}</span>
                {skill.level ? (
                  <span className="text-neutral-500"> — {t(levelLabel(skill.level))}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {empty ? null : (
        <footer className="mt-auto pt-8">
          <p className="border-t border-neutral-200 pt-2.5 text-[9.5px] leading-relaxed text-neutral-500">
            {tf("CareerGuide AI — printed {date}. Written by the student named above; not scored, verified or sent anywhere by CareerGuide AI.", {
              date: new Date().toLocaleDateString(),
            })}
          </p>
        </footer>
      )}
    </div>
  );
}
