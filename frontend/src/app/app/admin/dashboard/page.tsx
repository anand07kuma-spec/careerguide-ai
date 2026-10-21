"use client";

import { useCallback } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";

import { Screen } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, ErrorState, LoadingPanel, Stat } from "@/components/ui/feedback";
import { BucketList, Caption, dateTime, rupees } from "@/components/admin/operator-ui";
import { api } from "@/lib/api";
import { useT, useTf } from "@/lib/i18n";
import { useResource } from "@/lib/use-resource";

/**
 * The operator's overview: `/app/admin/dashboard`.
 *
 * Six panels, and every number in them is a count or a sum over rows this deployment
 * already has. Three decisions that shape what is *not* on this page:
 *
 * * **No growth percentages and no trend lines.** A percentage over a seven-day window on
 *   a deployment with forty students is a number with no meaning attached to it, and it
 *   looks exactly like a prediction. The raw counts and the same figure over the last week
 *   are here instead, so the reader does the comparing.
 * * **Demo replies are counted separately from real ones.** `AI_PROVIDER=demo` writes
 *   scripted answers, and a conversation total that quietly included them would present a
 *   script as AI work. The product's standing rule is that this never happens.
 * * **Test-mode payments are not revenue.** `test_paise` is its own figure because no bank
 *   has ever heard of it. The two are not added together anywhere on this screen.
 *
 * Nothing here reaches inside a conversation. There is no endpoint in `/api/admin` that
 * returns a transcript, an answer value, a device id or a come-back code, so the busiest
 * card on this page is still only a count.
 */

