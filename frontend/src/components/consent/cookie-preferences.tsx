"use client";

import { useState } from "react";
import Link from "next/link";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/field";
import { analyticsConfigured } from "@/components/analytics/Analytics";
import { useT } from "@/lib/i18n";
import {
  CONSENT_CATEGORIES,
  useCookieConsent,
  type ConsentCategory,
} from "@/lib/use-cookie-consent";

/**
 * The "Manage preferences" dialog.
 *
 * One of its four switches now controls something real: the analytics row is read
 * by `components/analytics/Analytics.tsx` before that component loads Google
 * Analytics or Microsoft Clarity, and switching it off again stops them and clears
 * what they stored. The other three — necessary, marketing, functional — are
 * stated on their rows as what this codebase does not have, because a preferences
 * panel that implies a marketing tag is running when none exists is a worse lie
 * than no panel at all. They still save: they are the answer a future script has
 * to read before it loads.
 */
export function CookiePreferences({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const { categories, saveCustom } = useCookieConsent();
  const [draft, setDraft] = useState<Record<ConsentCategory, boolean>>(categories);
  const measurementOn = analyticsConfigured();

  const ROWS: Record<ConsentCategory, { label: string; body: string }> = {
    necessary: {
      label: "Necessary",
      body: t(
        "A random student id, a session token and your language choice, kept in this browser. The app cannot run without them, so this one cannot be switched off.",
      ),
    },
    analytics: {
      label: "Analytics",
      body: measurementOn
        ? t(
            "Analytics on this site is two services, named: Google Analytics for page counts and Microsoft Clarity for how a public page is used. Neither loads on a student's screen, a parent's screen or the entry screens, whatever you choose here. Switching this off stops both and clears the identifiers they left in this browser.",
          )
        : t(
            "No analytics project is configured for this deployment, so nothing about how you use it is measured. Your answer here is still saved, and any analytics added later has to obey it.",
          ),
    },
    marketing: {
      label: "Marketing",
      body: t(
        "There is no advertising SDK, marketing tag or tracking pixel in this codebase, and no data is ever sold. This switch is saved for the same reason as the one above.",
      ),
    },
    functional: {
      label: "Functional",
      body: t(
        "Preferences that remember how the app behaves for you. Today the only one it keeps is the interface language, which is already counted under Necessary.",
      ),
    },
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("Storage preferences")}
      description={t("What this browser keeps, and what it does not.")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("Cancel")}
          </Button>
          <Button
            onClick={() => {
              saveCustom(draft);
              onClose();
            }}
          >
            {t("Save choices")}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {CONSENT_CATEGORIES.map((key) => (
          <Toggle
            key={key}
            label={t(ROWS[key].label)}
            description={ROWS[key].body}
            checked={key === "necessary" ? true : draft[key]}
            disabled={key === "necessary"}
            onChange={(next) => setDraft((current) => ({ ...current, [key]: next }))}
          />
        ))}
        <p className="text-xs leading-relaxed text-muted">
          {t(
            "The values this site keeps for itself are not cookies — they sit in your own browser's storage, and clearing the site's data removes them. If analytics is switched on for this deployment and you accept it, Google's and Clarity's own scripts add cookies of theirs to this browser, and switching the answer off removes those. On a deployment where the optional email sign-in is switched on, Clerk's library keeps its own session values here too, and only for the students who use it.",
          )}{" "}
          <Link className="text-brand underline-offset-2 hover:underline" href="/privacy#cookies">
            {t("Read the privacy policy")}
          </Link>
        </p>
      </div>
    </Modal>
  );
}
