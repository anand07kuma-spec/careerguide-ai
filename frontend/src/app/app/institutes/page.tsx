"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2,
  ExternalLink,
  GraduationCap,
  HelpCircle,
  Info,
  Layers,
  MapPin,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { Screen } from "@/components/layout/app-shell";
import { Card, SectionHeading } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { Badge, VerificationBadge } from "@/components/ui/badge";
import { EmptyState, ErrorState, SkeletonCard } from "@/components/ui/feedback";
import { Input, Select } from "@/components/ui/field";
import { PillGroup } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { useT, useTf } from "@/lib/i18n";
import type { Institution } from "@/lib/types";
import { useSession } from "@/lib/session";
import { useResource } from "@/lib/use-resource";

/** Display-only prettifiers for values the API already returned. */
const TYPE_LABELS: Record<string, string> = {
  public: "Public / Government",
  private: "Private",
  aided: "Aided",
  deemed: "Deemed university",
};
function typeLabel(value: string): string {
  return TYPE_LABELS[value] ?? value.replace(/-/g, " ");
}

const MODE_LABELS: Record<string, string> = {
  online: "Online",
  offline: "In person",
  hybrid: "Hybrid",
  distance: "Distance",
};
function modeLabel(value: string): string {
  return MODE_LABELS[value] ?? value.replace(/-/g, " ");
}

const EDU_LABELS: Record<string, string> = {
  school: "School",
  "diploma-iti": "Diploma / ITI",
  undergraduate: "Undergraduate",
  postgraduate: "Postgraduate",
  "training-centre": "Training centre",
};
function eduLabel(value: string): string {
  return EDU_LABELS[value] ?? value.replace(/-/g, " ");
}

