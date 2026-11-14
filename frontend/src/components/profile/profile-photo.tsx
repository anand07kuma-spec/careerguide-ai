"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { AlertCircle, Camera, ImagePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/lib/api";
import { useT, useTf } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import type { User } from "@/lib/types";
import { useProfilePhoto } from "@/lib/use-profile-photo";
import { cn, initials } from "@/lib/utils";

/** Matches the server's ceiling, so an oversized pick is refused before it is sent.
 * The server checks again: this is a courtesy, not the rule. */
const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

type Busy = "upload" | "remove" | null;

function readableSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * Why a photo failed, in words that name what to do next.
 *
 * The server's own detail is written for an operator reading a log, so the status is
 * what a screen translates. Every message here ends by saying the saved photo has not
 * moved, because the one thing a student fears at that moment is that they broke it.
 */
function photoError(error: unknown, t: (en: string) => string): string {
  if (error instanceof ApiError) {
    if (error.status === 413)
      return t("That photo is larger than 5 MB. Choose a smaller one.");
    if (error.status === 415)
      return t("That file is not a JPEG, PNG or WebP photo. Choose one of those.");
    if (error.status === 422)
      return t("That picture could not be read. It may be damaged or too small — try another one.");
    if (error.status === 401)
      return t("Your session has ended. Sign in again before changing the photo.");
    if (error.status === 429)
      return t("A few photo saves in a minute is plenty. Wait a moment and try again — the saved photo has not changed.");
    if (error.status === 0)
      return t("The photo could not be sent. Check your connection and try again — the saved photo has not changed.");
  }
  return t("The photo could not be saved. The photo already on the account has not changed.");
}

/**
 * The portrait circle itself. Shared so the tappable wrapper and the plain one
 * are the same picture at the same size, and the camera badge overlaps the edge.
 */
function ProfilePhoto({
  user,
  photoUrl,
  loading,
}: {
  user: User | null;
  photoUrl: string | null;
  loading: boolean;
}) {
  const tf = useTf();
  return (
    <span
      className={cn(
        "block h-[8.25rem] w-[8.25rem] overflow-hidden rounded-full border-[3px] border-white/80 bg-white/10 text-4xl font-semibold tracking-wide text-white shadow-[0_0_0_6px_rgb(41_149_255/0.18),0_0_34px_rgb(41_149_255/0.35)] sm:h-[9.25rem] sm:w-[9.25rem] sm:text-5xl lg:h-32 lg:w-32 xl:h-[9.75rem] xl:w-[9.75rem]",
        loading && "animate-pulse",
      )}
      aria-busy={loading || undefined}
    >
      {photoUrl ? (
        // An object URL for one page load cannot be optimised by an image loader,
        // and it is already resized to 512px by the server before it arrives.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl}
          alt={tf("{name}'s profile photo", { name: user?.display_name ?? "" })}
          className="h-full w-full object-cover"
        />
      ) : (
        <span
          aria-hidden
          className="flex h-full w-full items-center justify-center bg-[linear-gradient(145deg,rgb(31_65_132/0.95),rgb(9_25_63/0.95))]"
        >
          {initials(user?.display_name)}
        </span>
      )}
    </span>
  );
}

function checkFile(file: File, t: (en: string) => string): string | null {
  if (file.size > MAX_BYTES) return t("That photo is larger than 5 MB. Choose a smaller one.");
  // An empty type is left to the server: some devices hand a valid picture over with no
  // label at all, and guessing "not an image" from that would refuse a working file.
  if (file.type && !ACCEPTED.includes(file.type))
    return t("That file is not a JPEG, PNG or WebP photo. Choose one of those.");
  return null;
}

/**
 * The large picture at the head of the profile, and everything that changes it.
 *
 * The saved bytes are fetched through the session rather than read from a public
 * address, so the image is held as an object URL for as long as this screen is open.
 * Both the hero and the sidebar read through `useProfilePhoto`, which is why a save
 * updates the face in the column at the same moment it updates this one.
 *
 * The picker lives here rather than on the page so there is one owner for it. The
 * camera badge is the only visible control: it opens the picker. When a photo is
 * already saved, tapping the picture opens a small dialog that offers the same
 * picker and the way to remove it, so no text buttons crowd the hero.
 */
