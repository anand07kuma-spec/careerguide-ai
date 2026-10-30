"use client";

import { useState } from "react";
import { ShieldCheck, UserRound, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/field";
import { api, ApiError } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { ROLE_WORDS } from "@/lib/portal";
import type { MemberAdminRow, MemberStatus } from "@/lib/types";

const STATUS_TONE: Record<MemberStatus, "neutral" | "success" | "warning"> = {
  active: "success",
  invited: "warning",
  revoked: "neutral",
};

const STATUS_WORD: Record<MemberStatus, string> = {
  active: "Joined",
  invited: "Waiting to join",
  revoked: "Removed",
};

/**
 * The roster, as this account is entitled to read it.
 *
 * A place that is only invited still shows here, under the label the school typed, because
 * the one thing a school needs to know about an address it has written to is that the seat
 * is gone. It shows nothing else: no answers and no report exist for a person who has not
 * accepted, and the row keeps the school's own label rather than the name the child later
 * chooses.
 */
export function RosterPanel({
  slug,
  members,
  canManage,
  onChanged,
}: {
  slug: string;
  members: MemberAdminRow[];
  canManage: boolean;
  onChanged: () => void;
}) {
  const t = useT();
  const [busy, setBusy] = useState<number | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<MemberAdminRow | null>(null);

  const counsellors = members.filter((row) => row.org_role === "counsellor" && row.status === "active");
  // Two counsellors with the same label cannot be told apart from the row the API gives
  // back, so the picker is left blank rather than showing the wrong adult as assigned.
  const labels = new Set(counsellors.map((row) => row.display_label ?? ""));
  const labelsAreUnique = labels.size === counsellors.length;

  async function assign(row: MemberAdminRow, value: string) {
    setBusy(row.id);
    setFailure(null);
    try {
      await api.assignCounsellor(slug, row.id, value === "" ? null : Number(value));
      onChanged();
    } catch (caught) {
      setFailure(caught instanceof ApiError ? caught.message : t("Something went wrong."));
    } finally {
      setBusy(null);
    }
  }

  async function remove(row: MemberAdminRow) {
    setBusy(row.id);
    setFailure(null);
    try {
      await api.removeMember(slug, row.id);
      setConfirming(null);
      onChanged();
    } catch (caught) {
      setFailure(caught instanceof ApiError ? caught.message : t("Something went wrong."));
      setConfirming(null);
    } finally {
      setBusy(null);
    }
  }

  if (members.length === 0) {
    return (
      <Card className="py-10 text-center text-sm text-muted">
        {t("Nobody is on this roster yet.")}
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {failure ? (
        <p role="alert" className="rounded-xl border border-danger/25 bg-danger-mist/60 px-4 py-3 text-sm text-danger">
          {failure}
        </p>
      ) : null}

      {members.map((row) => {
        const assigned = labelsAreUnique
          ? counsellors.find((c) => (c.display_label ?? null) === row.assigned_counsellor_label)
          : undefined;
        const canAssign = canManage && row.status === "active" && (row.org_role === "student" || row.org_role === "parent");
        return (
          <Card key={row.id} className="space-y-3 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <UserRound className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                  {row.display_label || t("A member with no label")}
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-1.5">
                  <Badge tone="brand">{ROLE_WORDS[row.org_role]}</Badge>
                  <Badge tone={STATUS_TONE[row.status]}>{STATUS_WORD[row.status]}</Badge>
                  {row.status === "active" && (row.org_role === "student" || row.org_role === "parent") ? (
                    <Badge tone={row.share_results ? "success" : "neutral"}>
                      {row.share_results ? t("Results shared") : t("Results kept private")}
                    </Badge>
                  ) : null}
                </p>
                {row.status === "invited" && row.invited_email ? (
                  <p className="mt-1.5 text-xs text-muted">
                    {t("Place held for")} {row.invited_email}
                    {row.invite_expires_at ? ` · ${t("until")} ${new Date(row.invite_expires_at).toLocaleDateString()}` : ""}
                  </p>
                ) : null}
                {row.joined_at ? (
                  <p className="mt-1 text-xs text-muted">
                    {t("Joined")} {new Date(row.joined_at).toLocaleDateString()}
                  </p>
                ) : null}
              </div>

              {canManage && row.status !== "revoked" ? (
                <Button
                  variant="ghost"
                  size="sm"
                  loading={busy === row.id}
                  onClick={() => setConfirming(row)}
                >
                  <X className="h-4 w-4" aria-hidden />
                  {row.status === "invited" ? t("Cancel invite") : t("Remove")}
                </Button>
              ) : null}
            </div>

            {canAssign ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Select
                  label={t("Assigned counsellor")}
                  value={assigned ? String(assigned.id) : ""}
                  placeholder="Nobody yet"
                  options={counsellors.map((c) => ({
                    value: String(c.id),
                    // Same rule as the client list: the row id stays as the value the
                    // request needs, and what the admin reads is a person's label or the
                    // day they joined.
                    label: c.display_label
                      ? c.display_label
                      : c.joined_at
                        ? `${t("A counsellor with no label")} · ${new Date(c.joined_at).toLocaleDateString()}`
                        : t("A counsellor with no label"),
                  }))}
                  disabled={busy === row.id}
                  onChange={(event) => void assign(row, event.target.value)}
                  hint={t("A person to sit with. It opens no file: what this counsellor may read is still the student's own choice.")}
                />
              </div>
            ) : null}

            {canManage && counsellors.length === 0 && row.status === "active" && row.org_role === "student" ? (
              <p className="flex items-center gap-1.5 text-xs text-muted">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                {t("Invite a counsellor to this portal before assigning students to one.")}
              </p>
            ) : null}
          </Card>
        );
      })}

      <Modal
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        title={confirming?.status === "invited" ? "Cancel this invitation?" : "Take this place back?"}
        description={
          confirming?.status === "invited"
            ? "The link in the letter stops working and the seat comes back. Nothing else changes."
            : "The account keeps everything it wrote and its own sharing switch. The place in this portal is closed."
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(null)}>
              {t("Keep it")}
            </Button>
            <Button
              variant="danger"
              loading={confirming !== null && busy === confirming.id}
              onClick={() => confirming && void remove(confirming)}
            >
              {confirming?.status === "invited" ? "Cancel the invite" : "Take the place back"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          {confirming?.display_label
            ? `“${confirming.display_label}” — ${ROLE_WORDS[confirming.org_role]}.`
            : confirming?.invited_email ?? "This place has no label."}
        </p>
      </Modal>
    </div>
  );
}
