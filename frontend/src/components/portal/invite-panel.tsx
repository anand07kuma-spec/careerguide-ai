"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Mail, MailWarning } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/field";
import { api, ApiError } from "@/lib/api";
import { useT, useTf } from "@/lib/i18n";
import { BULK_MAX_ROWS, INVITABLE_ROLES, ROLE_WORDS, parseBulkList, rejectedRows } from "@/lib/portal";
import type { InviteResult, MemberRole } from "@/lib/types";

/**
 * Holding a place for an address.
 *
 * The response is printed as it arrives rather than smoothed into a green tick: a school
 * whose mail did not go out still holds the seat and still has a link to write on its own
 * noticeboard, and the honest sentence about that is the route's `mail_detail`, not this
 * screen's guess.
 *
 * The addresses themselves are data and stay as they were typed. What did and did not
 * happen is the app's own sentence and is translated; the two lists of addresses are
 * folded behind a `details` with their count in the summary, because fifty pasted rows
 * that bounced would otherwise bury the one line that says the seats are still held.
 */
export function InvitePanel({
  slug,
  seatsLeft,
  canInviteStaff,
  onDone,
}: {
  slug: string;
  seatsLeft: number;
  canInviteStaff: boolean;
  onDone: () => void;
}) {
  const t = useT();
  const tf = useTf();
  const [bulk, setBulk] = useState(false);
  const [role, setRole] = useState<MemberRole>("student");
  const [email, setEmail] = useState("");
  const [label, setLabel] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InviteResult | null>(null);

  const rows = useMemo(() => parseBulkList(text, role), [text, role]);
  const dropped = useMemo(() => rejectedRows(text), [text]);

  // Select translates its own option labels, so the role words go in as they are.
  const roleOptions = INVITABLE_ROLES.filter((value) => canInviteStaff || value === "student" || value === "parent")
    .map((value) => ({ value, label: ROLE_WORDS[value] }));

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const answer = bulk
        ? await api.inviteBulk(slug, rows)
        : await api.invite(slug, {
            email: email.trim().toLowerCase(),
            org_role: role,
            display_label: label.trim() ? label.trim().slice(0, 80) : null,
          });
      setResult(answer);
      setEmail("");
      setLabel("");
      setText("");
      onDone();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t("Something went wrong."));
    } finally {
      setBusy(false);
    }
  }

  const nothingToSend = bulk ? rows.length === 0 : !email.trim();

  return (
    <Card className="space-y-4">
      <CardHeader
        title={bulk ? "Invite a class" : "Invite one address"}
        description={
          bulk
            ? "One address per line, or address then a label separated by a comma. The first 50 lines are sent."
            : "The address is the only detail stored on the place, and it is cleared the moment somebody accepts."
        }
        icon={<Mail className="h-5 w-5" aria-hidden />}
        action={
          <Button variant="ghost" size="sm" onClick={() => setBulk((next) => !next)}>
            {bulk ? t("One address") : t("Paste a list")}
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          label="Role"
          value={role}
          options={roleOptions}
          onChange={(event) => setRole(event.target.value as MemberRole)}
          hint={
            canInviteStaff
              ? "A staff role can be given here. A child's account is never handed one."
              : "Only students and parents can be invited by this portal."
          }
        />
        <p className="self-end text-xs leading-relaxed text-muted">
          {seatsLeft > 0
            ? tf("{n} places left in this tier.", { n: seatsLeft })
            : t("No places left. A bigger tier is arranged with a person, not bought here.")}
        </p>
      </div>

      {bulk ? (
        <Textarea
          label="Addresses"
          rows={8}
          value={text}
          spellCheck={false}
          onChange={(event) => setText(event.target.value)}
          placeholder="riya@example.com, Class 11 A\narjun@example.com"
          hint={
            text.trim()
              ? `${tf("{n} ready to send", { n: rows.length })}${
                  dropped > 0
                    ? dropped === 1
                      ? tf(", {n} line is not an address", { n: dropped })
                      : tf(", {n} lines are not an address", { n: dropped })
                    : ""
                }`
              : "Paste from a spreadsheet. Lines that are not an address are skipped, not sent."
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Email address"
            type="email"
            value={email}
            spellCheck={false}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="riya@example.com"
          />
          <Input
            label="Label (optional)"
            value={label}
            maxLength={80}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Class 11 A"
            hint="What the roster will call this place, until the person chooses a name themselves."
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => void send()} loading={busy} disabled={nothingToSend || seatsLeft === 0}>
          <Mail className="h-4 w-4" aria-hidden />
          {bulk
            ? tf("Send {n} invitations", { n: Math.min(rows.length, BULK_MAX_ROWS) })
            : t("Hold a place")}
        </Button>
        {seatsLeft === 0 ? (
          <Badge tone="warning">
            {t("A waiting place already holds this portal's last seat")}
          </Badge>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="flex items-start gap-2 text-sm leading-relaxed text-danger">
          <MailWarning className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span className="min-w-0 break-words">{error}</span>
        </p>
      ) : null}

      {result ? <InviteOutcome result={result} /> : null}
    </Card>
  );
}

/** What the platform actually did, in the four categories the route returns. */
function InviteOutcome({ result }: { result: InviteResult }) {
  const t = useT();
  const tf = useTf();
  return (
    <div className="space-y-2 rounded-2xl border border-line bg-canvas/60 p-4 text-sm leading-relaxed">
      <p className="font-medium text-heading">
        {result.invited.length === 0
          ? t("No new place was created.")
          : result.invited.length === 1
            ? tf("{n} place now held.", { n: result.invited.length })
            : tf("{n} places now held.", { n: result.invited.length })}
      </p>
      {/* Whether the letters went out is the fact a school cannot afford to miss, so it
          stays on the page rather than behind a fold. */}
      {result.mailed ? (
        <p className="text-muted">{t("Every one of them was written to an address by mail.")}</p>
      ) : (
        <p className="break-words text-muted">
          {result.mail_detail
            ? tf("The letters did not all go out: {detail} The places are still held, and the link can be handed over another way.", {
                detail: result.mail_detail,
              })
            : t("The letters did not all go out. The places are still held, and the link can be handed over another way.")}
        </p>
      )}
      {result.already_there.length > 0 ? (
        <AddressFold
          summary={tf("Already on the roster: {n}", { n: result.already_there.length })}
          note={t("Their earlier link still works.")}
          addresses={result.already_there}
        />
      ) : null}
      {result.refused.length > 0 ? (
        <AddressFold
          summary={tf("Not a readable address: {n}", { n: result.refused.length })}
          note={t("Nothing was created for these.")}
          addresses={result.refused}
        />
      ) : null}
      <p className="text-xs text-muted">{tf("{n} places left after this.", { n: result.seats_left })}</p>
    </div>
  );
}

/** A count on the page, the addresses behind one tap. */
function AddressFold({
  summary,
  note,
  addresses,
}: {
  summary: string;
  note: string;
  addresses: string[];
}) {
  return (
    <details className="group rounded-xl border border-line bg-surface px-3 py-2">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium text-brand-dark [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">{summary}</span>
        <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="mt-2 space-y-1 border-t border-line pt-2 text-xs leading-relaxed text-muted">
        <p>{note}</p>
        <p className="break-words">{addresses.join(", ")}</p>
      </div>
    </details>
  );
}