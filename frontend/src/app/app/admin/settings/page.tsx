"use client";

import { useCallback, useState } from "react";
import { ScrollText, ServerCog } from "lucide-react";

import { Screen } from "@/components/layout/app-shell";
import { Caption, KeyValue, Pager, Yes, dateTime } from "@/components/admin/operator-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/field";
import { EmptyState, ErrorState, LoadingPanel } from "@/components/ui/feedback";
import { api } from "@/lib/api";
import { useResource } from "@/lib/use-resource";
import { useT, useTf } from "@/lib/i18n";
import type { AdminDeployment, AuditEventRow } from "@/lib/types";

/**
 * `/app/admin/settings` — what this deployment is running on, and what has been changed
 * from a screen like this one.
 *
 * **Nothing in the first panel is a form.** The values come from the environment of the
 * process answering the request, so a "Save" button here would either write to a file the
 * hosting platform owns or pretend to have changed something it did not. Each row names
 * what it means, and the two switches that should never be left on by accident
 * (`TENANT_TRUST_FORWARDED_HOST`, `RATE_LIMIT_TRUST_FORWARDED_FOR`) are called out when
 * they are. A key is never printed, not even truncated: the endpoint sends a boolean for
 * each one, and the last four characters of a secret are still a way to recognise it.
 *
 * **The log has no delete and no clear.** That is the design, not a missing feature: the
 * person who would want an action removed from the log is the person holding the keys to
 * remove it. A mistake is corrected by doing the opposite action, which appears here too.
 * A row carries the action, the subject, the field that moved and the resulting state —
 * never a value that was typed, never a conversation, never an address or a device.
 */

const PAGE = 50;

function flagLabel(on: boolean, yes: string, no: string): string {
  return on ? yes : no;
}

// ------------------------------------------------------------------ the deployment

