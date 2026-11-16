"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Check,
  Copy,
  EyeOff,
  KeyRound,
  Link2,
  ShieldCheck,
  UserCheck,
  UserMinus,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { Switch } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import type { GuardianLink, ShareCode } from "@/lib/types";
import { initials, relativeTime } from "@/lib/utils";
import {
  DetailNote,
  SettingsCard,
  SettingsItem,
  StatusPill,
} from "./settings-page-shell";
import { initial, messageFor, type Resource } from "./settings-shared";

export function FamilySettings() {
  const { isStudent } = useSession();
  const { toast } = useToast();
  const t = useT();

  const [shareCode, setShareCode] = useState<Resource<ShareCode>>(initial);
  const [guardians, setGuardians] = useState<Resource<GuardianLink[]>>(initial);
  const [busyToggle, setBusyToggle] = useState<string | null>(null);
  const [requestBusy, setRequestBusy] = useState<string | null>(null);
  const [codeBusy, setCodeBusy] = useState<"new" | "revoke" | null>(null);
  const [copied, setCopied] = useState<"share" | null>(null);
  const [removeTarget, setRemoveTarget] = useState<GuardianLink | null>(null);
  const [removing, setRemoving] = useState(false);

  const loadShareCode = useCallback(async () => {
    try {
      setShareCode({ state: "ready", data: await api.shareCode(), error: null });
    } catch (error) {
      setShareCode({ state: "error", data: null, error: messageFor(error) });
    }
  }, []);

  const loadGuardians = useCallback(async () => {
    try {
      setGuardians({ state: "ready", data: await api.guardians(), error: null });
    } catch (error) {
      setGuardians({ state: "error", data: null, error: messageFor(error) });
    }
  }, []);

  useEffect(() => {
    // Fetching is the whole purpose of this effect, and every setState inside
    // those loaders happens after an await.
    if (!isStudent) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadShareCode();
    void loadGuardians();
  }, [isStudent, loadShareCode, loadGuardians]);

  const rotateCode = useCallback(async () => {
    setCodeBusy("new");
    try {
      setShareCode({ state: "ready", data: await api.newShareCode(), error: null });
      toast("New sharing code ready. The previous one stopped working.", "success");
    } catch (error) {
      toast(messageFor(error), "error");
    } finally {
      setCodeBusy(null);
    }
  }, [toast]);

  const revokeCode = useCallback(async () => {
    setCodeBusy("revoke");
    try {
      setShareCode({ state: "ready", data: await api.revokeShareCode(), error: null });
      toast("Sharing code switched off.", "success");
    } catch (error) {
      toast(messageFor(error), "error");
    } finally {
      setCodeBusy(null);
    }
  }, [toast]);

  const copyValue = useCallback(
    async (value: string) => {
      try {
        await navigator.clipboard.writeText(value);
      } catch {
        toast("Your browser blocked copying — please write it down instead.", "info");
        return;
      }
      setCopied("share");
      setTimeout(() => setCopied(null), 2000);
    },
    [toast],
  );

  const setTranscripts = useCallback(
    async (link: GuardianLink, granted: boolean) => {
      setBusyToggle(`transcripts:${link.guardianship_id}`);
      setGuardians((current) => ({
        ...current,
        state: "ready",
        data: (current.data ?? []).map((item) =>
          item.guardianship_id === link.guardianship_id
            ? { ...item, can_see_transcripts: granted }
            : item,
        ),
      }));
      try {
        const updated = await api.setTranscriptSharing(link.guardianship_id, granted);
        setGuardians((current) => ({
          ...current,
          data: (current.data ?? []).map((item) =>
            item.guardianship_id === updated.guardianship_id ? updated : item,
          ),
        }));
      } catch (error) {
        toast(messageFor(error), "error");
        void loadGuardians();
      } finally {
        setBusyToggle(null);
      }
    },
    [loadGuardians, toast],
  );

  const confirmRemoveGuardian = useCallback(async () => {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      await api.removeGuardian(removeTarget.guardianship_id);
      setRemoveTarget(null);
      toast("Link removed. That adult can no longer see your summary.", "success");
      void loadGuardians();
    } catch (error) {
      toast(messageFor(error), "error");
    } finally {
      setRemoving(false);
    }
  }, [removeTarget, loadGuardians, toast]);

  const approveRequest = useCallback(
    async (link: GuardianLink) => {
      setRequestBusy(`approve:${link.guardianship_id}`);
      try {
        await api.approveGuardian(link.guardianship_id);
        toast(`${link.name} can now see your summary.`, "success");
        void loadGuardians();
      } catch (error) {
        toast(messageFor(error), "error");
      } finally {
        setRequestBusy(null);
      }
    },
    [loadGuardians, toast],
  );

  const declineRequest = useCallback(
    async (link: GuardianLink) => {
      setRequestBusy(`decline:${link.guardianship_id}`);
      try {
        await api.removeGuardian(link.guardianship_id);
        toast("Request declined. Nothing is shared with them.", "success");
        void loadGuardians();
      } catch (error) {
        toast(messageFor(error), "error");
      } finally {
        setRequestBusy(null);
      }
    },
    [loadGuardians, toast],
  );

  const guardianList = guardians.data ?? [];
  const pendingGuardians = guardianList.filter((link) => link.status === "pending");
  const activeGuardians = guardianList.filter((link) => link.status === "active");
  const revokedGuardians = guardianList.filter((link) => link.status === "revoked");
  const guardianCount = activeGuardians.length;

  if (!isStudent) {
    return (
      <SettingsCard
        icon={Users}
        tone="bg-tile-peach text-on-tile-peach"
        title="Family Access"
        description="How a parent or guardian stays connected with a child's learning."
      >
        <div className="px-5 py-4 sm:px-6">
          <p className="text-sm leading-relaxed text-muted">
            {t(
              "Family access belongs to a student account. A parent account does not hold a sharing code or links — those are created and controlled by the student whose summary they are about.",
            )}
          </p>
        </div>
      </SettingsCard>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {pendingGuardians.length > 0 ? (
          <SettingsCard
            icon={UserCheck}
            tone="bg-tile-blue text-on-tile-blue"
            title="Link Requests"
            description="Someone typed your sharing code and is waiting for your decision. Nothing is shared until you approve here."
            bodyClassName="divide-y divide-settings-line"
          >
            {pendingGuardians.map((link) => (
              <div
                key={link.guardianship_id}
                className="flex flex-wrap items-start justify-between gap-3 px-5 py-4 sm:px-6"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">
                    {link.name}
                    {link.relationship ? (
                      <span className="ml-2 text-xs font-normal text-muted">
                        {link.relationship}
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted">
                    {t("Asked")} {relativeTime(link.linked_at)} · {t("no summary is shared yet")}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    loading={requestBusy === `decline:${link.guardianship_id}`}
                    disabled={requestBusy !== null && requestBusy !== `decline:${link.guardianship_id}`}
                    onClick={() => void declineRequest(link)}
                  >
                    <X className="h-4 w-4" aria-hidden />
                    {t("Decline")}
                  </Button>
                  <Button
                    size="sm"
                    loading={requestBusy === `approve:${link.guardianship_id}`}
                    disabled={requestBusy !== null && requestBusy !== `approve:${link.guardianship_id}`}
                    onClick={() => void approveRequest(link)}
                  >
                    <UserCheck className="h-4 w-4" aria-hidden />
                    {t("Approve")}
                  </Button>
                </div>
              </div>
            ))}
            <div className="px-5 py-4 sm:px-6">
              <DetailNote>
                {t(
                  "Approving turns on \"Include my themes in the parent summary\" in Privacy. If you withdraw that consent later, every approved link ends immediately.",
                )}
              </DetailNote>
            </div>
          </SettingsCard>
        ) : null}

        <SettingsCard
          icon={Users}
          tone="bg-tile-peach text-on-tile-peach"
          title="Connected Family Members"
          description="Adults who can see a summary of your exploration. Nobody outside your account can see anything."
          bodyClassName="divide-y divide-settings-line"
        >
          {guardians.state === "loading" ? (
            <div className="space-y-3 px-5 py-4 sm:px-6">
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
            </div>
          ) : guardians.state === "error" ? (
            <div className="px-5 py-4 sm:px-6">
              <ErrorState
                title="Linked adults could not load"
                description={guardians.error ?? undefined}
                onRetry={loadGuardians}
              />
            </div>
          ) : guardianCount === 0 ? (
            <div className="flex items-start gap-3 px-5 py-5 sm:px-6">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-settings-page text-muted">
                <Link2 className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">{t("No adults are linked")}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted">
                  {t(
                    "Nobody outside your account can see anything. If you later want a parent to see your exploration summary, share the code below with them.",
                  )}
                </p>
              </div>
            </div>
          ) : (
            activeGuardians.map((link) => (
              <div key={link.guardianship_id} className="flex items-start gap-3 px-5 py-4 sm:px-6">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-subtle text-sm font-semibold text-subtle-ink">
                  {initials(link.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">
                    {link.name}
                    {link.relationship ? (
                      <span className="ml-2 text-xs font-normal text-muted">{link.relationship}</span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {t("Approved")} {relativeTime(link.consented_at ?? link.linked_at)} ·{" "}
                    {t("sees summary only")}
                  </p>
                </div>
                <StatusPill tone="success" className="mt-0.5">
                  {t("Summary shared")}
                </StatusPill>
              </div>
            ))
          )}
        </SettingsCard>

        <SettingsCard
          icon={ShieldCheck}
          tone="bg-tile-mint text-on-tile-mint"
          title="Access Permissions"
          description="What a linked adult can read. The summary is the price of the link; the conversation text is your choice."
          bodyClassName="divide-y divide-settings-line"
        >
          <SettingsItem
            title="Exploration summary"
            description="Themes, saved careers and progress counts. There is no switch that shares a link but hides the summary — remove the link instead."
          >
            <StatusPill tone="brand">{t("Always shared")}</StatusPill>
          </SettingsItem>
          {guardianCount === 0 ? (
            <div className="px-5 py-4 sm:px-6">
              <DetailNote>
                {t(
                  "With no adult linked, nothing is being shared at all. The switches for conversation text appear here once someone joins with your code.",
                )}
              </DetailNote>
            </div>
          ) : (
            activeGuardians.map((link) => (
              <div
                key={link.guardianship_id}
                className="flex items-start justify-between gap-4 px-5 py-4 sm:px-6"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{link.name}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted">
                    {t("Conversation text")} ·{" "}
                    {link.can_see_transcripts ? t("shared") : t("not shared")}
                  </p>
                </div>
                <Switch
                  checked={link.can_see_transcripts}
                  disabled={busyToggle === `transcripts:${link.guardianship_id}`}
                  onChange={(next) => void setTranscripts(link, next)}
                  ariaLabel={`${t("Share conversation text with")} ${link.name}`}
                />
              </div>
            ))
          )}
          <div className="px-5 py-4 sm:px-6">
            <DetailNote>
              {t(
                "Themes and progress are shared either way, for every linked adult. Only turn conversation text on if you want that adult to read the actual messages.",
              )}
            </DetailNote>
          </div>
        </SettingsCard>

        <SettingsCard
          icon={KeyRound}
          tone="bg-tile-lavender text-on-tile-lavender"
          title="Family Invitations"
          description="A code a parent types to link. Either of you can end it later."
          bodyClassName="divide-y divide-settings-line"
        >
          <div className="px-5 py-5 sm:px-6">
            {shareCode.state === "loading" ? (
              <Skeleton className="h-24" />
            ) : shareCode.state === "error" ? (
              <ErrorState
                title="The sharing code could not load"
                description={shareCode.error ?? undefined}
                onRetry={loadShareCode}
              />
            ) : (
              <div className="rounded-2xl bg-settings-page p-4">
                {shareCode.data?.code ? (
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                        {t("Give this to a parent")}
                      </p>
                      <p className="mt-1 font-mono text-2xl font-bold tracking-[0.28em] text-ink sm:text-3xl">
                        {shareCode.data.code}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void copyValue(shareCode.data?.code ?? "")}
                    >
                      {copied === "share" ? (
                        <Check className="h-4 w-4 text-success" aria-hidden />
                      ) : (
                        <Copy className="h-4 w-4" aria-hidden />
                      )}
                      {copied === "share" ? t("Copied") : t("Copy")}
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm font-medium text-ink">
                    {t("Sharing is currently switched off")}
                  </p>
                )}
                {shareCode.data?.note ? (
                  <p className="mt-2 text-xs leading-relaxed text-muted">{shareCode.data.note}</p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant={shareCode.data?.code ? "outline" : "primary"}
                    loading={codeBusy === "new"}
                    disabled={codeBusy !== null && codeBusy !== "new"}
                    onClick={() => void rotateCode()}
                  >
                    <KeyRound className="h-4 w-4" aria-hidden />
                    {t("Generate a new code")}
                  </Button>
                  {shareCode.data?.code ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      loading={codeBusy === "revoke"}
                      disabled={codeBusy !== null && codeBusy !== "revoke"}
                      onClick={() => void revokeCode()}
                    >
                      <EyeOff className="h-4 w-4" aria-hidden />
                      {t("Stop sharing")}
                    </Button>
                  ) : null}
                </div>
              </div>
            )}
          </div>
          <div className="px-5 py-4 sm:px-6">
            <DetailNote>
              {t(
                "A parent can only see a summary if you give them this code — they cannot attach by guessing. You can revoke it any time.",
              )}
            </DetailNote>
          </div>
        </SettingsCard>

        <SettingsCard
          icon={UserMinus}
          tone="bg-tile-slate text-on-tile-slate"
          title="Manage Access"
          description="Review who is linked or ended, and take access away when you want to."
          bodyClassName="divide-y divide-settings-line"
        >
          {activeGuardians.length === 0 && revokedGuardians.length === 0 ? (
            <div className="px-5 py-4 sm:px-6">
              <p className="text-sm leading-relaxed text-muted">
                {t("There is nobody to remove. Your summary is not shared with anyone.")}
              </p>
            </div>
          ) : (
            [...activeGuardians, ...revokedGuardians].map((link) => (
              <SettingsItem
                key={link.guardianship_id}
                title={
                  <span className="flex flex-wrap items-center gap-2">
                    {link.name}
                    <StatusPill tone={link.status === "active" ? "success" : "neutral"}>
                      {link.status === "active"
                        ? t("Access approved")
                        : `${t("Access ended")} ${relativeTime(link.withdrawn_at ?? link.linked_at)}`}
                    </StatusPill>
                  </span>
                }
                description={
                  link.status === "active"
                    ? "Removing takes effect immediately. Nothing about your account is deleted — you would approve a new request to link again."
                    : "This adult no longer sees anything. Removing the row also deletes the old request; nothing else about your account changes."
                }
              >
                <Button
                  variant="outline"
                  size="sm"
                  className="border-danger/30 text-danger hover:border-danger/60 hover:bg-danger-mist hover:text-danger"
                  onClick={() => setRemoveTarget(link)}
                >
                  <UserMinus className="h-4 w-4" aria-hidden />
                  {link.status === "active" ? t("Remove access") : t("Remove from list")}
                </Button>
              </SettingsItem>
            ))
          )}
        </SettingsCard>
      </div>

      {/* Remove guardian confirm */}
      <Modal
        open={removeTarget !== null}
        onClose={() => !removing && setRemoveTarget(null)}
        title={
          removeTarget?.status === "pending"
            ? "Decline this link request?"
            : removeTarget?.status === "revoked"
              ? "Remove this ended request?"
              : "Remove this adult's access?"
        }
        description={
          removeTarget
            ? removeTarget.status === "pending"
              ? `${removeTarget.name} will not see anything.`
              : removeTarget.status === "revoked"
                ? `${removeTarget.name} already has no access.`
                : `${removeTarget.name} will no longer see your summary.`
            : undefined
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setRemoveTarget(null)} disabled={removing}>
              {removeTarget?.status === "pending" ? "Keep the request" : "Keep the link"}
            </Button>
            <Button variant="danger" loading={removing} onClick={() => void confirmRemoveGuardian()}>
              {removeTarget?.status === "pending" ? "Decline request" : "Remove access"}
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-muted">
          {removeTarget?.status === "pending"
            ? `Nothing is shared with ${removeTarget.name} while the request is waiting. Declining deletes the request; they would need your code again to ask once more.`
            : removeTarget?.status === "revoked"
              ? `${removeTarget.name} stopped seeing your summary when sharing was withdrawn. Removing the row only clears the old request from this list.`
              : `Removing access is your choice and takes effect immediately. Nothing about your account is deleted — if you ever want ${removeTarget?.name ?? "this adult"} to see a summary again, you would approve a new request.`}
        </p>
      </Modal>
    </>
  );
}
