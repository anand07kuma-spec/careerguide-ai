"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeCheck,
  ExternalLink,
  HeartHandshake,
  Info,
  Landmark,
  ListChecks,
  Lock,
  Search,
  ShieldCheck,
  Wallet,
  X,
} from "lucide-react";
import { Screen } from "@/components/layout/app-shell";
import { Card, SectionHeading } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { Badge, VerificationBadge } from "@/components/ui/badge";
import { EmptyState, ErrorState, SkeletonCard } from "@/components/ui/feedback";
import { Input, Select } from "@/components/ui/field";
import { api, ApiError } from "@/lib/api";
import { useSession } from "@/lib/session";
import type { Scholarship } from "@/lib/types";
import { classLabel } from "@/lib/utils";

type Status = "loading" | "ready" | "error";

function messageFor(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "We couldn't reach the scholarship list.";
}

/** Display-only prettifiers for values the API already returned. */
const SCOPE_LABELS: Record<string, string> = {
  central: "Central government",
  state: "State government",
  institution: "Institution",
  private_trust: "Private trust",
};

function scopeLabel(value: string): string {
  return SCOPE_LABELS[value] ?? value.replace(/_/g, " ");
}

const LEVEL_LABELS: Record<string, string> = {
  "class-9": "Class 9",
  "class-10": "Class 10",
  "class-11": "Class 11",
  "class-12": "Class 12",
  undergraduate: "Undergraduate",
  postgraduate: "Postgraduate",
  "diploma-iti": "Diploma / ITI",
};

function levelLabel(value: string): string {
  if (LEVEL_LABELS[value]) return LEVEL_LABELS[value];
  const label = classLabel(value);
  return label ?? value.replace(/-/g, " ");
}

function stateLabel(value: string): string {
  return value === "all-india" ? "All India" : value;
}

function checkedDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString();
}

