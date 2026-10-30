"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  GraduationCap,
  ListChecks,
  Plus,
  Trash2,
} from "lucide-react";
import { Screen } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import {
  EmptyState,
  ErrorState,
  ProgressBar,
  SkeletonCard,
} from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { translate, useT, useTf } from "@/lib/i18n";
import type { PlanItem, PlanItemStatus, StudyPlan } from "@/lib/types";
import { cn, relativeTime } from "@/lib/utils";

const STATUS_OPTIONS: { value: PlanItemStatus; label: string }[] = [
  { value: "pending", label: "Not started" },
  { value: "in_progress", label: "Doing it now" },
  { value: "completed", label: "Done" },
  { value: "skipped", label: "Skipped — that's okay" },
];

const NEXT_STATUS: Record<PlanItemStatus, { next: PlanItemStatus; label: string }> = {
  pending: { next: "in_progress", label: "Start" },
  in_progress: { next: "completed", label: "Mark done" },
  completed: { next: "pending", label: "Reopen" },
  skipped: { next: "pending", label: "Try again" },
};

const STATUS_TONE: Record<PlanItemStatus, "neutral" | "brand" | "success" | "warning"> = {
  pending: "neutral",
  in_progress: "brand",
  completed: "success",
  skipped: "warning",
};

const EFFORT_OPTIONS = [
  { value: "15 min", label: "15 min" },
  { value: "30 min", label: "30 min" },
  { value: "1 hour", label: "1 hour" },
  { value: "This week", label: "This week" },
];

// A message from the API is content and stays as written; the fallback is the app's own
// sentence. A module-scope helper cannot call `useT`, but `translate` reads the language
// the mounted store already settled on, so the lookup happens here instead of being
// handed in by every caller — which is also what keeps a `useCallback` from closing over
// a translated string it never declares as a dependency.
function errorMessage(error: unknown) {
  return error instanceof Error
    ? translate(error.message)
    : translate("Something went wrong. Please try again.");
}

type ConfirmTarget =
  | { kind: "plan"; planId: number; planTitle: string }
  | { kind: "item"; planId: number; itemId: number; itemTitle: string }
  | null;

