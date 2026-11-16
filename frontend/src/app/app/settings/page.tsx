"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  ChevronRight,
  Globe,
  Lock,
  LogOut,
  MonitorSmartphone,
  ShieldCheck,
  Trash2,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { messageFor } from "@/components/settings/settings-shared";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import type { SignInMethods } from "@/lib/types";

/**
 * The Settings landing is a directory, not a control panel: each row is a real
 * route under /app/settings, so a section can be linked to, reloaded and reached
 * with the browser's back button. The rows sit directly on the page surface at
 * the same content boundary as the seven detail pages — no card holds them.
 */
const ROWS: {
  href: string;
  icon: LucideIcon;
  tone: string;
  title: string;
  description: string;
}[] = [
  {
    href: "/app/settings/language",
    icon: Globe,
    tone: "bg-tile-lavender text-on-tile-lavender",
    title: "Language & Voice",
    description: "Manage your preferred language and voice.",
  },
  {
    href: "/app/settings/profile",
    icon: UserRound,
    tone: "bg-tile-blue text-on-tile-blue",
    title: "My Profile",
    description: "Update your personal information and interests.",
  },
  {
    href: "/app/settings/account",
    icon: Lock,
    tone: "bg-tile-mint text-on-tile-mint",
    title: "Account & Sign-in",
    description: "Manage your account and login security.",
  },
  {
    href: "/app/settings/privacy",
    icon: ShieldCheck,
    tone: "bg-tile-green text-on-tile-green",
    title: "Privacy & Consent",
    description: "Control your personal data and privacy.",
  },
  {
    href: "/app/settings/family",
    icon: Users,
    tone: "bg-tile-peach text-on-tile-peach",
    title: "Family Access",
    description: "Manage parent or guardian access.",
  },
  {
    href: "/app/settings/device",
    icon: MonitorSmartphone,
    tone: "bg-tile-slate text-on-tile-slate",
    title: "This Device",
    description: "Manage your current device and browser.",
  },
  {
    href: "/app/settings/about",
    icon: BookOpen,
    tone: "bg-tile-yellow text-on-tile-yellow",
    title: "About CareerGuide AI",
    description: "Learn about the platform, features and support.",
  },
];

/** One full-width row. The negative gutter lets the hover reach the content
 * edges while the text stays on the same left line as the page heading. */
const ROW_BASE =
  "group flex min-h-16 items-center gap-4 rounded-xl px-3 py-4 text-left transition-colors hover:bg-settings-hover focus-visible:bg-settings-hover focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand sm:py-5";
const ROW = `-mx-3 ${ROW_BASE} w-auto`;

/** The two closing actions continue the list as ordinary rows: same height, padding,
 * hover and dividers, Delete first and Sign out last. Their button fills a gutter
 * wrapper, because a button takes its width from its own content, not its container. */
const ACTION_ROW = `${ROW_BASE} w-full`;

type Ways = {
  signIn: SignInMethods | null;
};

/** A failed check means "unknown", never "no way back". */
async function readWays(): Promise<Ways> {
  try {
    return { signIn: await api.signInMethods() };
  } catch {
    return { signIn: null };
  }
}

