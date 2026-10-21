"use client";

import { useCallback, useState } from "react";
import { DoorOpen, HeartHandshake } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { LoadingPanel } from "@/components/ui/feedback";
import { Modal } from "@/components/ui/modal";
import { Toggle } from "@/components/ui/field";
import { api, ApiError } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/lib/use-resource";
import type { MyMembership } from "@/lib/types";

/**
 * What a portal looks like to the student or guardian who joined it.
 *
 * Their own switch is the only thing on this screen that writes about them, and the notes
 * below it are only the ones a counsellor chose to send — the server filters both, so this
 * is a view of what is already permitted rather than a control that assumes it.
 */
export function MemberView({
  slug,
  membership,
  onLeft,
}: {
  slug: string;
  membership: MyMembership;
  onLeft: () => void;
}) {
  const t = useT();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [showLeave, setShowLeave] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const loadBranding = useCallback(() => api.orgBranding(slug), [slug]);
  const branding = useResource(loadBranding);

  const loadNotes = useCallback(() => api.myNotes(slug), [slug]);
  const notes = useResource(loadNotes);

  const [shared, setShared] = useState(membership.share_results);

  async function setSharing(next: boolean) {
    setBusy(true);
    setFailure(null);
    try {
      const row = await api.setSharing(slug, next);
      setShared(row.share_results);
      notes.reload();
      toast.success(next ? "Your portal can now see your finished reports." : "Your results are private again.");
    } catch (caught) {
      setFailure(caught instanceof ApiError ? caught.message : t("Something went wrong."));
    } finally {
      setBusy(false);
    }
  }

  async function leave() {
    setLeaving(true);
    setFailure(null);
    try {
      await api.leavePortal(slug);
      setShowLeave(false);
      toast.success(`You have left ${membership.name}. Nothing you wrote was deleted.`);
      onLeft();
    } catch (caught) {
      setFailure(caught instanceof ApiError ? caught.message : t("Something went wrong."));
      setShowLeave(false);
    } finally {
      setLeaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <CardHeader
          title={branding.data?.portal_title || membership.name}
          description={
            branding.data?.welcome_note ??
            "This portal has not written a note for its members."
          }
          action={
            <Badge tone="brand">
              {membership.org_role === "parent" ? t("Parent account") : t("Student account")}
            </Badge>
          }
        />
        {branding.state === "error" && !branding.data ? (
          <p className="text-xs text-danger">{branding.error}</p>
        ) : null}
      </Card>

      <Card className="space-y-4">
        <Toggle
          checked={shared}
          disabled={busy}
          onChange={(next) => void setSharing(next)}
          label={t("Let this portal see my finished reports")}
          description={t("Off by default. Turning it on shows the counts and the report this portal invited you to; your conversations and your drafts stay yours.")}
        />
        {failure ? (
          <p role="alert" className="text-sm text-danger">
            {failure}
          </p>
        ) : null}
      </Card>

      <Card className="space-y-3">
        <CardHeader
          title="Notes your counsellor sent you"
          description="Only the notes somebody chose to share. A note that was never sent does not appear here, and it cannot be made to."
          icon={<HeartHandshake className="h-5 w-5" aria-hidden />}
        />
        {notes.state === "loading" && !notes.data ? <LoadingPanel label="Loading" /> : null}
        {notes.data && notes.data.length === 0 ? (
          <p className="text-sm text-muted">
            {t("Nobody has shared a note with you here yet.")}
          </p>
        ) : null}
        {notes.data
          ? notes.data.map((note) => (
              <div key={note.id} className="rounded-xl border border-line bg-canvas/50 p-4">
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-ink">{note.body}</p>
                <p className="mt-2 text-xs text-muted">
                  {note.author_label ? `${note.author_label} · ` : ""}
                  {new Date(note.created_at).toLocaleDateString()}
                </p>
              </div>
            ))
          : null}
      </Card>

      <Card className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-md text-sm text-muted">
          {t("Leaving closes your place here. Your account, your answers and your reports are untouched.")}
        </p>
        <Button variant="outline" onClick={() => setShowLeave(true)}>
          <DoorOpen className="h-4 w-4" aria-hidden />
          {t("Leave this portal")}
        </Button>
      </Card>

      <Modal
        open={showLeave}
        onClose={() => setShowLeave(false)}
        title="Leave this portal?"
        description={`You will stop appearing on ${membership.name}'s roster, and its staff will no longer see your place. Nothing you wrote is deleted.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowLeave(false)}>
              Stay
            </Button>
            <Button variant="danger" loading={leaving} onClick={() => void leave()}>
              Leave
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          You can come back only if the portal writes to your address again.
        </p>
      </Modal>
    </div>
  );
}