export default function AdminDashboardScreen() {
  const t = useT();
  const tf = useTf();
  const load = useCallback(() => api.adminSummary(), []);
  const summary = useResource(load);

  const recount = (
    <Button variant="outline" size="sm" onClick={summary.reload} loading={summary.state === "loading"}>
      <RefreshCw className="h-4 w-4" aria-hidden />
      {t("Recount")}
    </Button>
  );

  if (summary.state === "loading" && !summary.data) {
    return (
      <Screen title="Overview" badge={<Badge tone="brand">{t("Admin")}</Badge>}>
        <LoadingPanel label="Counting the deployment" />
      </Screen>
    );
  }

  if (summary.state === "error" && !summary.data) {
    return (
      <Screen title="Overview" badge={<Badge tone="brand">{t("Admin")}</Badge>} action={recount}>
        <ErrorState description={summary.error} onRetry={summary.reload} />
      </Screen>
    );
  }

  const s = summary.data;
  if (!s) {
    return (
      <Screen title="Overview" badge={<Badge tone="brand">{t("Admin")}</Badge>} action={recount}>
        <EmptyState title="Nothing to count" description="The server answered with an empty summary." />
      </Screen>
    );
  }

  return (
    <Screen
      title="Overview"
      description={
        <>
          {tf("Every figure is a count or a sum over the rows this deployment holds, taken at {at}.", {
            at: dateTime(s.generated_at),
          })}{" "}
          {t("Nothing is estimated, extrapolated or projected, and there is no percentage growth on this page.")}
        </>
      }
      badge={<Badge tone="brand">{t("Admin")}</Badge>}
      action={recount}
    >
      <div className="space-y-8">
        <section aria-labelledby="accounts-section">
          <h2 id="accounts-section" className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
            {t("Accounts")}
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Stat
              label="Open accounts"
              value={s.users.total - s.users.closed}
              hint={tf("{n} ever created", { n: s.users.total })}
            />
            <Stat label="Students" value={s.users.students} />
            <Stat label="Parents" value={s.users.parents} />
            <Stat
              label="Closed"
              value={s.users.closed}
              tone="warning"
              hint={t("Data untouched; reopening returns to it")}
            />
            <Stat label="New this week" value={s.users.new_7d} hint={tf("{n} in 30 days", { n: s.users.new_30d })} />
            <Stat
              label="Operators"
              value={s.users.operators}
              tone="success"
              hint={t("Set by scripts/admin_grant.py")}
            />
          </div>
        </section>

        <section aria-labelledby="chats-section">
          <h2 id="chats-section" className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
            {t("Conversations")}
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Sessions" value={s.chats.sessions} hint={tf("{n} this week", { n: s.chats.sessions_7d })} />
            <Stat label="Messages" value={s.chats.messages} hint={tf("{n} this week", { n: s.chats.messages_7d })} />
            <Stat label="Typed" value={s.chats.chat_sessions} />
            <Stat label="Spoken" value={s.chats.voice_sessions} />
            <Stat
              label="Replies from a model"
              value={s.chats.real_replies}
              tone="success"
              hint={t("A configured provider answered these")}
            />
            <Stat
              label="Demo replies"
              value={s.chats.demo_replies}
              tone="warning"
              hint={t("Written by the canned script, not a model")}
            />
          </div>
          <Caption>
            {tf(
              "Typed and spoken sessions add up to the total ({chat} + {voice} = {sessions}), and the two reply counts do the same for messages written by the guide.",
              { chat: s.chats.chat_sessions, voice: s.chats.voice_sessions, sessions: s.chats.sessions },
            )}{" "}
            {tf("A deployment running {env} produces only demo replies, and this panel is where that becomes visible.", {
              env: "AI_PROVIDER=demo",
            })}
          </Caption>
        </section>

        <section aria-labelledby="assess-section">
          <h2 id="assess-section" className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
            {t("Assessments")}
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Started" value={s.assessments.started} />
            <Stat
              label="Completed"
              value={s.assessments.completed}
              hint={tf("{n} this week", { n: s.assessments.completed_7d })}
            />
            <Stat label="Still open" value={s.assessments.in_progress} tone="warning" />
            <Stat label="Results" value={s.assessments.results} />
            <Stat label="Printed reports" value={s.assessments.pdf_reports} tone="teal" />
          </div>
          <Card className="mt-3">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted">{t("By questionnaire")}</p>
            <BucketList
              buckets={s.assessments.by_type}
              total={s.assessments.started}
              emptyLabel="No sittings have been started yet, so there is nothing to break down."
            />
          </Card>
        </section>

        <section aria-labelledby="revenue-section">
          <h2 id="revenue-section" className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
            {t("Money")}
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Stat
              label="Captured"
              value={rupees(s.revenue.captured_paise)}
              tone="success"
              hint={tf("{n} orders", { n: s.revenue.captured_orders })}
            />
            <Stat label="Captured, 30 days" value={rupees(s.revenue.captured_paise_30d)} />
            <Stat
              label="Test-mode"
              value={rupees(s.revenue.test_paise)}
              tone="warning"
              hint={tf("{n} orders — moved no money, never added above", { n: s.revenue.test_orders })}
            />
            <Stat label="Refunded" value={rupees(s.revenue.refunded_paise)} tone="warning" />
            <Stat label="Failed orders" value={s.revenue.failed_orders} />
            <Stat
              label="Accounts on a plan"
              value={s.revenue.paying_accounts + s.revenue.granted_accounts}
              hint={tf("{paying} paid, {granted} granted", {
                paying: s.revenue.paying_accounts,
                granted: s.revenue.granted_accounts,
              })}
            />
          </div>
          <Card className="mt-3">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted">
              {t("Open subscriptions by plan")}
            </p>
            <BucketList
              buckets={s.revenue.by_plan}
              total={s.revenue.paying_accounts + s.revenue.granted_accounts}
              emptyLabel="Nobody is on a paid or granted plan right now."
            />
            <Caption>
              {tf(
                "A granted subscription is one somebody was written in by hand, and it is counted apart from the {paying} that came through a payment.",
                { paying: s.revenue.paying_accounts },
              )}{" "}
              {t(
                "Money never decides what a child is recommended; the catalogue and the scoring are the same on every plan.",
              )}
            </Caption>
          </Card>
        </section>

        <section aria-labelledby="portals-section">
          <h2 id="portals-section" className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
            {t("School and counsellor portals")}
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Stat
              label="Portals"
              value={s.portals.organizations}
              hint={tf("{schools} schools, {practices} practices", {
                schools: s.portals.schools,
                practices: s.portals.practices,
              })}
            />
            <Stat label="Members joined" value={s.portals.members_active} />
            <Stat label="Invited, not joined" value={s.portals.members_invited} tone="warning" />
            <Stat label="Notes shared with a family" value={s.portals.notes_shared} tone="teal" />
          </div>
        </section>

        <section aria-labelledby="waiting-section">
          <h2 id="waiting-section" className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
            {t("Waiting on somebody")}
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Stat
              label="Careers to verify"
              value={s.content.careers_to_verify}
              tone="warning"
              hint={tf("{n} in the catalogue", { n: s.content.careers })}
              footer={
                <Link href="/app/admin/content" className="mt-2 inline-block text-xs text-brand underline-offset-2 hover:underline">
                  {t("Open the catalogue")}
                </Link>
              }
            />
            <Stat
              label="Open enquiries"
              value={s.content.leads_open}
              tone="warning"
              hint={tf("{n} altogether", { n: s.content.leads_total })}
              footer={
                <Link href="/app/admin/leads" className="mt-2 inline-block text-xs text-brand underline-offset-2 hover:underline">
                  {t("Open the queue")}
                </Link>
              }
            />
            <Stat label="Email waiting" value={s.content.email_queued} hint={t("Drained by scripts/email_worker.py")} />
            <Stat label="Email failed" value={s.content.email_failed} tone="warning" />
            <Stat
              label="Questions in the bank"
              value={s.content.questions}
              hint={t("Seeded from data/assessment_questions.json")}
            />
          </div>
          <Caption>
            {tf(
              "{flagged} of {total} career entries carry the flag the seed set, which means nobody has read a real source beside them.",
              { flagged: s.content.careers_to_verify, total: s.content.careers },
            )}{" "}
            {t(
              "The way to clear it is row by row against a source, not by switching the flag off — the API refuses that in both directions.",
            )}
          </Caption>
        </section>

        <Card className="border-line">
          <p className="text-sm font-semibold text-ink">{t("What this page cannot tell you")}</p>
          <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-muted">
            <li>
              {t(
                "It cannot show a conversation, an answer, a score or a report. Those belong to the account that made them, and no route here reaches into one.",
              )}
            </li>
            <li>
              {t(
                "It cannot rank people. There is no “who talked most” and no “whose scores are highest”, because the second is a claim about a child.",
              )}
            </li>
            <li>
              {t(
                "It cannot tell you what a payment was for or who pays. Plan names and totals are here; the money itself lives on the billing page of the account that paid it.",
              )}
            </li>
          </ul>
        </Card>
      </div>
    </Screen>
  );
}
