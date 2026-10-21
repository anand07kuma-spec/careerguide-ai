"use client";

import { useMemo, useState } from "react";
import { Mail, MailWarning } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/field";
import { api, ApiError } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { BULK_MAX_ROWS, INVITABLE_ROLES, ROLE_WORDS, parseBulkList, rejectedRows } from "@/lib/portal";
import type { InviteResult, MemberRole } from "@/lib/types";

/**
 * Holding a place for an address.
 *
 * The response is printed as it arrives rather than smoothed into a green tick: a school
 * whose mail did not go out still holds the seat and still has a link to write on its own
 * noticeboard, and the honest sentence about that is the route's `mail_detail`, not this
 * screen's guess.
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
          label={t("Role")}
          value={role}
          options={roleOptions}
          onChange={(event) => setRole(event.target.value as MemberRole)}
          hint={
            canInviteStaff
              ? t("A staff role can be given here. A child's account is never handed one.")
              : t("Only students and parents can be invited by this portal.")
          }
        />
        <p className="self-end text-xs leading-relaxed text-muted">
          {seatsLeft > 0
            ? t(`${seatsLeft} places left in this tier.`)
            : t("No places left. A bigger tier is arranged with a person, not bought here.")}
        </p>
      </div>

      {bulk ? (
        <Textarea
          label={t("Addresses")}
          rows={8}
          value={text}
          spellCheck={false}
          onChange={(event) => setText(event.target.value)}
          placeholder="riya@example.com, Class 11 A\narjun@example.com"
          hint={
            text.trim()
              ? `${rows.length} ready to send${dropped > 0 ? `, ${dropped} line${dropped === 1 ? "" : "s"} not an address` : ""}`
              : t("Paste from a spreadsheet. Lines that are not an address are skipped, not sent.")
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label={t("Email address")}
            type="email"
            value={email}
            spellCheck={false}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="riya@example.com"
          />
          <Input
            label={t("Label (optional)")}
            value={label}
            maxLength={80}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Class 11 A"
            hint={t("What the roster will call this place, until the person chooses a name themselves.")}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => void send()} loading={busy} disabled={nothingToSend || seatsLeft === 0}>
          <Mail className="h-4 w-4" aria-hidden />
          {bulk
            ? t(`Send ${Math.min(rows.length, BULK_MAX_ROWS)} invitations`)
            : t("Hold a place")}
        </Button>
        {seatsLeft === 0 ? (
          <Badge tone="warning">
            {t("A waiting place already holds this portal's last seat")}
          </Badge>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="flex items-start gap-2 text-sm text-danger">
          <MailWarning className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}

      {result ? <InviteOutcome result={result} /> : null}
    </Card>
  );
}

/** What the platform actually did, in the four categories the route returns. */
function InviteOutcome({ result }: { result: InviteResult }) {
  return (
    <div className="space-y-2 rounded-xl border border-line bg-canvas/60 p-4 text-sm">
      <p className="font-medium text-ink">
        {result.invited.length === 0
          ? "No new place was created."
          : `${result.invited.length} place${result.invited.length === 1 ? "" : "s"} now held.`}
      </p>
      {result.mailed ? (
        <p className="text-muted">Every one of them was written to an address by mail.</p>
      ) : (
        <p className="text-muted">
          The letters did not all go out
          {result.mail_detail ? `: ${result.mail_detail}` : "."} The places are still held, and the
          link can be handed over another way.
        </p>
      )}
      {result.already_there.length > 0 ? (
        <p className="text-muted">
          Already on the roster, and their earlier link still works: {result.already_there.join(", ")}
        </p>
      ) : null}
      {result.refused.length > 0 ? (
        <p className="text-muted">
          Not a readable address, and nothing was created: {result.refused.join(", ")}
        </p>
      ) : null}
      <p className="text-xs text-muted">{result.seats_left} places left after this.</p>
    </div>
  );
}