export default function PlansPage() {
  const { toast } = useToast();
  const t = useT();
  const tf = useTf();

  const [plans, setPlans] = useState<StudyPlan[]>([]);
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");
  const [error, setError] = useState<string | null>(null);

  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmTarget>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const load = useCallback(() => {
    api
      .plans()
      .then((data) => {
        setPlans(data);
        setState("ready");
      })
      .catch((err: unknown) => {
        setError(errorMessage(err));
        setState("error");
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function applyOptimistic(
    mutate: (current: StudyPlan[]) => StudyPlan[],
    request: () => Promise<unknown>,
    successMessage: string,
  ) {
    const snapshot = plans;
    setPlans(mutate(plans));
    request()
      .then(() => toast(successMessage, "success"))
      .catch((err: unknown) => {
        setPlans(snapshot);
        toast(errorMessage(err), "error");
      });
  }

  function setItemStatus(planId: number, itemId: number, status: PlanItemStatus) {
    applyOptimistic(
      (current) =>
        current.map((plan) =>
          plan.id !== planId
            ? plan
            : {
                ...plan,
                items: plan.items.map((item) =>
                  item.id !== itemId ? item : { ...item, status },
                ),
              },
        ),
      () => api.setPlanItemStatus(planId, itemId, status),
      status === "completed" ? t("Nice — step marked done.") : t("Status updated."),
    );
  }

  function removeItem(planId: number, itemId: number) {
    if (!confirm) return;
    const snapshot = plans;
    setConfirmBusy(true);
    setPlans(
      snapshot.map((plan) =>
        plan.id !== planId
          ? plan
          : { ...plan, items: plan.items.filter((item) => item.id !== itemId) },
      ),
    );
    api
      .deletePlanItem(planId, itemId)
      .then(() => toast(t("Step removed from your plan."), "success"))
      .catch((err: unknown) => {
        setPlans(snapshot);
        toast(errorMessage(err), "error");
      })
      .finally(() => {
        setConfirmBusy(false);
        setConfirm(null);
      });
  }

  function removePlan(planId: number) {
    const snapshot = plans;
    setConfirmBusy(true);
    setPlans(snapshot.filter((plan) => plan.id !== planId));
    api
      .deletePlan(planId)
      .then(() => toast(t("Plan deleted."), "success"))
      .catch((err: unknown) => {
        setPlans(snapshot);
        toast(errorMessage(err), "error");
      })
      .finally(() => {
        setConfirmBusy(false);
        setConfirm(null);
      });
  }

  function onPlanCreated(plan: StudyPlan) {
    setPlans((current) => [plan, ...current]);
    setCollapsed((current) => ({ ...current, [plan.id]: false }));
    setCreateOpen(false);
    toast(t("Your plan is ready. Edit it any way you like."), "success");
  }

  function onItemAdded(planId: number, item: PlanItem) {
    setPlans((current) =>
      current.map((plan) => (plan.id !== planId ? plan : { ...plan, items: [...plan.items, item] })),
    );
  }

  return (
    <Screen
      title="Study & Skill Plans"
      description="Plans you set for yourself, about things you're curious about. Change, shorten or drop them any time — nothing here is assigned by a teacher or an algorithm."
      badge={
        <Badge tone="teal" icon={<GraduationCap className="h-3.5 w-3.5" aria-hidden />}>
          {t("Student-owned and adjustable")}
        </Badge>
      }
      action={
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" aria-hidden />
          {t("New plan")}
        </Button>
      }
    >
      <div className="space-y-5">
        <p className="rounded-2xl border border-line bg-surface px-4 py-3 text-sm leading-relaxed text-muted">
          {t(
            "Falling behind on a plan is normal, not failure. If a step feels too big, make it smaller. If a plan no longer interests you, change it or start a new one.",
          )}
        </p>

        {state === "loading" ? (
          <div className="space-y-4">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : state === "error" ? (
          <ErrorState title="We couldn't load your plans" description={error} onRetry={load} />
        ) : plans.length === 0 ? (
          <EmptyState
            icon={ListChecks}
            title="No plans yet"
            description="A plan is just a list of small things you'd like to try next — you decide what goes in it and how fast you move."
            action={
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4" aria-hidden />
                  {t("Create your first plan")}
                </Button>
                <LinkButton href="/app/careers" size="sm" variant="outline">
                  {t("Look at careers for ideas")}
                </LinkButton>
              </div>
            }
          />
        ) : (
          plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              collapsed={collapsed[plan.id] ?? false}
              onToggle={() =>
                setCollapsed((current) => ({ ...current, [plan.id]: !current[plan.id] }))
              }
              onStatus={setItemStatus}
              onItemAdded={onItemAdded}
              onDeleteItem={(itemId, itemTitle) =>
                setConfirm({ kind: "item", planId: plan.id, itemId, itemTitle })
              }
              onDeletePlan={() => setConfirm({ kind: "plan", planId: plan.id, planTitle: plan.title })}
            />
          ))
        )}
      </div>

      <CreatePlanModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={onPlanCreated}
      />

      <Modal
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm?.kind === "plan" ? "Delete this plan?" : "Delete this step?"}
        description={
          confirm?.kind === "plan"
            ? tf("“{title}” and all of its steps will go away. This cannot be undone.", {
                title: confirm.planTitle,
              })
            : tf("“{title}” will be removed from the plan. This cannot be undone.", {
                title: confirm?.kind === "item" ? confirm.itemTitle : "",
              })
        }
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirm(null)} disabled={confirmBusy}>
              {t("Keep it")}
            </Button>
            <Button
              variant="danger"
              loading={confirmBusy}
              onClick={() => {
                if (!confirm) return;
                if (confirm.kind === "plan") removePlan(confirm.planId);
                else removeItem(confirm.planId, confirm.itemId);
              }}
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              {t("Yes, delete")}
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-muted">
          {t(
            "Deleting a plan doesn't erase anything else you've explored. You can always make a new one.",
          )}
        </p>
      </Modal>
    </Screen>
  );
}

// ------------------------------------------------------------------ Plan card

function PlanCard({
  plan,
  collapsed,
  onToggle,
  onStatus,
  onItemAdded,
  onDeleteItem,
  onDeletePlan,
}: {
  plan: StudyPlan;
  collapsed: boolean;
  onToggle: () => void;
  onStatus: (planId: number, itemId: number, status: PlanItemStatus) => void;
  onItemAdded: (planId: number, item: PlanItem) => void;
  onDeleteItem: (itemId: number, itemTitle: string) => void;
  onDeletePlan: () => void;
}) {
  const completed = plan.items.filter((item) => item.status === "completed").length;
  const Chevron = collapsed ? ChevronDown : ChevronUp;
  const t = useT();
  const tf = useTf();

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold leading-tight text-ink">{plan.title}</h2>
            <Badge tone={plan.status === "active" ? "teal" : "neutral"}>
              {plan.status === "active" ? t("Your plan, your pace") : plan.status}
            </Badge>
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">{plan.goal}</p>
          <p className="mt-1 text-xs text-muted">
            {plan.items.length === 1
              ? tf("Made {when} · {n} step you chose", { when: relativeTime(plan.created_at), n: 1 })
              : tf("Made {when} · {n} steps you chose", {
                  when: relativeTime(plan.created_at),
                  n: plan.items.length,
                })}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={onToggle}
            aria-expanded={!collapsed}
            aria-label={
              collapsed ? tf("Expand {title}", { title: plan.title }) : tf("Collapse {title}", { title: plan.title })
            }
          >
            <Chevron className="h-4 w-4" aria-hidden />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={onDeletePlan}
            aria-label={tf("Delete plan {title}", { title: plan.title })}
            className="text-muted hover:bg-danger-mist hover:text-danger"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </div>

      <ProgressBar
        className="mt-4"
        value={completed}
        total={plan.items.length}
        label={tf("Steps you've finished: {done} of {total}", {
          done: completed,
          total: plan.items.length,
        })}
        tone="teal"
      />
      <p className="mt-1.5 text-xs text-muted">
        {t("This bar only shows what you chose to do. Unfinished steps are not a grade.")}
      </p>

      {!collapsed ? (
        <div className="mt-4 space-y-3">
          {plan.items.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line px-4 py-5 text-center text-sm text-muted">
              {t("No steps yet. Add one below — keep it small and doable.")}
            </p>
          ) : (
            plan.items.map((item) => (
              <PlanItemRow
                key={item.id}
                item={item}
                onStatus={(status) => onStatus(plan.id, item.id, status)}
                onDelete={() => onDeleteItem(item.id, item.title)}
              />
            ))
          )}
          <AddItemForm planId={plan.id} onAdded={onItemAdded} />
        </div>
      ) : null}
    </Card>
  );
}

