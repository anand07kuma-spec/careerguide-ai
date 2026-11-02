"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, Clock, ExternalLink, Globe, Info, Layers, Search, X } from "lucide-react";
import { Screen } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Button, LinkButton } from "@/components/ui/button";
import { Badge, VerificationBadge } from "@/components/ui/badge";
import { EmptyState, ErrorState, SkeletonCard } from "@/components/ui/feedback";
import { Input, Select } from "@/components/ui/field";
import { PillGroup } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { useT, useTf } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { useResource } from "@/lib/use-resource";
import type { Resource } from "@/lib/types";
import { categoryTint, classLabel } from "@/lib/utils";

/** Display-only prettifiers. They never add data the backend didn't return. */
function titleCase(value: string): string {
  if (!value) return value;
  return value
    .split(/[\s_-]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi" },
];

export default function ResourcesScreen() {
  const { status: sessionStatus, profile } = useSession();
  const t = useT();
  const tf = useTf();

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [kind, setKind] = useState("");
  const [language, setLanguage] = useState("");
  const [category, setCategory] = useState("");

  const loadResources = useCallback(
    () => api.resources({ search: debounced, category, kind, language }),
    [debounced, category, kind, language],
  );
  const list = useResource(loadResources, sessionStatus === "ready");
  const items = list.data ?? [];

  // One-time unfiltered snapshot used only to derive the filter options, so the
  // chips never disappear as the visible list narrows.
  const [facets, setFacets] = useState<Resource[]>([]);
  const [categories, setCategories] = useState<string[]>([]);

  const younger = useMemo(() => {
    const cls = profile?.class_level ? Number(classLabel(profile.class_level)?.replace(/\D/g, "")) : NaN;
    const band = profile?.age_range ?? "";
    return (Number.isFinite(cls) && cls > 0 && cls <= 8) || ["3-5", "6-8", "9-10"].includes(band);
  }, [profile]);

  // Debounce the search box (~250ms) so typing doesn't hammer the API.
  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(id);
  }, [search]);

  // Derive kinds + load the category list once. A failure here only hides chips.
  useEffect(() => {
    let active = true;
    void Promise.all([api.resources(), api.resourceCategories()])
      .then(([all, cats]) => {
        if (!active) return;
        setFacets(all);
        setCategories(cats);
      })
      .catch(() => {
        if (!active) return;
        setFacets([]);
        setCategories([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const kindOptions = useMemo(() => {
    const seen = Array.from(new Set(facets.map((r) => r.kind))).sort();
    return [
      { value: "", label: "All types" },
      ...seen.map((k) => ({ value: k, label: titleCase(k) })),
    ];
  }, [facets]);

  const hindiCount = useMemo(() => facets.filter((r) => r.language === "hi").length, [facets]);
  const totalCount = facets.length;

  const hasFilters = Boolean(search || kind || language || category);
  const clearFilters = () => {
    setSearch("");
    setDebounced("");
    setKind("");
    setLanguage("");
    setCategory("");
  };

  return (
    <Screen
      title="Free Learning Resources"
      description={
        younger
          ? "Hand-picked free things to try — videos, activities and sites. They are starting points for exploring, not homework or a test."
          : "Publicly available resources to explore careers and skills for free. These are starting points to look into, not a ranked or complete list."
      }
      badge={<Badge tone="teal" icon={<BookOpen className="h-3.5 w-3.5" aria-hidden />}>{t("Sample catalogue")}</Badge>}
    >
      <div className="space-y-5">
        {/* Filters */}
        <Card className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
              <Input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search resources, e.g. coding, pilot, Hindi"
                aria-label={t("Search resources")}
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
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              options={categories.map((c) => ({ value: c, label: c }))}
              placeholder="All categories"
              aria-label={t("Filter by category")}
            />
          </div>

          {kindOptions.length > 1 ? (
            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted">
                <Layers className="h-3.5 w-3.5" aria-hidden />
                {t("Type")}
              </p>
              <PillGroup items={kindOptions} value={kind} onChange={setKind} />
            </div>
          ) : null}

          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="w-full sm:w-64">
              <Select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                options={LANGUAGE_OPTIONS}
                placeholder="Any language"
                aria-label={t("Filter by language")}
                hint={
                  totalCount > 0
                    ? tf("Most resources are in English. Only {hi} of {total} are in Hindi so far.", {
                        hi: hindiCount,
                        total: totalCount,
                      })
                    : t("Most resources are in English; Hindi content is still limited.")
                }
              />
            </div>
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

        {/* Honest one-line note */}
        <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {t(
            "These are publicly available starting points. Links and page contents can change at any time, so always check the page that actually opens.",
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
        ) : items.length === 0 ? (
          <EmptyState
            icon={Search}
            title={hasFilters ? "No resources match these filters" : "No resources found yet"}
            description={
              hasFilters
                ? "Try a different search term, or clear the filters to see the full sample list."
                : "The resource library is empty right now. Please check back soon."
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
          <ResourceResults
            key={`${debounced}|${kind}|${language}|${category}`}
            items={items}
            hasFilters={hasFilters}
          />
        )}
      </div>
    </Screen>
  );
}

// ------------------------------------------------------------------- results

/** Owns the reveal window so a filter change remounts it back to the first page
 * instead of leaving a long list scrolled open under a new query. */
function ResourceResults({ items, hasFilters }: { items: Resource[]; hasFilters: boolean }) {
  const t = useT();
  const tf = useTf();
  const [shown, setShown] = useState(12);
  const page = items.slice(0, shown);

  return (
    <>
      <p className="text-sm text-muted" aria-live="polite">
        {tf(
          hasFilters
            ? items.length === 1
              ? "Showing {n} resource with your filters."
              : "Showing {n} resources with your filters."
            : items.length === 1
              ? "Showing {n} resource."
              : "Showing {n} resources.",
          { n: items.length },
        )}
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {page.map((resource) => (
          <Card key={resource.id} className="flex flex-col">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone="brand">{t(titleCase(resource.kind))}</Badge>
              <Badge className={categoryTint(resource.category)}>{resource.category}</Badge>
            </div>

            <h3 className="mt-2.5 break-words text-base font-semibold leading-snug text-heading">
              {resource.title}
            </h3>
            <p className="mt-1.5 flex-1 break-words text-sm leading-relaxed text-muted">
              {resource.description}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-muted">
              <Badge tone="neutral">{t(titleCase(resource.level))}</Badge>
              <Badge tone="neutral" icon={<Globe className="h-3 w-3" aria-hidden />}>
                {resource.language === "hi" ? t("Hindi") : resource.language === "en" ? t("English") : t(titleCase(resource.language))}
              </Badge>
              {resource.duration_minutes != null ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-canvas px-2 py-1 text-[11px] font-medium text-muted">
                  <Clock className="h-3 w-3" aria-hidden />
                  {tf(
                    resource.duration_minutes === 1 ? "about {n} minute" : "about {n} minutes",
                    { n: resource.duration_minutes },
                  )}
                </span>
              ) : null}
            </div>

            <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-3">
              <VerificationBadge verified={resource.verified} />
              <LinkButton href={resource.url} variant="outline" size="sm">
                {t("Open")}
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </LinkButton>
            </div>
          </Card>
        ))}
      </div>
      {items.length > shown ? (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => setShown((s) => s + 12)}>
            {t("Show more resources")}
          </Button>
        </div>
      ) : null}
    </>
  );
}