export default function ScholarshipsScreen() {
  const { status: sessionStatus } = useSession();

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [level, setLevel] = useState("");
  const [state, setState] = useState("");
  const [scope, setScope] = useState("");

  const [items, setItems] = useState<Scholarship[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);

  // One-time unfiltered snapshot to derive the filter options.
  const [facets, setFacets] = useState<Scholarship[]>([]);

  const requestRef = useRef(0);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(id);
  }, [search]);

  useEffect(() => {
    let active = true;
    void api
      .scholarships()
      .then((all) => {
        if (active) setFacets(all);
      })
      .catch(() => {
        if (active) setFacets([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const fetchScholarships = useCallback(async () => {
    const token = ++requestRef.current;
    setStatus("loading");
    setError(null);
    try {
      const data = await api.scholarships({ search: debounced, state, level, scope });
      if (token !== requestRef.current) return;
      setItems(data);
      setStatus("ready");
    } catch (err) {
      if (token !== requestRef.current) return;
      setError(messageFor(err));
      setStatus("error");
    }
  }, [debounced, state, level, scope]);

  useEffect(() => {
    if (sessionStatus !== "ready") return;
    void fetchScholarships();
  }, [sessionStatus, fetchScholarships]);

  const levelOptions = useMemo(() => {
    const seen = Array.from(new Set(facets.flatMap((s) => s.education_levels))).sort();
    return [
      { value: "", label: "All class levels" },
      ...seen.map((l) => ({ value: l, label: levelLabel(l) })),
    ];
  }, [facets]);

  const stateOptions = useMemo(() => {
    const seen = Array.from(new Set(facets.flatMap((s) => s.states))).sort((a, b) =>
      a === "all-india" ? -1 : b === "all-india" ? 1 : a.localeCompare(b),
    );
    return [
      { value: "", label: "All states / All India" },
      ...seen.map((s) => ({ value: s, label: stateLabel(s) })),
    ];
  }, [facets]);

  const scopeOptions = useMemo(() => {
    const seen = Array.from(new Set(facets.map((s) => s.scope))).sort();
    return [
      { value: "", label: "All providers" },
      ...seen.map((s) => ({ value: s, label: scopeLabel(s) })),
    ];
  }, [facets]);

  const hasFilters = Boolean(search || level || state || scope);
  const clearFilters = () => {
    setSearch("");
    setDebounced("");
    setLevel("");
    setState("");
    setScope("");
  };

  return (
    <Screen
      title="Scholarships & Financial Guidance"
      description="A starting point for finding help with study costs. This is a sample list, not a complete or live one — every scheme must be confirmed on its official portal."
      badge={<Badge tone="teal" icon={<Wallet className="h-3.5 w-3.5" aria-hidden />}>Sample list — verify first</Badge>}
    >
      <div className="space-y-5">
        {/* How to check a scheme is real — persistent, above the list */}
        <Card className="border-brand-light/40 bg-brand-mist/40">
          <SectionHeading
            title="How to check a scheme is real"
            description="Before trusting any scholarship, do these three things."
          />
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink">
            <li className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-dark" aria-hidden />
              <span>Open the official government website yourself (for example the National Scholarship Portal) and read the current circular there — not a forwarded screenshot or WhatsApp message.</span>
            </li>
            <li className="flex items-start gap-2">
              <Landmark className="mt-0.5 h-4 w-4 shrink-0 text-brand-dark" aria-hidden />
              <span>Ask your school office or college scholarship desk. They handle these applications and can tell you what is genuine.</span>
            </li>
            <li className="flex items-start gap-2">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-brand-dark" aria-hidden />
              <span>Never pay a fee to someone who offers to &ldquo;apply on your behalf.&rdquo; Genuine government schemes do not charge agents to submit an application.</span>
            </li>
          </ul>
          <p className="mt-3 flex items-start gap-1.5 text-xs leading-relaxed text-muted">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            This list is a starting point only. It is not complete, and details change every academic year.
          </p>
        </Card>

        {/* Filters */}
        <Card className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative sm:col-span-2 lg:col-span-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
              <Input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search schemes"
                aria-label="Search scholarships"
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
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              options={levelOptions}
              aria-label="Filter by class level"
            />
            <Select
              value={state}
              onChange={(e) => setState(e.target.value)}
              options={stateOptions}
              aria-label="Filter by state"
            />
            <Select
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              options={scopeOptions}
              aria-label="Filter by provider type"
            />
          </div>
          {hasFilters ? (
            <div className="flex justify-end border-t border-line pt-3">
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-brand-dark hover:bg-brand-mist"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
                Clear filters
              </button>
            </div>
          ) : null}
        </Card>

        {/* Results */}
        {status === "loading" ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : status === "error" ? (
          <ErrorState description={error} onRetry={fetchScholarships} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Search}
            title={hasFilters ? "No schemes match these filters" : "No scholarships found yet"}
            description={
              hasFilters
                ? "Try widening the class level, state or provider filters, or clear them to see the sample list."
                : "The scholarship list is empty right now. Please check back soon."
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
              Showing <span className="font-semibold text-ink">{items.length}</span>{" "}
              {items.length === 1 ? "scheme" : "schemes"}
              {hasFilters ? " with your filters" : ""}.
            </p>
            <div className="grid gap-4 lg:grid-cols-2">
              {items.map((scholarship) => {
                const allIndia = scholarship.states.includes("all-india");
                return (
                  <Card key={scholarship.id} className="flex flex-col">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-base font-semibold leading-tight text-ink">{scholarship.name}</h3>
                        <p className="mt-0.5 text-sm text-muted">{scholarship.provider}</p>
                      </div>
                      <Badge tone="brand">{scopeLabel(scholarship.scope)}</Badge>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {allIndia ? (
                        <Badge tone="teal">All India</Badge>
                      ) : (
                        scholarship.states.map((s) => <Badge key={s} tone="neutral">{stateLabel(s)}</Badge>)
                      )}
                      {scholarship.education_levels.map((l) => (
                        <Badge key={l} tone="neutral">{levelLabel(l)}</Badge>
                      ))}
                      {scholarship.categories.map((c) => (
                        <Badge key={c} tone="neutral">{c.replace(/-/g, " ")}</Badge>
                      ))}
                    </div>

                    <dl className="mt-3 space-y-2 text-sm leading-relaxed">
                      <div>
                        <dt className="font-medium text-ink">What it offers</dt>
                        <dd className="text-muted">{scholarship.benefit_summary}</dd>
                      </div>
                      <div>
                        <dt className="font-medium text-ink">Who it is generally for</dt>
                        <dd className="text-muted">{scholarship.eligibility_summary}</dd>
                      </div>
                    </dl>

                    {scholarship.application_steps.length > 0 ? (
                      <div className="mt-3">
                        <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
                          <ListChecks className="h-4 w-4 text-brand-dark" aria-hidden />
                          How to apply
                        </p>
                        <ol className="mt-1.5 space-y-1.5">
                          {scholarship.application_steps.map((step, index) => (
                            <li key={index} className="flex items-start gap-2 text-sm text-muted">
                              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-mist text-[11px] font-semibold text-brand-dark">
                                {index + 1}
                              </span>
                              <span className="leading-relaxed">{step}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    ) : null}

                    {/* Disclaimer — always visible, not hidden behind a tooltip */}
                    <div className="mt-3 rounded-xl border border-warning/30 bg-warning-mist px-3 py-2.5">
                      <p className="flex items-start gap-1.5 text-xs leading-relaxed text-amber-800">
                        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                        {scholarship.disclaimer}
                      </p>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                      <div className="flex flex-col gap-1">
                        <VerificationBadge verified={scholarship.verified} />
                        <span className="text-[11px] text-muted">
                          {scholarship.last_verified_at ? `Last checked: ${checkedDate(scholarship.last_verified_at)}` : "Not yet verified"}
                        </span>
                      </div>
                      <LinkButton href={scholarship.official_url} variant="outline" size="sm">
                        Official site
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                      </LinkButton>
                    </div>
                  </Card>
                );
              })}
            </div>
          </>
        )}

        {/* Family finances — a calmer view */}
        <Card className="border-teal/30 bg-teal-mist/40">
          <SectionHeading
            title={
              <span className="flex items-center gap-2">
                <HeartHandshake className="h-5 w-5 text-teal" aria-hidden />
                Family finances — a calmer view
              </span>
            }
            description="Money shapes which route is possible. It never measures how much you are worth."
          />
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink">
            <li className="flex items-start gap-2">
              <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-teal" aria-hidden />
              <span>Limited money can limit a route, but it never limits your worth or your right to a good career.</span>
            </li>
            <li className="flex items-start gap-2">
              <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-teal" aria-hidden />
              <span>Ask your school office about schemes you may qualify for — many never get applied to simply because families don&rsquo;t know they exist.</span>
            </li>
            <li className="flex items-start gap-2">
              <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-teal" aria-hidden />
              <span>Government schemes and low-cost state colleges are legitimate first choices, not a lesser path.</span>
            </li>
            <li className="flex items-start gap-2">
              <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-teal" aria-hidden />
              <span>Never pay a middleman to apply for you. Applications go through official portals, often with help from your school.</span>
            </li>
            <li className="flex items-start gap-2">
              <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-teal" aria-hidden />
              <span>This app never asks for banking details or documents, and you should not share them here with anyone.</span>
            </li>
          </ul>
        </Card>
      </div>
    </Screen>
  );
}
