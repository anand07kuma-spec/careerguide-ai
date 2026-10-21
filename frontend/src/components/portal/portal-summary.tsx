"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { ProgressBar, Stat } from "@/components/ui/feedback";
import { KIND_WORDS, portalHost } from "@/lib/portal";
import type { PortalSummary } from "@/lib/types";

/**
 * A portal's own header: what it is called, how many places it holds and how many it has
 * used. `seats_used` counts a waiting invitation as used, because the seat is gone from
 * the moment the address is typed, and the screen says so rather than letting a head
 * teacher discover it when the next invite is refused.
 */
export function PortalSummaryPanel({ summary }: { summary: PortalSummary }) {
  const org = summary.organization;
  const host = portalHost(org.slug);

  return (
    <Card className="space-y-5">
      <CardHeader
        title={org.name}
        description={
          <>
            {KIND_WORDS[org.kind]} · {org.slug}
            {host ? ` · ${host}` : ""}
            {!org.is_active ? " · closed by the platform" : ""}
          </>
        }
        action={
          org.verified ? (
            <Badge tone="success">Verified by the platform</Badge>
          ) : (
            <Badge tone="neutral">Not verified</Badge>
          )
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Joined" value={summary.joined} hint="Accounts that opened a link" />
        <Stat label="Waiting" value={summary.invited} tone="teal" hint="Invites not yet accepted" />
        <Stat label="Adults on staff" value={summary.staff} tone="brand" hint="Counsellors and administrators" />
        <Stat
          label="Places left"
          value={summary.seats_left}
          tone={summary.seats_left === 0 ? "warning" : "success"}
          hint={`${summary.seats} in this tier`}
        />
      </div>

      <ProgressBar value={summary.seats_used} total={summary.seats} label="Seats used" />

      {!host ? (
        <p className="text-xs leading-relaxed text-muted">
          This deployment has no portal subdomains configured, so the portal is reached at{" "}
          {/* The kind decides the path because a counsellor reading this about their own
              practice does not want to be sent to a school's screen. */}
          <code className="rounded bg-canvas px-1 py-0.5 text-[11px]">
            /{org.kind}/dashboard?portal={org.slug}
          </code>{" "}
          and the address above is its name rather than a hostname.
        </p>
      ) : null}
    </Card>
  );
}
