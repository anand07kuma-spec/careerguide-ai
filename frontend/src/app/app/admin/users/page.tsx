"use client";

import { useCallback, useState } from "react";
import { ShieldCheck } from "lucide-react";

import { Screen } from "@/components/layout/app-shell";
import { Notice, Pager, day } from "@/components/admin/operator-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/field";
import { EmptyState, ErrorState, LoadingPanel } from "@/components/ui/feedback";
import { ApiError, api } from "@/lib/api";
import { useT, useTf } from "@/lib/i18n";
import { useResource } from "@/lib/use-resource";
import type { AdminUserRow } from "@/lib/types";

/**
 * The accounts list: `/app/admin/users`.
 *
 * It finds accounts and changes two things about them — whether they are open, and whether
 * they hold the operator flag. That is the complete extent of it, and it is the extent of
 * what the server offers too: there is no route in `/api/admin` that reads a conversation,
 * edits a plan, resets a come-back code, deletes a person, or searches by email address.
 *
 * Three things this page says out loud rather than leaving implied:
 *
 * * **Search does not accept an email address.** Not a limitation of the form — a list you
 *   can enumerate by address is a way to test which addresses have accounts here, which is
 *   the exact question the confirmation mail exists to keep private. A label matches, and an
 *   exact id matches when the text is all digits.
 * * **Closing an account deletes nothing.** Its conversations, sittings, results and printed
 *   reports stay where they are, and reopening returns to them. Erasure is not a thing this
 *   screen can do; it happens outside it, by whoever runs the deployment.
 * * **Refusals are the server's own sentences.** Demoting yourself, closing your own
 *   account, granting the flag to a closed account and locking the last open operator out
 *   are all refused there, and the text arrives here unchanged instead of being pre-empted
 *   by a disabled button that would be wrong the moment the data changed.
 */

const PAGE = 25;

const ROLE_OPTIONS = [
  { value: "", label: "Students and parents" },
  { value: "student", label: "Students only" },
  { value: "parent", label: "Parents only" },
];

const STATE_OPTIONS = [
  { value: "", label: "Open and closed" },
  { value: "open", label: "Open only" },
  { value: "closed", label: "Closed only" },
];

const FLAG_OPTIONS = [
  { value: "", label: "All accounts" },
  { value: "operator", label: "Operators only" },
];

interface Filter {
  q: string;
  role: string;
  state: string;
  flag: string;
}

const EMPTY: Filter = { q: "", role: "", state: "", flag: "" };

// ------------------------------------------------------------------ one account