function DeploymentPanel({ config }: { config: AdminDeployment }) {
  const t = useT();
  const tf = useTf();
  return (
    <div className="space-y-4">
      <Card>
        <p className="flex items-center gap-2 text-sm font-semibold text-ink">
          <ServerCog className="h-4 w-4 text-muted" aria-hidden />
          {t("Answers and speech")}
        </p>
        <dl className="mt-2">
          <KeyValue
            label="AI provider"
            value={`${config.ai_provider} · ${config.ai_model}`}
            note={
              config.ai_configured
                ? "A configured provider is answering, so replies come from the model named above."
                : "Nothing is configured, so the canned demo script is answering. Its replies are counted separately on the overview and are never presented as a model's work."
            }
          />
          <KeyValue label="Gemini key present" value={<Yes on={config.has_gemini_key} />} />
          <KeyValue label="Speech (text to voice)" value={config.tts_provider} />
          <KeyValue
            label="Azure key present"
            value={<Yes on={config.has_azure_key} />}
            note={
              config.azure_speech_region
                ? tf("Region {region}. Gemini's spoken model is {model}.", {
                    region: config.azure_speech_region,
                    model: config.gemini_tts_model,
                  })
                : tf("Gemini's spoken model is {model}.", { model: config.gemini_tts_model })
            }
          />
        </dl>
        <Caption>
          {t(
            "Neither speech provider is a guaranteed offline path, and the browser falls back to its own voice when the server has no key. Which one spoke is stated on the screen that uses it, not here.",
          )}
        </Caption>
      </Card>

      <Card>
        <p className="text-sm font-semibold text-ink">{t("Mail")}</p>
        <dl className="mt-2">
          <KeyValue label="Resend key present" value={<Yes on={config.has_resend_key} />} />
          <KeyValue
            label="Sending allowed"
            value={<Yes on={config.email_enabled} />}
            note={
              config.email_enabled
                ? "Messages leave this deployment when their route runs."
                : "Mail is switched off. Addresses can still be attached and confirmed, and the outbox keeps the rows a later run would send."
            }
          />
          <KeyValue label="From address" value={config.from_email ?? "not set"} />
          <KeyValue
            label="Enquiries are announced to"
            value={config.lead_notify_email ?? "not set"}
            note="Not a secret, and you need it to know where a family's enquiry actually went."
          />
        </dl>
      </Card>

      <Card>
        <p className="text-sm font-semibold text-ink">{t("Payments")}</p>
        <dl className="mt-2">
          <KeyValue
            label="Razorpay keys present"
            value={<Yes on={config.razorpay_configured} />}
            note={
              config.razorpay_configured
                ? "An order can be created."
                : "No key, so checkout is switched off. The pricing page still shows the plans, and the billing page reports the free plan."
            }
          />
          <KeyValue
            label="Webhook verifiable"
            value={<Yes on={config.webhook_verifiable} />}
            note="Without the signing secret a callback cannot be trusted, so a payment would have to be confirmed by hand."
          />
          <KeyValue
            label="Sandbox or live"
            value={
              config.razorpay_test_mode
                ? "Test keys — no money moves"
                : flagLabel(config.razorpay_configured, "Live keys", "Neither")
            }
            note="The overview counts a test payment apart from revenue for exactly this reason."
          />
        </dl>
      </Card>

      <Card>
        <p className="text-sm font-semibold text-ink">{t("Sign-in and identity")}</p>
        <dl className="mt-2">
          <KeyValue label="Clerk key present" value={<Yes on={config.has_clerk_key} />} />
          <KeyValue label="Clerk webhook secret present" value={<Yes on={config.has_clerk_webhook_secret} />} />
        </dl>
        <Caption>
          {t(
            "Clerk is optional. Without it a device is the account, and the come-back code is the way back onto it — which is why the code is stretched through 210,000 PBKDF2 rounds rather than relying on the throttle below.",
          )}
        </Caption>
      </Card>

      <Card>
        <p className="text-sm font-semibold text-ink">{t("Hosting and tenants")}</p>
        <dl className="mt-2">
          <KeyValue label="Database engine" value={config.database_engine} />
          <KeyValue
            label="Tables created on boot"
            value={<Yes on={config.db_auto_setup} />}
            note={
              config.db_auto_setup
                ? "A fresh database builds itself. Migrations remain the way a schema changes after that."
                : "Only migrations touch the schema."
            }
          />
          <KeyValue label="Portal base domain" value={config.tenant_base_domain} />
          <KeyValue label="Site address" value={config.public_site_url} />
          <KeyValue label="Allowed browser origins" value={config.cors_origins.join(", ") || "none"} />
          <KeyValue
            label="Trust X-Forwarded-Host"
            value={<Yes on={config.tenant_trust_forwarded_host} />}
            note={
              config.tenant_trust_forwarded_host
                ? "ON — only correct behind a proxy that overwrites this header. Left on in front of the open internet it lets a caller choose which portal they are reading."
                : "off, which is the safe default: the socket's own address decides."
            }
          />
          <KeyValue
            label="Trust X-Forwarded-For"
            value={<Yes on={config.rate_limit_trust_forwarded_for} />}
            note={
              config.rate_limit_trust_forwarded_for
                ? "ON — only correct behind a proxy that overwrites this header, or a caller can pick which throttle bucket they land in."
                : "off, which is the safe default."
            }
          />
        </dl>
      </Card>

      <Card>
        <p className="text-sm font-semibold text-ink">{t("Limits a student meets")}</p>
        <dl className="mt-2">
          <KeyValue
            label="Plan limits enforced"
            value={<Yes on={config.plan_limits_enforced} />}
            note="The server counts these itself; a client cannot talk its way past them."
          />
          <KeyValue label="Free chats a day" value={config.free_daily_chats} />
          <KeyValue label="Free sittings in total" value={config.free_assessment_total} />
          <KeyValue
            label="Day rolls at"
            value={tf("{hours} hours from UTC", {
              hours: config.quota_utc_offset_minutes / 60,
            })}
            note="Set so a 'day' for a family in India ends at midnight there, not in a server's timezone."
          />
        </dl>
      </Card>

      <Card>
        <p className="text-sm font-semibold text-ink">{t("Throttles")}</p>
        <dl className="mt-2">
          <KeyValue label="Throttling on" value={<Yes on={config.rate_limit_enabled} />} />
          <KeyValue
            label="Reads, per session"
            value={config.rate_limit_read}
            note={
              "Every GET that has no rule of its own. The catalogue a public page reads is " +
              "exempt, so this is the ceiling on a session paging through a database — not on " +
              "a class opening the same page at once."
            }
          />
          <KeyValue label="Operator writes" value={config.rate_limit_admin} />
          <KeyValue label="Public enquiries" value={config.rate_limit_lead} />
          <KeyValue label="Portal changes" value={config.rate_limit_org} />
          <KeyValue
            label="Where the counters live"
            value={config.rate_limit_shared_storage ? "In Redis, shared by every worker" : "In this process"}
            note={
              config.rate_limit_shared_storage
                ? "Four workers and four hundred calls a minute mean one shared allowance."
                : "One worker, honest limits. Two workers counting separately is a site whose real ceiling is double what these lines say — set RATE_LIMIT_REDIS_URL if this API is ever scaled past one process."
            }
          />
        </dl>
        <Caption>
          {t(
            "The counters live in this process’s memory. One instance means honest limits; a hosted deployment that runs several has a ceiling of the rule times however many are warm, which is a brake rather than a wall.",
          )}
        </Caption>
      </Card>

      <Card className="border-warning/40 bg-warning-mist/40">
        <p className="text-sm font-semibold text-ink">{t("Why there is no Save button on this page")}</p>
        <p className="mt-2 text-xs leading-relaxed text-ink">
          {t("These values are read from the environment of the process that served this request. The way to change one is to set the variable where the app runs and start that process again — on your own machine the file is")}{" "}
          <span className="font-mono">backend/.env</span>
          {t(", on Vercel it is the project’s environment settings. The one thing on this page that a request can change is who holds the operator flag, and that happens in")}{" "}
          <span className="font-mono">scripts/admin_grant.py</span> {t("or from the accounts list, both of which write to the log below.")}
        </p>
      </Card>
    </div>
  );
}