export function ProfilePhotoControls({ user }: { user: User | null }) {
  const t = useT();
  const tf = useTf();
  const toast = useToast();
  const { profile, reload } = useSession();

  const photoKey = profile?.profile_photo_url ?? null;
  const hasPhoto = Boolean(photoKey);
  const { url: photoUrl, loading: photoLoading } = useProfilePhoto(photoKey);

  const [actionsOpen, setActionsOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selected, setSelected] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewBroken, setPreviewBroken] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Busy>(null);

  const previewRef = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(
    () => () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    },
    [],
  );

  function clearPreview() {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = null;
    setPreviewUrl(null);
    setPreviewBroken(false);
    setSelected(null);
  }

  function pick() {
    if (busy) return;
    setError(null);
    inputRef.current?.click();
  }

  // Both of these run inside the dialog's own click, so the picker still opens as
  // a direct answer to the press rather than a deferred one a browser may ignore.
  function pickFromActions() {
    setActionsOpen(false);
    pick();
  }

  function removeFromActions() {
    setActionsOpen(false);
    setConfirmOpen(true);
  }

  function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Clearing the control lets the same picture be chosen again after a failure.
    event.target.value = "";
    if (!file) return;

    clearPreview();
    const problem = checkFile(file, t);
    if (problem) {
      setError(problem);
      setDialogOpen(true);
      return;
    }
    const url = URL.createObjectURL(file);
    previewRef.current = url;
    setPreviewUrl(url);
    setPreviewBroken(false);
    setSelected(file);
    setError(null);
    setDialogOpen(true);
  }

  function closeDialog() {
    if (busy) return;
    clearPreview();
    setError(null);
    setDialogOpen(false);
  }

  async function save() {
    if (!selected || busy) return;
    setBusy("upload");
    setError(null);
    try {
      await api.uploadProfilePhoto(selected);
      clearPreview();
      setDialogOpen(false);
      await reload();
      toast.success("Your photo is saved.");
    } catch (failure) {
      // The dialog stays open on the picture just picked, so a retry does not mean
      // finding it on the device again. The saved photo is untouched either way.
      setError(photoError(failure, t));
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (busy) return;
    setBusy("remove");
    try {
      await api.removeProfilePhoto();
      setConfirmOpen(false);
      await reload();
      toast.success("Your photo is removed. Your initials show in its place.");
    } catch (failure) {
      setConfirmOpen(false);
      toast.error(photoError(failure, t));
    } finally {
      setBusy(null);
    }
  }

  const label = hasPhoto ? t("Change profile photo") : t("Add profile photo");

  return (
    <div className="shrink-0">
      <div className="relative mx-auto w-fit">
        {hasPhoto ? (
          <button
            type="button"
            onClick={() => setActionsOpen(true)}
            aria-label={t("Profile photo options")}
            aria-haspopup="dialog"
            className="block rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
          >
            <ProfilePhoto user={user} photoUrl={photoUrl} loading={photoLoading} />
          </button>
        ) : (
          <ProfilePhoto user={user} photoUrl={photoUrl} loading={photoLoading} />
        )}

        <button
          type="button"
          onClick={pick}
          disabled={busy !== null}
          aria-label={label}
          title={label}
          className="absolute bottom-0.5 right-0.5 flex h-10 w-10 items-center justify-center rounded-full border-[3px] border-white/85 bg-profile-accent-solid text-white shadow-lift transition-colors hover:bg-profile-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-60 sm:h-11 sm:w-11"
        >
          <Camera className="h-[18px] w-[18px]" aria-hidden />
        </button>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED.join(",")}
          onChange={onFile}
          tabIndex={-1}
          aria-label={label}
          className="sr-only"
        />
      </div>

      <Modal
        open={actionsOpen}
        onClose={() => {
          if (!busy) setActionsOpen(false);
        }}
        title="Profile photo"
        description="Change the picture or remove it. Your initials show when there is no photo."
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setActionsOpen(false)} disabled={busy !== null}>
              {t("Keep photo")}
            </Button>
            <Button onClick={pickFromActions} disabled={busy !== null}>
              {t("Change photo")}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="mx-auto h-[8.5rem] w-[8.5rem] overflow-hidden rounded-full border-[3px] border-profile-line bg-canvas">
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoUrl}
                alt={tf("{name}'s profile photo", { name: user?.display_name ?? "" })}
                className="h-full w-full object-cover"
              />
            ) : (
              <span
                aria-hidden
                className="flex h-full w-full items-center justify-center text-3xl font-semibold text-profile-muted"
              >
                {initials(user?.display_name)}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={removeFromActions}
            disabled={busy !== null}
            className="mx-auto flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-danger transition-colors hover:bg-danger-mist focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Trash2 className="h-4 w-4 shrink-0" aria-hidden />
            {busy === "remove" ? t("Removing…") : t("Remove photo")}
          </button>
        </div>
      </Modal>

      <Modal
        open={dialogOpen}
        onClose={closeDialog}
        title={hasPhoto ? "Change profile photo" : "Add a profile photo"}
        description="Pick a picture that shows you. It appears beside your name on this page."
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={closeDialog} disabled={busy === "upload"}>
              {t("Cancel")}
            </Button>
            <Button
              onClick={save}
              loading={busy === "upload"}
              disabled={!selected || busy !== null}
            >
              {busy === "upload" ? t("Saving photo…") : t("Save photo")}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="relative mx-auto aspect-square w-full max-w-[15rem] overflow-hidden rounded-2xl border border-line bg-canvas">
            {previewUrl && !previewBroken ? (
              // The picture is still on this device; there is nothing for a loader to fetch.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt={t("The photo you selected")}
                onError={() => setPreviewBroken(true)}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-muted">
                <ImagePlus className="h-8 w-8" aria-hidden />
                <span className="text-sm">
                  {previewUrl
                    ? t("This picture cannot be shown. It may be damaged.")
                    : t("Choose a photo from this device.")}
                </span>
              </div>
            )}
          </div>

          {selected ? (
            <p className="break-all text-center text-xs text-muted">
              {selected.name} · {readableSize(selected.size)}
            </p>
          ) : null}

          {error ? (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger-mist px-3 py-2 text-sm text-danger"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span className="min-w-0">{error}</span>
            </p>
          ) : null}

          <ul className="space-y-1 text-xs leading-relaxed text-muted">
            <li>{t("JPEG, PNG or WebP, up to 5 MB.")}</li>
            <li>{t("A square picture looks best — the app centres and crops it for you.")}</li>
            <li>{t("Details hidden in the file, like where it was taken, are removed before it is saved.")}</li>
          </ul>

          <Button variant="outline" size="sm" onClick={pick} disabled={busy === "upload"}>
            {t("Choose another picture")}
          </Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => {
          if (busy !== "remove") setConfirmOpen(false);
        }}
        onConfirm={remove}
        title="Remove your profile photo?"
        description="Your initials will show beside your name instead. You can add another photo at any time."
        confirmLabel="Remove photo"
        cancelLabel="Keep photo"
        tone="danger"
        busy={busy === "remove"}
      />
    </div>
  );
}
