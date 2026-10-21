"use client";

import { useCallback, useState } from "react";
import { EyeOff, Eye, NotebookPen, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, ErrorState, LoadingPanel } from "@/components/ui/feedback";
import { Modal } from "@/components/ui/modal";
import { Select, Textarea } from "@/components/ui/field";
import { api, ApiError } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { useResource } from "@/lib/use-resource";
import type { MemberRow, SessionNote } from "@/lib/types";

const MAX_BODY = 2000;

/**
 * A counsellor's own notes.
 *
 * The list is the practice's client list, which the server has already narrowed to the
 * people this counsellor may see — so an assignment that was never made shows an empty
 * list rather than the whole school. A note starts private, and the only way a family
 * reads one is the switch on it.
 */
export function NotesPanel({ slug, clients }: { slug: string; clients: MemberRow[] }) {
  const t = useT();
  const [clientId, setClientId] = useState<string>("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<SessionNote | null>(null);

  const load = useCallback(
    () => api.notes(slug, clientId === "" ? undefined : Number(clientId)),
    [slug, clientId],
  );
  const { state, data, error, reload } = useResource(load);

  const selected = clients.find((client) => String(client.id) === clientId) ?? null;

  async function write() {
    if (clientId === "" || body.trim().length < 3) return;
    setBusy(true);
    setFailure(null);
    try {
      await api.writeNote(slug, { client_membership_id: Number(clientId), body: body.trim().slice(0, MAX_BODY) });
      setBody("");
      reload();
    } catch (caught) {
      setFailure(caught instanceof ApiError ? caught.message : t("Something went wrong."));
    } finally {
      setBusy(false);
    }
  }

  async function share(note: SessionNote, next: boolean) {
    setFailure(null);
    try {
      await api.shareNote(slug, note.id, next);
      reload();
    } catch (caught) {
      setFailure(caught instanceof ApiError ? caught.message : t("Something went wrong."));
    }
  }

  async function destroy(note: SessionNote) {
    setFailure(null);
    try {
      await api.deleteNote(slug, note.id);
      setConfirming(null);
      reload();
    } catch (caught) {
      setFailure(caught instanceof ApiError ? caught.message : t("Something went wrong."));
      setConfirming(null);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-4">
        <CardHeader
          title="Write down what happened"
          description="What was discussed and what happens next. A student's transcript is not part of this field and does not arrive here — it stays in their own account."
          icon={<NotebookPen className="h-5 w-5" aria-hidden />}
        />

        {clients.length === 0 ? (
          <EmptyState
            title="No clients to write about yet"
            description="Nobody has joined this practice, or nobody who is yours to see. A note is written against a person who accepted an invitation."
          />
        ) : (
          <>
            <Select
              label={t("Client")}
              value={clientId}
              placeholder="Choose a client"
              options={clients.map((client) => ({
                value: String(client.id),
                // An unlabeled member is named by the day they joined rather than by their
                // row id. The id is still the option's value, because the note has to be
                // written against somebody specific; what a person reads should not be a
                // number from a table, and a counsellor who says "client 2" to a colleague
                // has described a database row, not a child.
                label: client.display_label
                  ? client.display_label
                  : client.joined_at
                    ? `${t("A member with no label")} · ${new Date(client.joined_at).toLocaleDateString()}`
                    : t("A member with no label"),
              }))}
              onChange={(event) => setClientId(event.target.value)}
              hint={t("The list is the members of this portal alone, and only those its own settings allow to be listed.")}
            />
            <Textarea
              label={t("Note")}
              rows={5}
              value={body}
              maxLength={MAX_BODY}
              disabled={clientId === ""}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Talked through the class 10 streams. Arjun wants to see a physical-therapy college before deciding."
              hint={`${body.trim().length} / ${MAX_BODY}`}
            />
            <Button onClick={() => void write()} loading={busy} disabled={clientId === "" || body.trim().length < 3}>
              {t("Save note")}
            </Button>
          </>
        )}
      </Card>

      {failure ? (
        <p role="alert" className="rounded-xl border border-danger/25 bg-danger-mist/60 px-4 py-3 text-sm text-danger">
          {failure}
        </p>
      ) : null}

      {state === "loading" && !data ? <LoadingPanel label="Loading your notes" /> : null}
      {state === "error" && !data ? (
        <ErrorState description={error} onRetry={reload} retryLabel="Try again" />
      ) : null}

      {data && data.length === 0 ? (
        <Card className="py-8 text-center text-sm text-muted">
          {clientId === ""
            ? "You have not written a note yet. Notes you write appear here newest first."
            : `${selected?.display_label ?? "This client"} has no note yet.`}
        </Card>
      ) : null}

      {data
        ? data.map((note) => (
            <Card key={note.id} className="space-y-3 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-ink">{note.body}</p>
                  <p className="mt-2 text-xs text-muted">
                    {note.author_label ? `${note.author_label} · ` : ""}
                    {new Date(note.created_at).toLocaleString()}
                    {note.edited_at ? " · edited" : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge tone={note.shared_with_family ? "success" : "neutral"}>
                    {note.shared_with_family ? t("Shared") : t("Private")}
                  </Badge>
                  <Button variant="ghost" size="sm" onClick={() => void share(note, !note.shared_with_family)}>
                    {note.shared_with_family ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
                    {note.shared_with_family ? t("Unshare") : t("Share")}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirming(note)}>
                    <Trash2 className="h-4 w-4" aria-hidden />
                    {t("Delete")}
                  </Button>
                </div>
              </div>
              {note.shared_with_family && note.shared_at ? (
                <p className="text-xs text-muted">
                  {t("The family has been able to read this since")} {new Date(note.shared_at).toLocaleDateString()}.
                </p>
              ) : null}
            </Card>
          ))
        : null}

      <Modal
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        title="Delete this note?"
        description="It goes at once, including for a family it was shared with. This cannot be undone."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(null)}>
              Keep it
            </Button>
            <Button variant="danger" onClick={() => confirming && void destroy(confirming)}>
              Delete
            </Button>
          </>
        }
      >
        <p className="whitespace-pre-wrap break-words text-sm text-muted">{confirming?.body.slice(0, 240)}</p>
      </Modal>
    </div>
  );
}
