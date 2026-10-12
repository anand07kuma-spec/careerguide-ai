"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bookmark, Info, Search, SlidersHorizontal, X } from "lucide-react";
import { Screen } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState, SkeletonCard } from "@/components/ui/feedback";
import { Input, Select } from "@/components/ui/field";
import { PillGroup } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/lib/api";
import { useSession } from "@/lib/session";
import { THEME_LABELS, type CareerSummary, type Category, type ThemeKey } from "@/lib/types";
import { categoryTint, cn } from "@/lib/utils";

type Status = "loading" | "ready" | "error";

function messageFor(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "We couldn't reach the career library.";
}

const THEME_OPTIONS = (Object.keys(THEME_LABELS) as ThemeKey[]).map((key) => ({
  value: key,
  label: THEME_LABELS[key],
}));

export default function CareerExplorer() {
  const { status: sessionStatus } = useSession();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [category, setCategory] = useState("");
  const [theme, setTheme] = useState("");
  const [savedOnly, setSavedOnly] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [careers, setCareers] = useState<CareerSummary[]>([]);
  const [listStatus, setListStatus] = useState<Status>("loading");
  const [listError, setListError] = useState<string | null>(null);

  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());
  const [pending, setPending] = useState<Set<number>>(new Set());

  const requestRef = useRef(0);

  // Deep links: /app/careers?category=...&theme=... seed the filters once.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const c = params.get("category");
    const t = params.get("theme");
    if (c) setCategory(c);
    if (t) setTheme(t);
  }, []);

  // Debounce the search box (~250ms) so typing doesn't hammer the API.
  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(id);
  }, [search]);

  // Categories power the chips; a failure here only hides the chips.
  useEffect(() => {
    if (sessionStatus !== "ready") return;
    let active = true;
    void api
      .categories()
      .then((data) => {
        if (active) setCategories(data);
      })
      .catch(() => {
        if (active) setCategories([]);
      });
    return () => {
      active = false;
    };
  }, [sessionStatus]);

  // Saved set drives the bookmark buttons and the "Saved only" filter.
  const loadSaved = useCallback(async () => {
    try {
      const data = await api.savedCareers();
      setSavedIds(new Set(data.map((s) => s.career.id)));
    } catch {
      /* the explorer still works without knowing what's saved */
    }
  }, []);

  useEffect(() => {
    if (sessionStatus !== "ready") return;
    void loadSaved();
  }, [sessionStatus, loadSaved]);

  const fetchCareers = useCallback(async () => {
    const token = ++requestRef.current;
    setListStatus("loading");
    setListError(null);
    try {
      const data = await api.careers({ search: debounced, category, theme });
      if (token !== requestRef.current) return;
      setCareers(data);
      setListStatus("ready");
    } catch (error) {
      if (token !== requestRef.current) return;
      setListError(messageFor(error));
      setListStatus("error");
    }
  }, [debounced, category, theme]);

  useEffect(() => {
    if (sessionStatus !== "ready") return;
    void fetchCareers();
  }, [sessionStatus, fetchCareers]);

  const toggleSave = useCallback(
    async (career: CareerSummary) => {
      const wasSaved = savedIds.has(career.id);
      // Optimistic flip, with a per-id pending guard for the spinner.
      setSavedIds((prev) => {
        const next = new Set(prev);
        if (wasSaved) next.delete(career.id);
        else next.add(career.id);
        return next;
      });
      setPending((prev) => new Set(prev).add(career.id));
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
        setSavedIds((prev) => {
          const next = new Set(prev);
          if (wasSaved) next.add(career.id);
          else next.delete(career.id);
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
    () => [{ value: "", label: "All fields" }, ...categories.map((c) => ({ value: c.name, label: `${c.name} (${c.count})` }))],
    [categories],
  );

  return (
    <Screen
      title="Career Explorer"
      description="Browse careers across every field. These describe possibilities to look into, not predictions about you."
      action={
        <LinkButton href="/app/interests" variant="outline" size="sm">
          Personalise by interest
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
                placeholder="Search careers, e.g. data, nurse, pilot"
                aria-label="Search careers"
                className="pl-9 pr-9"
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
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
              placeholder="All interest themes"
              aria-label="Filter by interest theme"
            />
          </div>

          {categories.length > 0 ? (
            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted">
                <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
                Field
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
              Saved only
            </label>
            {hasFilters ? (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-brand-dark hover:bg-brand-mist"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
                Clear filters
              </button>
            ) : null}
          </div>
        </Card>

        {/* Honest framing above results */}
        <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          Careers here describe what the work is really like. Entry requirements, costs and exams
          change often — always verify them with the official sources on each career page.
        </p>

        {/* Results */}
        {listStatus === "loading" ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : listStatus === "error" ? (
          <ErrorState description={listError} onRetry={fetchCareers} />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={Search}
            title={hasFilters ? "No careers match these filters" : "No careers found yet"}
            description={
              savedOnly && careers.length > 0
                ? "You haven't saved any career in this view yet. Try turning off 'Saved only'."
                : "Try a different search term, or clear the filters to see everything."
            }
            action={
              hasFilters ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
                >
                  <X className="h-4 w-4" aria-hidden />
                  Clear filters
                </button>
              ) : undefined
            }
          />
        ) : (
          <>
            <p className="text-sm text-muted" aria-live="polite">
              Showing <span className="font-semibold text-ink">{visible.length}</span>{" "}
              {visible.length === 1 ? "career" : "careers"}
              {hasFilters ? " with your filters" : ""}.
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((career) => {
                const isSaved = savedIds.has(career.id);
                const busy = pending.has(career.id);
                return (
                  <Card key={career.id} className="flex flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <Badge className={categoryTint(career.category)}>{career.category}</Badge>
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

                    <h3 className="mt-2.5 text-base font-semibold leading-tight text-ink">{career.title}</h3>
                    <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted">{career.summary}</p>

                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-teal">
                        Explorable from class {career.min_class}
                      </span>
                      <LinkButton href={`/app/careers/${career.slug}`} variant="ghost" size="sm" className="px-0 text-brand-dark hover:bg-transparent">
                        View details
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
