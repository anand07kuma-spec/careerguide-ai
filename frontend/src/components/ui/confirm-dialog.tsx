"use client";

import type { ReactNode } from "react";
import { useT } from "@/lib/i18n";
import { Button } from "./button";
import { Modal } from "./modal";

export type ConfirmTone = "danger" | "primary";

function shown(t: (en: string) => string, value: ReactNode): ReactNode {
  return typeof value === "string" ? t(value) : value;
}

/**
 * A confirmation built on the shared Modal, so focus trapping, Escape and the
 * backdrop behave exactly like every other dialog in the app.
 *
 * It never performs the mutation itself: `onConfirm` is the calling screen's
 * action, and `busy` lets that screen keep the dialog open while it runs.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  children,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "danger",
  busy = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  confirmLabel?: ReactNode;
  cancelLabel?: ReactNode;
  tone?: ConfirmTone;
  busy?: boolean;
}) {
  const t = useT();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {shown(t, cancelLabel)}
          </Button>
          <Button
            variant={tone === "danger" ? "danger" : "primary"}
            onClick={onConfirm}
            loading={busy}
          >
            {shown(t, confirmLabel)}
          </Button>
        </>
      }
    >
      {children}
    </Modal>
  );
}