export default function SettingsPage() {
  const t = useT();
  const { isStudent, signOut, startOver } = useSession();
  const rows = isStudent ? ROWS : ROWS.filter((row) => row.href !== "/app/settings/family");

  const [signOutModal, setSignOutModal] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [ways, setWays] = useState<Ways>({ signIn: null });
  const [checkingWays, setCheckingWays] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState("");

  // Whether this account can be opened again after signing out decides what the
  // confirmation is allowed to promise. It comes from the server, never a guess.
  useEffect(() => {
    let live = true;
    void readWays().then((next) => {
      if (live) setWays(next);
    });
    return () => {
      live = false;
    };
  }, []);

  // Without this, a check that never answers would leave Sign out switched off for
  // as long as the dialog stays open, since the dialog never promises a way back
  // it has not seen.
  const checkAgain = () => {
    setCheckingWays(true);
    void readWays().then((next) => {
      setWays(next);
      setCheckingWays(false);
    });
  };

  const doSignOut = useCallback(async () => {
    setSigningOut(true);
    setSignOutError(null);
    try {
      await signOut();
      // A full navigation, not a route change: the shell this page sits in redirects a
      // browser with no session the moment the provider forgets the user, and that
      // redirect would win the race against a client-side replace.
      window.location.replace("/login");
    } catch (error) {
      setSignOutError(messageFor(error));
      setSigningOut(false);
    }
  }, [signOut]);

  const doDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.deleteAccount();
      // The server has already ended every session. Forgetting this browser's identity
      // too stops the next visit from asking about an account that no longer exists.
      try {
        await startOver();
      } finally {
        window.location.replace("/");
      }
    } catch (error) {
      setDeleteError(messageFor(error));
      setDeleting(false);
    }
  };

  const googleLinked = ways.signIn?.google ?? false;
  const emailLinked = ways.signIn?.email ?? false;
  const canReturn = googleLinked || emailLinked;
  const waysKnown = ways.signIn !== null;
  /** Only warn about losing the way back once the server has actually said so. */
  const signOutStrands = waysKnown && !canReturn;

  const openSignOut = () => {
    setSignOutError(null);
    setSignOutModal(true);
  };

  const openDelete = () => {
    setConfirmation("");
    setDeleteError(null);
    setDeleteModal(true);
  };

  const closeDelete = () => {
    if (deleting) return;
    setDeleteModal(false);
    setConfirmation("");
    setDeleteError(null);
  };

  return (
    <div className="mx-auto w-full max-w-[1120px] px-4 py-8 sm:px-6 sm:py-12">
      <header>
        <p className="text-2xs font-semibold uppercase tracking-[0.18em] text-muted">
          {isStudent ? t("Student account") : t("Parent account")}
        </p>
        <h1 className="mt-2 font-serif text-[2rem] leading-[1.1] tracking-tight text-heading sm:text-[2.6rem]">
          {t("Settings")}
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
          {t("Manage your account and preferences in one place.")}
        </p>
      </header>

      <nav aria-label={t("Settings sections")} className="mt-8">
        <ul className="divide-y divide-settings-line border-y border-settings-line">
          {rows.map((row) => {
            const Icon = row.icon;
            return (
              <li key={row.href}>
                <Link href={row.href} className={ROW}>
                  <span
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${row.tone}`}
                  >
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold leading-snug tracking-[-0.01em] text-ink">
                      {t(row.title)}
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-muted sm:text-[13px]">
                      {t(row.description)}
                    </span>
                  </span>
                  <ChevronRight
                    className="h-4 w-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <ul className="divide-y divide-settings-line border-b border-settings-line">
        <li>
          <div className="-mx-3">
            <button type="button" onClick={openDelete} className={ACTION_ROW} aria-haspopup="dialog">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-danger-mist text-danger">
                <Trash2 className="h-5 w-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold leading-snug tracking-[-0.01em] text-ink">
                  {t("Delete account")}
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-muted sm:text-[13px]">
                  {t("Permanently erase this account and everything on it. This cannot be undone.")}
                </span>
              </span>
              <ChevronRight
                className="h-4 w-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </button>
          </div>
        </li>
        <li>
          <div className="-mx-3">
            <button
              type="button"
              onClick={openSignOut}
              className={ACTION_ROW}
              aria-haspopup="dialog"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-subtle text-subtle-ink">
                <LogOut className="h-5 w-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold leading-snug tracking-[-0.01em] text-ink">
                  {t("Sign Out")}
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-muted sm:text-[13px]">
                  {t("Sign out of your CareerGuide AI account on this browser.")}
                </span>
              </span>
              <ChevronRight
                className="h-4 w-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </button>
          </div>
        </li>
      </ul>

      {/* Sign-out confirm. Signing out forgets this browser's identity, so for an
          account with no Google link and no email sign-in this dialog is the only
          warning that the work would become unreachable. */}
      <Modal
        open={signOutModal}
        onClose={() => !signingOut && setSignOutModal(false)}
        title={signOutStrands ? "This browser is the only way back" : "Sign out of this browser?"}
        description={
          signOutStrands
            ? "This account has no Google sign-in and no email sign-in."
            : canReturn
              ? "The account is kept. Only this browser's session ends."
              : "How else this account can be opened is not known yet."
        }
        footer={
          signOutStrands ? (
            <>
              <Button
                variant="outline"
                onClick={() => setSignOutModal(false)}
                disabled={signingOut}
              >
                {t("Keep me signed in")}
              </Button>
              <Button variant="danger" loading={signingOut} onClick={() => void doSignOut()}>
                <LogOut className="h-4 w-4" aria-hidden />
                {t("Sign out anyway")}
              </Button>
            </>
          ) : !waysKnown ? (
            <>
              <Button variant="outline" onClick={() => setSignOutModal(false)} disabled={signingOut}>
                {t("Keep me signed in")}
              </Button>
              <Button variant="secondary" loading={checkingWays} onClick={checkAgain}>
                {t("Check again")}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setSignOutModal(false)} disabled={signingOut}>
                {t("Keep me signed in")}
              </Button>
              <Button variant="secondary" loading={signingOut} onClick={() => void doSignOut()}>
                <LogOut className="h-4 w-4" aria-hidden />
                {t("Sign out")}
              </Button>
            </>
          )
        }
      >
        <div className="space-y-3">
          {signOutStrands ? (
            <p className="text-sm leading-relaxed text-muted">
              {t(
                "This browser holds the account's identity. Signing out forgets it, and without Google or an email and password nothing can bring this work back. The work itself is not deleted either way — it is only the way back that would be lost.",
              )}
            </p>
          ) : canReturn ? (
            <p className="text-sm leading-relaxed text-muted">
              {t("You can return to this work by")}{" "}
              {[
                googleLinked ? t("signing in with Google") : null,
                emailLinked ? t("signing in with your email and password") : null,
              ]
                .filter(Boolean)
                .join(t(" or "))}
              {t(
                ". This ends the app session on the server; it does not sign you out of Google itself, or of any other site.",
              )}
            </p>
          ) : (
            <p className="text-sm leading-relaxed text-muted">
              {t(
                "How else this account can be opened could not be checked yet. Signing out stays switched off until it can be, so the only way back into this work is not lost by accident.",
              )}
            </p>
          )}
          {signOutError ? (
            <p
              role="alert"
              className="rounded-card border border-danger/30 bg-danger-mist p-3 text-xs leading-relaxed text-ink"
            >
              {signOutError} {t("Nothing was signed out. Try again, or check your connection.")}
            </p>
          ) : null}
        </div>
      </Modal>

      {/* Deleting the account is separate from signing out: it erases the record rather
          than only the key to it. The lists name what goes and what stays before the
          typed confirmation turns the button on. */}
      <Modal
        open={deleteModal}
        onClose={closeDelete}
        size="lg"
        title={t("Delete this account for good?")}
        description={t(
          "There is no undo, and there is no email to confirm with: this browser's session is the only proof of whose account this is. That is why this dialog is the last step.",
        )}
        footer={
          <>
            <Button variant="outline" onClick={closeDelete} disabled={deleting}>
              {t("Keep my work")}
            </Button>
            <Button
              variant="danger"
              loading={deleting}
              disabled={confirmation !== "DELETE"}
              onClick={() => void doDelete()}
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              {t("Delete it")}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-muted">
            {t(
              "This erases what the server holds for this account and signs out every device. Nothing on it can be brought back afterwards.",
            )}
          </p>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink">
              {t("Gone from the database")}
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed text-muted">
              {[
                "Every conversation and every message in it, including anything you asked by voice.",
                "Your assessments: the sittings, the answers and the results scored from them.",
                "The reports — the career report and any PDF that was generated from it.",
                "Study plans, journey counts, interest observations, saved careers and recommendations.",
                "The resume you wrote — the job title, the class rows, the skills and projects, as one document.",
                "Your profile, your settings, every consent you recorded, and any family or portal link.",
                "Every session on every device, so a second laptop signed in to this account stops working too.",
              ].map((line) => (
                <li key={line}>{t(line)}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink">
              {t("Stays, and why")}
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed text-muted">
              {[
                "The record of a payment you made or were refunded. A money ledger has to outlive the person it is about.",
                "The operator log. This erasure is written in it, without your name attached.",
                "The row that used to be your account, holding nothing but the date it was erased on.",
              ].map((line) => (
                <li key={line}>{t(line)}</li>
              ))}
            </ul>
          </div>
          <p className="text-xs leading-relaxed text-muted">
            {t(
              "A parent account's children are not erased with it: only this account and the links to them go.",
            )}
          </p>
          <Input
            label={t("Type DELETE to confirm")}
            placeholder="DELETE"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            disabled={deleting}
          />
          {deleteError ? (
            <p
              role="alert"
              className="rounded-card border border-danger/30 bg-danger-mist p-3 text-xs leading-relaxed text-ink"
            >
              {deleteError}{" "}
              {t("Nothing was confirmed as deleted. Reload the page to see where the account stands.")}
            </p>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}