function AccountRow({
  row,
  onChanged,
}: {
  row: AdminUserRow;
  onChanged: (next: AdminUserRow) => void;
}) {
  const t = useT();
  const tf = useTf();
  const [busy, setBusy] = useState<null | "operator" | "status">(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);

  async function run(kind: "operator" | "status", work: () => Promise<AdminUserRow>, done: string) {
    setBusy(kind);
    setNotice(null);
    try {
      const updated = await work();
      onChanged(updated);
      setNotice({ tone: "ok", text: done });
    } catch (error: unknown) {
      setNotice({
        tone: "bad",
        text: error instanceof ApiError ? error.message : "The server did not answer, so nothing was changed.",
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
            {row.display_name}
            <span className="font-mono text-xs font-normal text-muted">#{row.id}</span>
            {row.is_admin ? (
              <Badge tone="brand" icon={<ShieldCheck className="h-3 w-3" aria-hidden />}>
                {t("Operator")}
              </Badge>
            ) : null}
            {!row.is_active ? <Badge tone="danger">{t("Closed")}</Badge> : null}
            <Badge tone="neutral">{row.role === "student" ? t("Student") : t("Parent")}</Badge>
          </p>
          <p className="mt-1 text-xs text-muted">
            {row.plan_expires_at
              ? tf("Joined {joined} · reads {language} · plan {plan}, until {until}", {
                  joined: day(row.created_at),
                  language: row.preferred_language,
                  plan: row.plan_code,
                  until: day(row.plan_expires_at),
                })
              : tf("Joined {joined} · reads {language} · plan {plan}", {
                  joined: day(row.created_at),
                  language: row.preferred_language,
                  plan: row.plan_code,
                })}
          </p>
          <p className="mt-1 text-xs text-muted">
            {row.contact_email
              ? tf("Address on file: {address} ({status})", {
                  address: row.contact_email,
                  status: row.email_confirmed_at
                    ? tf("confirmed {date}", { date: day(row.email_confirmed_at) })
                    : t("not confirmed"),
                })
              : t("No email address attached to this account.")}
          </p>
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink">
            <span title={t("Sessions this account has had, of any kind")}>
              <span className="font-semibold tabular-nums">{row.conversations}</span> {t("conversations")}
            </span>
            <span title={t("Sittings started and completed by this account")}>
              <span className="font-semibold tabular-nums">
                {row.assessments_completed}/{row.assessments}
              </span>{" "}
              {t("assessments completed")}
            </span>
            <span title={t("Portals this account appears on the roster of")}>
              <span className="font-semibold tabular-nums">{row.portal_memberships}</span>{" "}
              {t("portal memberships")}
            </span>
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted">
            {t("Counts only. What this account said, and what it answered, stay behind its own session.")}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <Button
            variant="outline"
            size="sm"
            loading={busy === "operator"}
            disabled={busy !== null}
            onClick={() =>
              void run(
                "operator",
                () => api.adminSetOperator(row.id, !row.is_admin),
                row.is_admin
                  ? "The operator flag was removed from this account. It is written in the log."
                  : "This account now holds the operator flag, and can open every screen in this area.",
              )
            }
          >
            {row.is_admin ? t("Remove operator access") : t("Make an operator")}
          </Button>

          {row.is_active ? (
            confirmClose ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="danger"
                  size="sm"
                  loading={busy === "status"}
                  onClick={() =>
                    void run(
                      "status",
                      () => api.adminSetAccountStatus(row.id, false),
                      "Closed. Nothing was deleted — the account's own rows are untouched, and its next request will be refused.",
                    )
                  }
                >
                  {t("Confirm close")}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmClose(false)}>
                  {t("Cancel")}
                </Button>
              </div>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setConfirmClose(true)}>
                {t("Close account")}
              </Button>
            )
          ) : (
            <Button
              variant="secondary"
              size="sm"
              loading={busy === "status"}
              disabled={busy !== null}
              onClick={() =>
                void run(
                  "status",
                  () => api.adminSetAccountStatus(row.id, true),
                  "Open again. The family returns to exactly the data they left.",
                )
              }
            >
              {t("Reopen account")}
            </Button>
          )}
        </div>
      </div>

      {notice ? (
        <div className="mt-3">
          <Notice tone={notice.tone} text={notice.text} />
        </div>
      ) : null}
    </Card>
  );
}

// ------------------------------------------------------------------- the screen

