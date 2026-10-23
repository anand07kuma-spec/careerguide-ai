"use client";

import { useCallback, useState } from "react";
import {
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
import { Screen } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/field";
import { ErrorState, LoadingPanel } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/lib/api";
import { useT, useTf } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { CLASS_OPTIONS } from "@/lib/types";
import type { Resume, ResumeInput, ResumeSkill, ResumeSuggestion } from "@/lib/types";
import { classLabel, relativeTime } from "@/lib/utils";
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

export default function ResumePage() {
  const t = useT();
  const { status, user, profile } = useSession();
  const load = useCallback(() => api.resume(), []);
  const { state, data, error, reload } = useResource(load, status === "ready");

  return (
    <Screen
      title="My Resume"
      description="A one-page document you write yourself: the classes you did, the skills you would stand behind, the things you tried. Nothing here is scored, and this app sends your resume to no one."
      badge={
        <Badge tone="teal" icon={<FileUser className="h-3.5 w-3.5" aria-hidden />}>
          {t("Written by you")}
        </Badge>
      }
    >
      <div className="space-y-5">
        {state === "loading" && !data ? <LoadingPanel label="Loading your resume…" /> : null}
        {state === "error" && !data ? (
          <ErrorState title="We couldn't load your resume" description={error ?? undefined} onRetry={reload} />
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
    </Screen>
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

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" onClick={() => window.print()} disabled={untitled}>
        <Printer className="h-4 w-4" aria-hidden />
        {t("Download as PDF")}
      </Button>
      <Button size="sm" variant="outline" onClick={() => void save()} loading={busy} disabled={!dirty}>
        <Save className="h-4 w-4" aria-hidden />
        {t("Save")}
      </Button>
      <span className="text-xs text-muted">
        {dirty
          ? t("Not saved yet")
          : resume.saved_at
            ? tf("Saved {when}", { when: relativeTime(resume.saved_at) })
            : t("Nothing saved yet — this copy is only on this screen.")}
      </span>
    </div>
  );

  return (
    <>
      {/* The whole editor is screen-only; the sheet at the bottom of this component is
          what the paper gets. */}
      <div className="space-y-5 print:hidden">
        {toolbar}

        {untitled ? (
          <p role="alert" className="text-sm font-medium text-danger">
            {t(
              "An empty line cannot be saved: give every skill and every project a name or a title, or remove it.",
            )}
          </p>
        ) : null}
        {failure ? (
          <p role="alert" className="text-sm font-medium text-danger">
            {failure}
          </p>
        ) : null}

        <Card>
          <CardHeader
            title="Personal details"
            description="These come from your account. This app keeps no phone number, address, photo or date of birth, and a printed page does not add them."
            icon={<UserRound className="h-5 w-5" aria-hidden />}
            action={
              <LinkButton href="/app/profile" size="sm" variant="ghost">
                {t("Edit in My Profile")}
              </LinkButton>
            }
          />
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-line bg-canvas/50 px-4 py-3">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted">{t("Name")}</dt>
              <dd className="mt-1 text-sm font-medium text-ink">{name || t("Not given yet")}</dd>
            </div>
            <div className="rounded-2xl border border-line bg-canvas/50 px-4 py-3">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted">{t("Class")}</dt>
              <dd className="mt-1 text-sm font-medium text-ink">{classLabel(classLevel) ?? t("Not given yet")}</dd>
            </div>
          </dl>
        </Card>

        <Card>
          <CardHeader
            title="What are you aiming at?"
            description="One job title, in your own words. The two suggest buttons read it, and nothing else uses it."
            icon={<FileUser className="h-5 w-5" aria-hidden />}
          />
          <div className="mt-4">
            <Input
              label="The career you want to write for"
              value={draft.target_role}
              maxLength={LIMIT.target_role}
              placeholder="e.g. Software Engineer"
              hint="Spelling it the way a job posting does helps. A title this app has no profile for gets the general list rather than a guess dressed up as a match."
              onChange={(event) => patch("target_role", event.target.value)}
            />
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Education"
            description="The classes you have done or are in, with whatever your board calls the result — marks, percentage, grade or 'appearing'."
            icon={<GraduationCap className="h-5 w-5" aria-hidden />}
            action={
              <Button
                size="sm"
                variant="outline"
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
          />
          <div className="mt-4 space-y-3">
            {draft.education.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-line px-4 py-5 text-center text-sm text-muted">
                {t("No classes listed yet. Class 10 and Class 12 are the two most people start with.")}
              </p>
            ) : (
              draft.education.map((entry, index) => (
                <div key={index} className="rounded-2xl border border-line bg-canvas/50 p-4">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Select
                      aria-label={`Class on line ${index + 1}`}
                      value={entry.class_level}
                      options={CLASS_CHOICES}
                      onChange={(event) =>
                        editRow("education", index, { ...entry, class_level: event.target.value })
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
                      label="Year"
                      value={entry.year}
                      maxLength={LIMIT.year}
                      placeholder="e.g. 2025"
                      onChange={(event) => editRow("education", index, { ...entry, year: event.target.value })}
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
                  <Button
                    size="sm"
                    variant="ghost"
                    className="mt-2"
                    aria-label={`Remove class ${index + 1}`}
                    onClick={() => patch("education", draft.education.filter((_, i) => i !== index))}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                    {t("Remove")}
                  </Button>
                </div>
              ))
            )}
            {draft.education.length >= LIMIT.education ? (
              <p className="text-xs text-muted">
                {tf("This document holds up to {n} class lines.", { n: LIMIT.education })}
              </p>
            ) : null}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Skills"
            description="Only what you could talk about if someone asked. A word is worth more than a percentage here."
            icon={<Wrench className="h-5 w-5" aria-hidden />}
            action={
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void suggest("skills")}
                  loading={spending === "skills"}
                >
                  <Sparkles className="h-4 w-4" aria-hidden />
                  {t("AI Suggest")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={draft.skills.length >= LIMIT.skills}
                  onClick={() => patch("skills", [...draft.skills, { name: "", level: "" }])}
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  {t("Add a skill")}
                </Button>
              </div>
            }
          />
          <div className="mt-4 space-y-3">
            {draft.skills.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-line px-4 py-5 text-center text-sm text-muted">
                {t("Nothing here yet. Write one yourself, or ask for ideas and keep only what fits you.")}
              </p>
            ) : (
              draft.skills.map((skill, index) => (
                <div key={index} className="flex flex-wrap items-end gap-3">
                  <div className="min-w-48 flex-1">
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
                  </div>
                  <div className="w-full sm:w-56">
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
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="mb-0.5 shrink-0 text-muted hover:bg-danger-mist hover:text-danger"
                    aria-label={`Remove skill ${index + 1}`}
                    onClick={() => patch("skills", draft.skills.filter((_, i) => i !== index))}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </Button>
                </div>
              ))
            )}
            <SuggestionNotice which="skills" offer={offer} failure={offerFailure} />
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Projects"
            description="Anything you made, organised or tried — a school project, a game, a notebook, a team you helped run. The year and the detail are optional."
            icon={<Rocket className="h-5 w-5" aria-hidden />}
            action={
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void suggest("projects")}
                  loading={spending === "projects"}
                >
                  <Sparkles className="h-4 w-4" aria-hidden />
                  {t("AI Suggest")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={draft.projects.length >= LIMIT.projects}
                  onClick={() => patch("projects", [...draft.projects, { title: "", detail: "", year: "" }])}
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  {t("Add a project")}
                </Button>
              </div>
            }
          />
          <div className="mt-4 space-y-3">
            {draft.projects.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-line px-4 py-5 text-center text-sm text-muted">
                {t("Nothing here yet. One small thing you actually did is worth more than four you read about.")}
              </p>
            ) : (
              draft.projects.map((project, index) => (
                <div key={index} className="rounded-2xl border border-line bg-canvas/50 p-4">
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="min-w-48 flex-1">
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
                    </div>
                    <div className="w-32">
                      <Input
                        aria-label={`Project ${index + 1} year`}
                        value={project.year}
                        maxLength={LIMIT.year}
                        placeholder="Year"
                        onChange={(event) =>
                          editRow("projects", index, { ...project, year: event.target.value })
                        }
                      />
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="mb-0.5 shrink-0 text-muted hover:bg-danger-mist hover:text-danger"
                      aria-label={`Remove project ${index + 1}`}
                      onClick={() => patch("projects", draft.projects.filter((_, i) => i !== index))}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </Button>
                  </div>
                  <div className="mt-3">
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
                </div>
              ))
            )}
            {draft.projects.length >= LIMIT.projects ? (
              <p className="text-xs text-muted">
                {tf("This document holds up to {n} projects.", { n: LIMIT.projects })}
              </p>
            ) : null}
            <SuggestionNotice which="projects" offer={offer} failure={offerFailure} />
          </div>
        </Card>

        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3">
          <Button onClick={() => void save()} loading={busy} disabled={untitled || !dirty}>
            <Save className="h-4 w-4" aria-hidden />
            {t("Save resume")}
          </Button>
          <Button variant="outline" onClick={() => window.print()} disabled={untitled}>
            <Printer className="h-4 w-4" aria-hidden />
            {t("Download as PDF")}
          </Button>
          <p className="text-xs leading-relaxed text-muted">
            {t("Saving needs no account and sends your CV nowhere. Printing uses your browser's own Save as PDF — this app builds no file and keeps no copy of a printed page.")}
          </p>
        </div>
      </div>

      <PrintedResume draft={payload} name={name} classLevel={classLevel} />
    </>
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
      <p role="alert" className="rounded-2xl border border-danger/25 bg-danger-mist/50 px-4 py-3 text-sm text-danger">
        {failure}
      </p>
    );
  }
  if (!offer || offer.which !== which) return null;

  const { suggestion } = offer;
  const noun = which === "skills" ? t("skills") : t("project ideas");

  return (
    <div className="rounded-2xl border border-brand-light/40 bg-brand-mist/40 px-4 py-3 text-sm leading-relaxed text-brand-dark">
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
  const t = useT();
  const tf = useTf();

  if (
    draft.education.length === 0 &&
    draft.skills.length === 0 &&
    draft.projects.length === 0
  ) {
    return null;
  }

  const education = [...draft.education].sort(
    (a, b) => classNumber(a.class_level) - classNumber(b.class_level),
  );
  const school = name || t("My Resume");

  return (
    <section className="hidden bg-white px-0 py-6 text-[13px] leading-relaxed text-black print:block">
      <header className="border-b border-neutral-300 pb-3">
        <h2 className="text-xl font-semibold tracking-tight">{school}</h2>
        <p className="mt-1 text-[12px]">
          {[
            classLevel ? classLabel(classLevel) : null,
            draft.target_role ? `${t("Aiming at")}: ${draft.target_role}` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </header>

      {education.length > 0 ? (
        <div className="mt-4">
          <h3 className="text-[12px] font-semibold uppercase tracking-wide">{t("Education")}</h3>
          <ul className="mt-1.5 space-y-1">
            {education.map((entry, index) => (
              <li key={index}>
                <span className="font-medium">{classLabel(entry.class_level)}</span>
                {entry.school ? ` — ${entry.school}` : ""}
                {entry.year ? ` (${entry.year})` : ""}
                {entry.result ? ` · ${entry.result}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {draft.projects.length > 0 ? (
        <div className="mt-4">
          <h3 className="text-[12px] font-semibold uppercase tracking-wide">{t("Projects")}</h3>
          <ul className="mt-1.5 space-y-1.5">
            {draft.projects.map((project, index) => (
              <li key={index} className="break-words">
                <span className="font-medium">{project.title}</span>
                {project.year ? ` (${project.year})` : ""}
                {project.detail ? <p className="text-[12px]">{project.detail}</p> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {draft.skills.length > 0 ? (
        <div className="mt-4">
          <h3 className="text-[12px] font-semibold uppercase tracking-wide">{t("Skills")}</h3>
          <ul className="mt-1.5 grid gap-x-4 gap-y-1 print:grid-cols-2">
            {draft.skills.map((skill, index) => (
              // Inline, not flex: as flex items the name and the level are two boxes with
              // no gap, and the space that opens " — Learning it" collapses on paper.
              <li key={index} className="break-words">
                {skill.name}
                {skill.level ? <span className="text-neutral-600"> — {t(levelLabel(skill.level))}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="mt-5 border-t border-neutral-300 pt-2 text-[10px] text-neutral-600">
        {tf("CareerGuide AI — printed {date}. Written by the student named above; not scored, verified or sent anywhere by CareerGuide AI.", {
          date: new Date().toLocaleDateString(),
        })}
      </p>
    </section>
  );
}
