"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { ArrowRight, Building2, Users } from "lucide-react";
import { Screen } from "@/components/layout/app-shell";
import { AnalyticsPanel } from "@/components/portal/analytics-panel";
import { BrandingForm } from "@/components/portal/branding-form";
import { InvitePanel } from "@/components/portal/invite-panel";
import { MemberView } from "@/components/portal/member-view";
import { NotesPanel } from "@/components/portal/notes-panel";
import { PortalSummaryPanel } from "@/components/portal/portal-summary";
import { RosterPanel } from "@/components/portal/roster-panel";
import { TierList } from "@/components/portal/tier-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, ErrorState, LoadingPanel } from "@/components/ui/feedback";
import { Input } from "@/components/ui/field";
import { Tabs, tabpanelProps } from "@/components/ui/tabs";
import { api, ApiError } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { ROLE_WORDS, STAFF_ROLES, canManage } from "@/lib/portal";
import { useResource } from "@/lib/use-resource";
import type { MemberRow, MyMembership, OrgKind } from "@/lib/types";

/**
 * The two portal dashboards, from one screen.
 *
 * What differs between a school and a practice is what its staff may do, not how the code
 * is written, and the server has already decided both: a roster, a client list, a note and
 * a chart are `require_staff` reads, while an invitation, a name and a look are
 * `require_admin` ones. This screen asks which of those the caller holds and draws the tabs
 * that follow, so a counsellor employed by a school sees the school's roster and cannot
 * paint it a different colour.
 */
export function SchoolPortalScreen({ slug }: { slug: string | null }) {
  return <PortalScreen slug={slug} surface="school" />;
}

export function CounsellorPortalScreen({ slug }: { slug: string | null }) {
  return <PortalScreen slug={slug} surface="counsellor" />;
}

