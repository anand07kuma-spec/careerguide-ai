"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bookmark, Info, Search, SlidersHorizontal, X } from "lucide-react";
import { Screen } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState, SkeletonCard } from "@/components/ui/feedback";
import { Input, Select } from "@/components/ui/field";
import { PillGroup } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { useT, useTf } from "@/lib/i18n";
import { messageFor, useResource } from "@/lib/use-resource";
import { THEME_LABELS, type CareerSummary, type Category, type ThemeKey } from "@/lib/types";
import { categoryTint, cn } from "@/lib/utils";

const THEME_OPTIONS = (Object.keys(THEME_LABELS) as ThemeKey[]).map((key) => ({
  value: key,
  label: THEME_LABELS[key],
}));

/**
 * Deep links (`/app/careers?category=…&theme=…`) seed the filters. This screen
 * only mounts on the client, so the query string is already there — reading it
 * as the initial state means no effect has to overwrite what the user sees.
 */
function linkedFilters(): { category: string; theme: string } {
  if (typeof window === "undefined") return { category: "", theme: "" };
  const params = new URLSearchParams(window.location.search);
  return { category: params.get("category") ?? "", theme: params.get("theme") ?? "" };
}

export default function CareerExplorer() {
  const { status: sessionStatus } = useSession();
  const { toast } = useToast();
  const t = useT();
  const tf = useTf();

  const [link] = useState(linkedFilters);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [category, setCategory] = useState(link.category);
  const [theme, setTheme] = useState(link.theme);
  const [savedOnly, setSavedOnly] = useState(false);

  // Bookmarks the user has just confirmed on this screen, by career id. They sit
  // on top of the server's saved list, which is a snapshot from when it loaded.
  const [savedHere, setSavedHere] = useState<Map<number, boolean>>(new Map());
  const [pending, setPending] = useState<Set<number>>(new Set());

  // Debounce the search box (~250ms) so typing doesn't hammer the API.
  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(id);
  }, [search]);

  // Categories power the chips; a failure here only hides the chips.
  const loadCategories = useCallback(
    () => api.categories().catch(() => [] as Category[]),
    [],
  );
  const categories = useResource(loadCategories, sessionStatus === "ready");

  // The "Saved only" filter and the bookmark buttons read this.
  const loadSaved = useCallback(() => api.savedCareers(), []);
  const saved = useResource(loadSaved, sessionStatus === "ready");

  const savedIds = useMemo(() => {
    const ids = new Set((saved.data ?? []).map((entry) => entry.career.id));
    for (const [id, isSaved] of savedHere) {
      if (isSaved) ids.add(id);
      else ids.delete(id);
    }
    return ids;
  }, [saved.data, savedHere]);

  const loadCareers = useCallback(
    () => api.careers({ search: debounced, category, theme }),
    [debounced, category, theme],
  );
  const list = useResource(loadCareers, sessionStatus === "ready");
  const careers = useMemo(() => list.data ?? [], [list.data]);

  const toggleSave = useCallback(
    async (career: CareerSummary) => {
      const wasSaved = savedIds.has(career.id);
      setPending((prev) => new Set(prev).add(career.id));
      // Optimistic flip, kept in `savedHere` so it survives a re-read of the
      // server's list and is dropped only if the request itself failed.
      setSavedHere((prev) => new Map(prev).set(career.id, !wasSaved));
      try {
        if (wasSaved) {
          await api.unsaveCareer(career.id);
          toast(`Removed ${career.title} from saved.`, "success");
        } else {
          await api.saveCareer(career.id);
          toast(`Saved ${career.title} to explore later.`, "success");
        }
      } catch (error) {
        // Roll the single flip back so the button never lies about its state.
        setSavedHere((prev) => {
          const next = new Map(prev);
          next.delete(career.id);
          return next;
        });
        toast(messageFor(error), "error");
      } finally {
        setPending((prev) => {
          const next = new Set(prev);
          next.delete(career.id);
          return next;
        });
      }
    },
    [savedIds, toast],
  );

  const visible = useMemo(
    () => (savedOnly ? careers.filter((c) => savedIds.has(c.id)) : careers),
    [careers, savedOnly, savedIds],
  );

  const hasFilters = Boolean(search || category || theme || savedOnly);
  const clearFilters = () => {
    setSearch("");
    setDebounced("");
    setCategory("");
    setTheme("");
    setSavedOnly(false);
  };

  const chips = useMemo(
    () => [{ value: "", label: t("All fields") }, ...(categories.data ?? []).map((c) => ({ value: c.name, label: `${c.name} (${c.count})` }))],
    [categories.data, t],
  );

  return (
    <Screen
      title="Career Explorer"
      description="Browse careers across every field. These describe possibilities to look into, not predictions about you."
      action={
        <LinkButton href="/app/interests" variant="outline" size="sm">
          {t("Personalise by interest")}
        </LinkButton>
      }
    >
      <div className="space-y-5">
        {/* Filters */}
        <Card className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                aria-hidden
              />
              <Input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("Search careers, e.g. data, nurse, pilot")}
                aria-label={t("Search careers")}
                className="pl-9 pr-9"
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label={t("Clear search")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-muted hover:bg-canvas hover:text-ink"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              ) : null}
            </div>
            <Select
              label={undefined}
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              options={THEME_OPTIONS}
              placeholder={t("All interest themes")}
              aria-label={t("Filter by interest theme")}
            />
          </div>

          {(categories.data ?? []).length > 0 ? (
            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted">
                <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
                {t("Field")}
              </p>
              <PillGroup items={chips} value={category} onChange={setCategory} />
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
            <label className="flex cursor-pointer select-none items-center gap-2 text-sm font-medium text-ink">
              <input
                type="checkbox"
                checked={savedOnly}
                onChange={(e) => setSavedOnly(e.target.checked)}
                className="h-4.5 w-4.5 rounded-md border-line accent-brand"
              />
              {t("Saved only")}
            </label>
            {hasFilters ? (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-brand-dark hover:bg-brand-mist"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
                {t("Clear filters")}
              </button>
            ) : null}
          </div>
        </Card>

        {/* Honest framing above results */}
        <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {t(
            "Careers here describe what the work is really like. Entry requirements, costs and exams change often — always verify them with the official sources on each career page.",
          )}
        </p>

        {/* Results */}
        {list.state === "loading" ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : list.state === "error" ? (
          <ErrorState description={list.error} onRetry={list.reload} />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={Search}
            title={hasFilters ? t("No careers match these filters") : t("No careers found yet")}
            description={
              savedOnly && careers.length > 0
                ? t("You haven't saved any career in this view yet. Try turning off 'Saved only'.")
                : t("Try a different search term, or clear the filters to see everything.")
            }
            action={
              hasFilters ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
                >
                  <X className="h-4 w-4" aria-hidden />
                  {t("Clear filters")}
                </button>
              ) : undefined
            }
          />
        ) : (
          <>
            <p className="text-sm text-muted" aria-live="polite">
              {visible.length === 1
                ? tf("Showing 1 career", { n: 1 })
                : tf("Showing {n} careers", { n: visible.length })}
              {hasFilters ? ` ${t("with your filters")}` : ""}.
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((career) => {
                const isSaved = savedIds.has(career.id);
                const busy = pending.has(career.id);
                return (
                  <Card key={career.id} className="flex flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <Badge className={cn("min-w-0", categoryTint(career.category))}>{career.category}</Badge>
                      <button
                        type="button"
                        onClick={() => void toggleSave(career)}
                        disabled={busy}
                        aria-pressed={isSaved}
                        aria-label={isSaved ? `Unsave ${career.title}` : `Save ${career.title}`}
                        className={cn(
                          "shrink-0 rounded-full border p-2 transition-colors disabled:opacity-60",
                          isSaved
                            ? "border-brand bg-brand text-white"
                            : "border-line bg-surface text-muted hover:border-brand-light hover:text-brand-dark",
                        )}
                      >
                        <Bookmark className={cn("h-4 w-4", isSaved && "fill-current")} aria-hidden />
                      </button>
                    </div>

                    <h3 className="mt-2.5 text-base font-semibold leading-tight text-ink break-words">
                      {t(career.title)}
                    </h3>
                    <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted">{career.summary}</p>

                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className="min-w-0 text-xs leading-relaxed font-medium text-teal">
                        {tf("Explorable from class {n}", { n: career.min_class })}
                      </span>
                      <LinkButton href={`/app/careers/${career.slug}`} variant="ghost" size="sm" className="shrink-0 px-0 text-brand-dark hover:bg-transparent">
                        {t("View details")}
                      </LinkButton>
                    </div>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </div>
    </Screen>
  );
}