// ------------------------------------------------------------------------- the log

function AuditRow({ event }: { event: AuditEventRow }) {
  const t = useT();
  return (
    <li className="grid grid-cols-1 gap-1 border-b border-line/60 py-2.5 text-sm last:border-b-0 sm:grid-cols-[9.5rem_minmax(0,1fr)]">
      <span className="text-xs text-muted tabular-nums">{dateTime(event.created_at)}</span>
      <span className="min-w-0">
        <span className="font-mono text-xs text-ink">{event.action}</span>
        {event.subject_type ? (
          <span className="ml-2 text-xs text-muted">
            {event.subject_type} <span className="font-mono">{event.subject_id}</span>
          </span>
        ) : null}
        <span className="mt-0.5 block text-xs leading-relaxed text-muted">
          {event.detail ?? t("no detail")} · {t("by")}{" "}
          {event.actor_name
            ? `${event.actor_name}${event.actor_user_id ? ` (#${event.actor_user_id})` : ""}`
            : t("the shell")}
          {event.origin === "script" ? ` · ${t("from a shell, not a page")}` : ""}
        </span>
      </span>
    </li>
  );
}

function AuditPanel() {
  const t = useT();
  const tf = useTf();
  const [action, setAction] = useState("");
  const [actor, setActor] = useState("");
  const [since, setSince] = useState("");
  const [offset, setOffset] = useState(0);

  const load = useCallback(
    () =>
      api.adminAudit({
        action: action || undefined,
        actor: actor.trim() ? Number(actor.trim()) : undefined,
        since: since ? `${since}T00:00:00` : undefined,
        limit: PAGE,
        offset,
      }),
    [action, actor, since, offset],
  );
  const page = useResource(load);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Select
          label="Action"
          options={[{ value: "", label: "Every action" }, ...(page.data?.actions ?? []).map((name) => ({ value: name, label: name }))]}
          value={action}
          onChange={(event) => {
            setAction(event.target.value);
            setOffset(0);
          }}
          hint="Built from what has actually happened, not from a fixed list."
        />
        <Input
          label="By account id"
          value={actor}
          onChange={(event) => setActor(event.target.value)}
          inputMode="numeric"
          maxLength={8}
          placeholder="for example 12"
        />
        <Input
          label="Since"
          type="date"
          value={since}
          onChange={(event) => {
            setSince(event.target.value);
            setOffset(0);
          }}
        />
        <div className="flex items-end gap-2">
          <Button variant="outline" size="sm" onClick={page.reload}>
            {t("Reload")}
          </Button>
          {action || actor || since ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setAction("");
                setActor("");
                setSince("");
                setOffset(0);
              }}
            >
              {t("Clear")}
            </Button>
          ) : null}
        </div>
      </div>

      {page.state === "loading" && !page.data ? <LoadingPanel label="Reading the log" /> : null}
      {page.state === "error" && !page.data ? (
        <ErrorState description={page.error} onRetry={page.reload} title="The log would not load" />
      ) : null}

      {page.data ? (
        page.data.items.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title="Nothing recorded with this filter"
            description="An empty log with no filter at all means nobody has changed anything from a screen or a shell since this table was created."
          />
        ) : (
          <Card>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">
              {tf("{count} events, newest first", { count: page.data.total.toLocaleString("en-IN") })}
            </p>
            <ul className="divide-y-0">
              {page.data.items.map((event) => (
                <AuditRow key={event.id} event={event} />
              ))}
            </ul>
          </Card>
        )
      ) : null}

      {page.data ? (
        <Pager
          total={page.data.total}
          limit={page.data.limit}
          offset={page.data.offset}
          onMove={setOffset}
          unit="events"
        />
      ) : null}

      <Caption>
        {t(
          "What is not in a row: the value a field moved to beyond a resulting true or false, the text of a career entry, the content of a conversation, an IP address, a user agent, or a device string. Reading the log is not logged — an operator looking at the record of the last six months is not an action anybody needs to explain later.",
        )}
      </Caption>
    </div>
  );
}