function PortalScreen({ slug, surface }: { slug: string | null; surface: OrgKind }) {
  const t = useT();
  const router = useRouter();
  const loadMine = useCallback(() => api.orgMine(), []);
  const mine = useResource(loadMine);
  const [tab, setTab] = useState("overview");

  const portals = (mine.data ?? []).filter((row) => row.kind === surface);
  const membership = portals.find((row) => row.slug === slug) ?? null;

  if (mine.state === "loading" && !mine.data) return <LoadingPanel label="Loading your portals" />;

  if (mine.state === "error" && !mine.data) {
    return (
      <Screen title={surface === "school" ? "School portal" : "Counsellor practice"}>
        <ErrorState description={mine.error} onRetry={mine.reload} retryLabel="Try again" />
      </Screen>
    );
  }

  if (!slug || !membership) {
    return (
      <Screen
        title={surface === "school" ? "School portal" : "Counsellor practice"}
        description={
          surface === "school"
            ? "The portals this account has joined. A roster, a chart and an invitation list belong to the school that holds them, and appear only to its staff."
            : "Your own practice, and any practice you have joined as a counsellor."
        }
        action={
          surface === "counsellor" ? (
            <CreatePractice
              onCreated={(next) => {
                // The new practice is not in the list this screen already holds, so the
                // list is re-read before the screen moves to it.
                mine.reload();
                router.push(`/counsellor/dashboard?portal=${next}`);
              }}
            />
          ) : undefined
        }
      >
        {portals.length === 0 ? (
          <EmptyState
            icon={Building2}
            title={surface === "school" ? "No school portal yet" : "No practice yet"}
            description={
              surface === "school"
                ? "A school's portal is opened by the platform, not by a person inside it — an institution's credibility is not something one request can declare. When your school has one, the letter it sends carries a link that brings you here."
                : "Start one below. It holds places for your own clients, and nothing about any other practice."
            }
            action={
              surface === "school" ? (
                <Link href="/join">
                  <Button variant="outline">
                    {t("Open an invitation link")}
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Button>
                </Link>
              ) : undefined
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {portals.map((row) => (
              <Link key={row.slug} href={`/${surface}/dashboard?portal=${row.slug}`} className="cg-card block p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{row.portal_title || row.name}</p>
                    <p className="mt-1 text-xs text-muted">
                      {ROLE_WORDS[row.org_role]} · {row.slug}
                    </p>
                  </div>
                  <Badge tone="brand">{ROLE_WORDS[row.org_role]}</Badge>
                </div>
              </Link>
            ))}
          </div>
        )}

        {slug && !membership ? (
          <p className="mt-4 text-sm text-danger" role="alert">
            {t("This account has not joined that portal. Nobody becomes a member of a school from a URL.")}
          </p>
        ) : null}
      </Screen>
    );
  }

  return (
    <PortalWorkspace
      membership={membership}
      surface={surface}
      tab={tab}
      onTab={setTab}
      onLeft={() => {
        mine.reload();
        router.push(`/${surface}/dashboard`);
      }}
    />
  );
}

function PortalWorkspace({
  membership,
  surface,
  tab,
  onTab,
  onLeft,
}: {
  membership: MyMembership;
  surface: OrgKind;
  tab: string;
  onTab: (next: string) => void;
  onLeft: () => void;
}) {
  const slug = membership.slug;
  const staff = STAFF_ROLES.includes(membership.org_role);
  const manager = canManage(membership.kind, membership.org_role);

  const loadSummary = useCallback(() => api.orgRead(slug), [slug]);
  const summary = useResource(loadSummary);

  const loadMembers = useCallback(() => api.orgMembers(slug), [slug]);
  const members = useResource(loadMembers, staff);

  const loadClients = useCallback(() => api.orgClients(slug), [slug]);
  const clients = useResource(loadClients, staff && surface === "counsellor");

  const items = staff
    ? [
        { value: "overview", label: "Overview" },
        { value: "roster", label: "Roster", count: members.data?.length },
        ...(surface === "counsellor"
          ? [
              { value: "clients", label: "Clients", count: clients.data?.length },
              { value: "notes", label: "Session notes" },
            ]
          : []),
        ...(manager ? [{ value: "look", label: "Look" }] : []),
        { value: "places", label: "Places" },
      ]
    : [{ value: "me", label: "My place" }];

  const active = items.some((item) => item.value === tab) ? tab : items[0].value;

  return (
    <Screen
      title={membership.portal_title || membership.name}
      description={
        staff
          ? manager
            ? "You run this portal. What you can change is its look, its roster and its places — never what a child's report says."
            : "You work inside this portal. You can see the clients who are yours and write their notes; its name, colour and roster belong to its administrator."
          : "You joined this portal. Nothing on it is visible to its staff unless you say so."
      }
      badge={<Badge tone="brand">{ROLE_WORDS[membership.org_role]}</Badge>}
    >
      <div className="space-y-5">
        {staff ? (
          <Tabs
            items={items}
            value={active}
            onChange={onTab}
            idBase="portal-sections"
            label="Portal sections"
          />
        ) : null}

        {!staff ? (
          <MemberView key={`${slug}-${membership.share_results}`} slug={slug} membership={membership} onLeft={onLeft} />
        ) : (
          <div className="space-y-5" {...tabpanelProps("portal-sections", active)}>
            {summary.state === "error" && !summary.data ? (
              <ErrorState description={summary.error} onRetry={summary.reload} />
            ) : null}
            {summary.data ? <PortalSummaryPanel summary={summary.data} /> : null}

            {active === "overview" ? <AnalyticsPanel slug={slug} /> : null}

            {active === "roster" ? (
              <div className="space-y-4">
                {manager ? (
                  <InvitePanel
                    slug={slug}
                    seatsLeft={summary.data?.seats_left ?? 0}
                    canInviteStaff={manager}
                    onDone={() => {
                      members.reload();
                      summary.reload();
                    }}
                  />
                ) : null}
                {members.state === "loading" && !members.data ? <LoadingPanel label="Loading the roster" /> : null}
                {members.state === "error" && !members.data ? (
                  <ErrorState description={members.error} onRetry={members.reload} />
                ) : null}
                {members.data ? (
                  <RosterPanel
                    slug={slug}
                    members={members.data}
                    canManage={manager}
                    onChanged={() => {
                      members.reload();
                      summary.reload();
                    }}
                  />
                ) : null}
              </div>
            ) : null}

            {active === "clients" ? (
              clients.state === "loading" && !clients.data ? (
                <LoadingPanel label="Loading your clients" />
              ) : clients.state === "error" && !clients.data ? (
                <ErrorState description={clients.error} onRetry={clients.reload} />
              ) : (
                <ClientList clients={clients.data ?? []} />
              )
            ) : null}

            {active === "notes" ? (
              clients.data ? (
                <NotesPanel slug={slug} clients={clients.data} />
              ) : clients.state === "error" ? (
                <ErrorState description={clients.error} onRetry={clients.reload} />
              ) : (
                <LoadingPanel label="Loading your clients" />
              )
            ) : null}

            {active === "look" && manager ? <BrandingForm slug={slug} /> : null}
            {active === "places" ? (
              <TierList kind={surface} currentCode={summary.data?.organization.tier_code ?? ""} />
            ) : null}
          </div>
        )}
      </div>
    </Screen>
  );
}

/** The list a note is written against. Joined people only — the server already cut the rest. */
function ClientList({ clients }: { clients: MemberRow[] }) {
  const t = useT();
  if (clients.length === 0) {
    return (
      <Card className="py-8 text-center text-sm text-muted">
        {t("Nobody has joined this practice yet, or nobody who is yours to see.")}
      </Card>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {clients.map((client) => (
        <Card key={client.id} className="space-y-2 p-4">
          <p className="text-sm font-semibold text-ink">{client.display_label || t("A member with no label")}</p>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="brand">{ROLE_WORDS[client.org_role]}</Badge>
            <Badge tone={client.share_results ? "success" : "neutral"}>
              {client.share_results ? t("Shares results") : t("Private")}
            </Badge>
            {client.assigned_counsellor_label ? (
              <Badge tone="teal">
                {t("With")} {client.assigned_counsellor_label}
              </Badge>
            ) : null}
          </div>
          {client.joined_at ? (
            <p className="text-xs text-muted">
              {t("Joined")} {new Date(client.joined_at).toLocaleDateString()}
            </p>
          ) : null}
        </Card>
      ))}
    </div>
  );
}

/**
 * Starting a practice. There is no equivalent for a school on purpose: the create route
 * takes no `kind`, so a person can declare a practice and cannot declare an institution.
 */
function CreatePractice({ onCreated }: { onCreated: (slug: string) => void }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const org = await api.orgCreate({ name: name.trim() });
      setOpen(false);
      setName("");
      onCreated(org.slug);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t("Something went wrong."));
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <Users className="h-4 w-4" aria-hidden />
        {t("Start a practice")}
      </Button>
    );
  }

  return (
    <Card className="w-full max-w-md space-y-3">
      <Input
        label={t("Practice name")}
        value={name}
        maxLength={120}
        onChange={(event) => setName(event.target.value)}
        hint={t("An address for it is made from the name and shown after it is created.")}
      />
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <div className="flex items-center gap-2">
        <Button onClick={() => void create()} loading={busy} disabled={name.trim().length < 2}>
          {t("Create")}
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          {t("Cancel")}
        </Button>
      </div>
    </Card>
  );
}