export default function AdminUsersScreen() {
  const t = useT();
  const tf = useTf();
  const [draft, setDraft] = useState<Filter>(EMPTY);
  const [applied, setApplied] = useState<Filter>(EMPTY);
  const [offset, setOffset] = useState(0);

  const load = useCallback(
    () =>
      api.adminUsers({
        q: applied.q.trim() || undefined,
        role: applied.role || undefined,
        state: applied.state || undefined,
        flag: applied.flag || undefined,
        limit: PAGE,
        offset,
      }),
    [applied, offset],
  );
  const page = useResource(load);
  const data = page.data;

  /**
   * An account that has just been changed is remembered here and folded into the loaded
   * page at render, so the row shows what the server now holds without the notice it just
   * printed being redrawn by a refetch of the whole list.
   */
  const [edited, setEdited] = useState<Record<number, AdminUserRow>>({});
  const rows = data ? data.items.map((row) => edited[row.id] ?? row) : [];

  function apply(next: Filter) {
    setDraft(next);
    setApplied(next);
    setOffset(0);
  }

  return (
    <Screen
      title="Accounts"
      description="Find an account, see how much it has used the app, and change whether it is open or whether it runs the site. Nothing else about a person is readable here."
      badge={<Badge tone="brand">{t("Admin")}</Badge>}
      action={
        <Button variant="outline" size="sm" onClick={page.reload} loading={page.state === "loading"}>
          {t("Reload")}
        </Button>
      }
    >
      <div className="space-y-5">
        <form
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault();
            apply(draft);
          }}
        >
          <Input
            label="Search"
            placeholder="A name, or an exact id"
            value={draft.q}
            maxLength={80}
            onChange={(event) => setDraft({ ...draft, q: event.target.value })}
            hint="Email addresses are not searched — see the note below the list."
          />
          <Select
            label="Role"
            options={ROLE_OPTIONS}
            value={draft.role}
            onChange={(event) => apply({ ...draft, role: event.target.value })}
          />
          <Select
            label="State"
            options={STATE_OPTIONS}
            value={draft.state}
            onChange={(event) => apply({ ...draft, state: event.target.value })}
          />
          <Select
            label="Access"
            options={FLAG_OPTIONS}
            value={draft.flag}
            onChange={(event) => apply({ ...draft, flag: event.target.value })}
          />
          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
            <Button type="submit" size="sm">
              {t("Search")}
            </Button>
            {applied.q || applied.role || applied.state || applied.flag ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => apply(EMPTY)}>
                {t("Clear filters")}
              </Button>
            ) : null}
          </div>
        </form>

        {page.state === "loading" && !data ? <LoadingPanel label="Looking up accounts" /> : null}

        {page.state === "error" && !data ? <ErrorState description={page.error} onRetry={page.reload} /> : null}

        {data ? (
          <>
            {rows.length === 0 ? (
              <EmptyState
                title="No account matches this"
                description={
                  applied.q.trim()
                    ? /^\d+$/.test(applied.q.trim())
                      ? tf(
                          "Nothing is named “{name}”, and there is no account with id {id}. Names are matched as a substring, and ids exactly.",
                          { name: applied.q.trim(), id: applied.q.trim() },
                        )
                      : tf(
                          "Nothing is named “{name}”. Names are matched as a substring, and ids exactly.",
                          { name: applied.q.trim() },
                        )
                    : "This filter has no rows. That is the whole of the answer — an empty table here is not an error."
                }
              />
            ) : (
              <div className="space-y-3">
                {rows.map((row) => (
                  <AccountRow
                    key={row.id}
                    row={row}
                    onChanged={(next) => setEdited((current) => ({ ...current, [next.id]: next }))}
                  />
                ))}
              </div>
            )}
            <Pager total={data.total} limit={data.limit} offset={data.offset} onMove={setOffset} unit="accounts" />
          </>
        ) : null}

        <Card className="border-line">
          <p className="text-sm font-semibold text-ink">{t("Why there is no email search, and no delete")}</p>
          <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-muted">
            <li>
              {t(
                "An address belongs to the person who attached it. Searching by one would let anybody with this flag test which addresses have accounts here, so the server has no such query — a name and an id are the only ways in.",
              )}
            </li>
            <li>
              {t(
                "Closing is reversible and deleting is not, so only closing is offered. There is no operator endpoint that erases a person’s rows; a request to remove somebody else’s data is handled outside this screen, by whoever runs the deployment.",
              )}
            </li>
            <li>
              {t(
                "A plan is not changed here either. What somebody pays is their own billing page’s business, and a grant or a cancellation made from an admin screen would be a financial action with no receipt behind it.",
              )}
            </li>
            <li>
              {t(
                "Every change on this page writes one row into the operator log, which you can read on the deployment screen. The log holds the action and the field that moved, never a value.",
              )}
            </li>
          </ul>
        </Card>
      </div>
    </Screen>
  );
}