// --------------------------------------------------------------------- the screen

export default function AdminSettingsScreen() {
  const t = useT();
  const config = useResource(useCallback(() => api.adminDeployment(), []));

  return (
    <Screen
      title="Deployment and log"
      description="What this installation is running on, and every change an operator has made since the log began. Neither panel is a form."
      badge={<Badge tone="brand">{t("Admin")}</Badge>}
      action={
        <Button variant="outline" size="sm" onClick={config.reload} loading={config.state === "loading"}>
          {t("Reload")}
        </Button>
      }
    >
      <div className="space-y-6">
        {config.state === "loading" && !config.data ? <LoadingPanel label="Asking the process what it is running on" /> : null}
        {config.state === "error" && !config.data ? (
          <ErrorState
            title="The deployment would not describe itself"
            description={config.error}
            onRetry={config.reload}
          />
        ) : null}
        {config.data ? <DeploymentPanel config={config.data} /> : null}

        <section aria-labelledby="log-section">
          <h2 id="log-section" className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted">
            {t("Operator log")}
          </h2>
          <p className="mb-3 max-w-2xl text-xs leading-relaxed text-muted">
            {t("One row per change made from these screens or from")}{" "}
            <span className="font-mono">scripts/admin_grant.py</span>
            {t(": who did it, to what, and when. It is append-only, and there is no control on this page that clears it.")}
          </p>
          <AuditPanel />
        </section>
      </div>
    </Screen>
  );
}