export default function InstitutesScreen() {
  const t = useT();
  const tf = useTf();
  const { status: sessionStatus } = useSession();

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [type, setType] = useState("");
  const [mode, setMode] = useState("");
  const [state, setState] = useState("");
  const [careerArea, setCareerArea] = useState("");

  const loadInstitutions = useCallback(
    () =>
      api.institutions({
        search: debounced,
        state,
        career_area: careerArea,
        institution_type: type,
        mode,
      }),
    [debounced, state, careerArea, type, mode],
  );
  const list = useResource(loadInstitutions, sessionStatus === "ready");
  const items = list.data ?? [];

  const [facets, setFacets] = useState<Institution[]>([]);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(id);
  }, [search]);

  useEffect(() => {
    let active = true;
    void api
      .institutions()
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

  const typeOptions = useMemo(() => {
    const seen = Array.from(new Set(facets.map((i) => i.institution_type))).sort();
    return [{ value: "", label: "All types" }, ...seen.map((value) => ({ value, label: typeLabel(value) }))];
  }, [facets]);

  const modeOptions = useMemo(() => {
    const seen = Array.from(new Set(facets.map((i) => i.mode))).sort();
    return [{ value: "", label: "Any mode" }, ...seen.map((m) => ({ value: m, label: modeLabel(m) }))];
  }, [facets]);

  const stateOptions = useMemo(() => {
    const seen = Array.from(new Set(facets.map((i) => i.state))).sort();
    return [{ value: "", label: "All states" }, ...seen.map((s) => ({ value: s, label: s }))];
  }, [facets]);

  const careerOptions = useMemo(() => {
    const seen = Array.from(new Set(facets.flatMap((i) => i.career_areas))).sort();
    return [{ value: "", label: "All career areas" }, ...seen.map((c) => ({ value: c, label: c }))];
  }, [facets]);

  const hasFilters = Boolean(search || type || mode || state || careerArea);
  const clearFilters = () => {
    setSearch("");
    setDebounced("");
    setType("");
    setMode("");
    setState("");
    setCareerArea("");
  };

  return (
    <Screen
      title="Institutes & Courses"
      description="A sample directory of places to look into. Listings are not verified or ranked, and some are sponsored partnerships — compare every institute yourself."
      badge={<Badge tone="teal" icon={<Building2 className="h-3.5 w-3.5" aria-hidden />}>{t("Sample directory")}</Badge>}
    >
      <div className="space-y-5">
        {/* Permanent sponsorship disclosure */}
        <Card className="border-warning/40 bg-warning-mist/50">
          <SectionHeading
            title="About these listings"
            description="Some entries below are sponsored partnerships. A sponsored badge is always shown, and the order here is not a ranking."
          />
          <ul className="mt-3 space-y-1.5 text-sm leading-relaxed text-amber-900">
            <li className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>{t("Sponsorship never changes a career recommendation anywhere in this app.")}</span>
            </li>
            <li className="flex items-start gap-2">
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>{t("Free, government and aided institutes get no promotional treatment either — you should compare all of them on your own terms.")}</span>
            </li>
          </ul>
        </Card>

        {/* Filters */}
        <Card className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="relative lg:col-span-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
              <Input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search institutes"
                aria-label={t("Search institutes")}
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
              value={state}
              onChange={(e) => setState(e.target.value)}
              options={stateOptions}
              aria-label={t("Filter by state")}
            />
            <Select
              value={careerArea}
              onChange={(e) => setCareerArea(e.target.value)}
              options={careerOptions}
              aria-label={t("Filter by career area")}
            />
          </div>

          {typeOptions.length > 1 ? (
            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted">
                <Building2 className="h-3.5 w-3.5" aria-hidden />
                {t("Type")}
              </p>
              <PillGroup items={typeOptions} value={type} onChange={setType} />
            </div>
          ) : null}

          {modeOptions.length > 1 ? (
            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted">
                <Layers className="h-3.5 w-3.5" aria-hidden />
                {t("Mode")}
              </p>
              <PillGroup items={modeOptions} value={mode} onChange={setMode} />
            </div>
          ) : null}

          {hasFilters ? (
            <div className="flex justify-end border-t border-line pt-3">
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-brand-dark hover:bg-brand-mist"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
                {t("Clear filters")}
              </button>
            </div>
          ) : null}
        </Card>

        {/* Results */}
        {list.state === "loading" ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : list.state === "error" ? (
          <ErrorState description={list.error} onRetry={list.reload} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Search}
            title={hasFilters ? t("No institutes match these filters") : t("No institutes found yet")}
            description={
              hasFilters
                ? "Try a different state, career area or type, or clear the filters to see the sample list."
                : "The institute directory is empty right now. Please check back soon."
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
              {items.length === 1
                ? tf("Showing 1 institute", { n: 1 })
                : tf("Showing {n} institutes", { n: items.length })}
              {hasFilters ? ` ${t("with your filters")}` : ""}. {t("Order here is not a ranking.")}
            </p>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {items.map((institution) => (
                <Card key={institution.id} className="flex flex-col">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="min-w-0 text-base font-semibold leading-tight text-ink">{institution.name}</h3>
                    {institution.sponsored ? <Badge tone="warning">{t("Sponsored partner")}</Badge> : null}
                  </div>

                  {institution.sponsored && institution.sponsorship_disclosure ? (
                    <p className="mt-1.5 rounded-lg bg-warning-mist/60 px-2.5 py-1.5 text-xs leading-relaxed text-amber-800">
                      {institution.sponsorship_disclosure}
                    </p>
                  ) : null}

                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" aria-hidden />
                      {institution.city}, {institution.state}
                    </span>
                    <span>{t(typeLabel(institution.institution_type))}</span>
                    <span>{t(modeLabel(institution.mode))}</span>
                    <span>{t(eduLabel(institution.education_level))}</span>
                  </div>

                  {institution.career_areas.length > 0 ? (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {institution.career_areas.map((area) => (
                        <Badge key={area} tone="neutral">{area}</Badge>
                      ))}
                    </div>
                  ) : null}

                  {institution.courses.length > 0 ? (
                    <div className="mt-3">
                      <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
                        <GraduationCap className="h-4 w-4 text-brand-dark" aria-hidden />
                        {t("Courses listed")}
                      </p>
                      <ul className="mt-1.5 space-y-1">
                        {institution.courses.map((course, index) => (
                          <li key={index} className="flex items-start gap-2 text-sm text-muted">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-light" aria-hidden />
                            <span className="leading-relaxed">{course}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <dl className="mt-3 space-y-2 text-sm leading-relaxed">
                    {institution.fee_range ? (
                      <div>
                        <dt className="font-medium text-ink">{t("Fees")}</dt>
                        <dd className="text-muted">{institution.fee_range}</dd>
                      </div>
                    ) : null}
                    {institution.admission_info ? (
                      <div>
                        <dt className="font-medium text-ink">{t("Admission")}</dt>
                        <dd className="text-muted">{institution.admission_info}</dd>
                      </div>
                    ) : null}
                    {institution.scholarships_note ? (
                      <div>
                        <dt className="font-medium text-ink">{t("Scholarships")}</dt>
                        <dd className="text-muted">{institution.scholarships_note}</dd>
                      </div>
                    ) : null}
                  </dl>

                  <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-3">
                    <VerificationBadge verified={institution.verified} />
                    <LinkButton href={institution.website} variant="outline" size="sm">
                      {t("Website")}
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                    </LinkButton>
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}

        {/* Questions to ask any institute — phrased as questions, never claims */}
        <Card className="border-brand-light/40 bg-brand-mist/40">
          <SectionHeading
            title="Questions to ask any institute before you join"
            description="Take these to the admission office or a current student. The answers matter more than any brochure."
          />
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink">
            {[
              "Is this institute and this specific course recognised or accredited, and by whom — can I check that body's own list?",
              "What is the total fee for the whole course, and what extra costs (forms, labs, exams, materials) are not in the headline number?",
              "What is available for hostel and daily travel, and what does each actually cost per month?",
              "Who teaches the course, and what are their qualifications and how long have they taught here?",
              "Where do past students of this exact course actually work or study now — can I speak to a few of them directly?",
            ].map((question, index) => (
              <li key={index} className="flex items-start gap-2">
                <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-brand-dark" aria-hidden />
                <span>{t(question)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </Screen>
  );
}