// ------------------------------------------------------------------- Item row

function PlanItemRow({
  item,
  onStatus,
  onDelete,
}: {
  item: PlanItem;
  onStatus: (status: PlanItemStatus) => void;
  onDelete: () => void;
}) {
  const cycle = NEXT_STATUS[item.status];
  const t = useT();
  const tf = useTf();
  return (
    <div
      className={cn(
        "rounded-2xl border p-4 transition-colors",
        item.status === "completed"
          ? "border-success/25 bg-success-mist/40"
          : item.status === "skipped"
            ? "border-line bg-canvas/60 opacity-80"
            : "border-line bg-canvas/50",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            className={cn(
              "text-sm font-medium leading-snug text-ink",
              item.status === "completed" && "line-through decoration-success/50",
            )}
          >
            {item.title}
          </p>
          {item.detail ? (
            <p className="mt-1 text-sm leading-relaxed text-muted">{item.detail}</p>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {/* The enum arrives from the API, but this screen already names each value in
                `STATUS_OPTIONS`, and those labels are translated — so the badge reads the
                same Hindi the status picker offers rather than a raw `in_progress`. */}
            <Badge tone={STATUS_TONE[item.status]}>
              {t(STATUS_OPTIONS.find((option) => option.value === item.status)?.label ?? item.status)}
            </Badge>
            {item.estimated_effort ? (
              <Badge tone="neutral" icon={<Clock className="h-3 w-3" aria-hidden />}>
                {item.estimated_effort}
              </Badge>
            ) : null}
          </div>
        </div>
        <Button
          size="icon"
          variant="ghost"
          onClick={onDelete}
          aria-label={tf("Delete step {title}", { title: item.title })}
          className="shrink-0 text-muted hover:bg-danger-mist hover:text-danger"
        >
          <Trash2 className="h-4 w-4" aria-hidden />
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => onStatus(cycle.next)}>
          {t(cycle.label)}
        </Button>
        <Select
          aria-label={tf("Status for {title}", { title: item.title })}
          value={item.status}
          onChange={(event) => onStatus(event.target.value as PlanItemStatus)}
          options={STATUS_OPTIONS}
          className="h-9 w-auto min-w-44 text-sm"
        />
        {item.resource_url ? (
          <LinkButton href={item.resource_url} size="sm" variant="ghost">
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            {t("Open resource")}
          </LinkButton>
        ) : null}
      </div>
    </div>
  );
}

// -------------------------------------------------------------- Add item form

function AddItemForm({
  planId,
  onAdded,
}: {
  planId: number;
  onAdded: (planId: number, item: PlanItem) => void;
}) {
  const { toast } = useToast();
  const t = useT();
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [effort, setEffort] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function submit() {
    if (!title.trim()) return;
    setBusy(true);
    setFormError(null);
    try {
      const item = await api.addPlanItem(planId, {
        title: title.trim(),
        detail: detail.trim() || undefined,
        estimated_effort: effort || undefined,
      });
      onAdded(planId, item);
      setTitle("");
      setDetail("");
      setEffort("");
      toast(t("Step added to your plan."), "success");
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-dashed border-line p-4">
      <p className="text-sm font-semibold text-ink">{t("Add a step")}</p>
      <p className="mt-0.5 text-xs text-muted">{t("Keep it small. You can edit or remove it any time.")}</p>
      <div className="mt-3 space-y-3">
        <Input
          label="What do you want to do? *"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="e.g. Watch one video about how engineers work"
          maxLength={160}
        />
        <Textarea
          label="Any detail? (optional)"
          value={detail}
          onChange={(event) => setDetail(event.target.value)}
          rows={2}
          placeholder="Why this step, or how you'll know it felt useful."
        />
        <Field label="How long might it take? (optional)">
          <Select
            value={effort}
            onChange={(event) => setEffort(event.target.value)}
            placeholder="No estimate"
            options={EFFORT_OPTIONS}
          />
        </Field>
        {formError ? (
          <p role="alert" className="text-sm font-medium text-danger">
            {formError}
          </p>
        ) : null}
        <Button size="sm" onClick={() => void submit()} loading={busy} disabled={!title.trim()}>
          <Plus className="h-4 w-4" aria-hidden />
          {t("Add step")}
        </Button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------ Create plan modal

function CreatePlanModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (plan: StudyPlan) => void;
}) {
  const [goal, setGoal] = useState("");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useT();

  // Mounting fresh is what clears the form between openings; a reset effect
  // would fight with React over when the state is allowed to change.
  if (!open) return null;

  async function submit() {
    if (goal.trim().length < 2) return;
    setBusy(true);
    setError(null);
    try {
      const plan = await api.createPlan({
        goal: goal.trim(),
        title: title.trim() || undefined,
      });
      onCreated(plan);
      setGoal("");
      setTitle("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Start a new plan"
      description="A plan is a set of small steps you choose for yourself. It can start with one sentence about what you're curious about."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {t("Cancel")}
          </Button>
          <Button onClick={() => void submit()} loading={busy} disabled={goal.trim().length < 2}>
            {t("Create plan")}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Textarea
          label="What would you like to explore? *"
          hint="For example: 'I want to find out what designing games is really like.'"
          value={goal}
          onChange={(event) => setGoal(event.target.value)}
          rows={3}
          maxLength={300}
        />
        <Input
          label="Plan title (optional)"
          hint="Leave it blank and we'll pick a friendly default."
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="e.g. My game-design week"
          maxLength={120}
        />
        {error ? (
          <p role="alert" className="text-sm font-medium text-danger">
            {error}
          </p>
        ) : null}
        <p className="text-xs leading-relaxed text-muted">
          {t(
            "We'll suggest a few starter steps. They are suggestions only — delete, rewrite or reorder anything once the plan is made.",
          )}
        </p>
      </div>
    </Modal>
  );
}
