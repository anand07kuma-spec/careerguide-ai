"use client";

import { useCallback, useEffect, useState } from "react";
import {
  EyeOff,
  Fingerprint,
  Info,
  KeyRound,
  LogOut,
  MonitorSmartphone,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import type { SignInMethods } from "@/lib/types";
import {
  DetailNote,
  SettingsCard,
  SettingsItem,
  StatusPill,
} from "./settings-page-shell";
import { messageFor } from "./settings-shared";

/** The browser's own name for itself, read only after the page is running so the
 * server-rendered HTML never has to guess what the visitor is holding. */
function describeBrowser(): { browser: string; platform: string } | null {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua)
    ? "Microsoft Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Chrome\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : null;
  const platform = /Android/.test(ua)
    ? "Android"
    : /iPhone|iPad|iPod/.test(ua)
      ? "iOS"
      : /Windows/.test(ua)
        ? "Windows"
        : /Mac OS X/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : null;
  if (!browser && !platform) return null;
  return { browser: browser ?? "A browser", platform: platform ?? "this device" };
}

export function DeviceSettings() {
  const { startOver, signOut } = useSession();
  const { toast } = useToast();
  const t = useT();
  const [resetModal, setResetModal] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [signOutModal, setSignOutModal] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [device, setDevice] = useState<{ browser: string; platform: string } | null>(null);
  const [signIn, setSignIn] = useState<SignInMethods | null>(null);
  const [methodsReady, setMethodsReady] = useState(false);

  useEffect(() => {
    // Both readings are about the browser this page is running in, so they happen
    // after the first paint rather than being guessed on the server.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDevice(describeBrowser());
  }, []);

  const loadWaysBack = useCallback(async () => {
    const methods = await api.signInMethods().catch(() => null);
    setSignIn(methods);
    setMethodsReady(true);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadWaysBack();
  }, [loadWaysBack]);

  const googleLinked = signIn?.google ?? false;
  const emailLinked = signIn?.email ?? false;
  const canReturn = googleLinked || emailLinked;
  /** Only warn once the server has actually said how else this account opens. */
  const strands = methodsReady && !canReturn;
  const waysBack = [
    googleLinked ? t("signing in with Google") : null,
    emailLinked ? t("signing in with your email and password") : null,
  ]
    .filter(Boolean)
    .join(` ${t("or")} `);

  const doSignOut = useCallback(async () => {
    setSigningOut(true);
    setSignOutError(null);
    try {
      await signOut();
      window.location.replace("/login");
    } catch (error) {
      setSignOutError(messageFor(error));
      setSigningOut(false);
    }
  }, [signOut]);

  const doStartOver = async () => {
    setResetting(true);
    try {
      await startOver();
      // The route guard sends an unknown device to the one question; nothing here
      // has to be torn down by hand.
    } catch {
      setResetting(false);
      setResetModal(false);
      toast("The server could not be asked to forget this device. Try again in a moment.", "error");
    }
  };

  return (
    <>
      <div className="space-y-4">
        <SettingsCard
          icon={MonitorSmartphone}
          tone="bg-tile-blue text-on-tile-blue"
          title="Current Device"
          description="What this page can see about the browser it is running in."
          bodyClassName="divide-y divide-settings-line"
        >
          <SettingsItem
            title="Browser"
            description="The name the browser reports for itself. A site cannot read the model of your phone."
          >
            <p className="text-sm font-medium text-ink">{device?.browser ?? t("This browser")}</p>
          </SettingsItem>
          <SettingsItem title="System">
            <p className="text-sm font-medium text-ink">{device?.platform ?? t("This device")}</p>
          </SettingsItem>
          <SettingsItem
            title="Session"
            description="Held in a cookie this page's scripts cannot read, so nothing here can be copied out by another script."
          >
            <StatusPill tone="success">{t("Active")}</StatusPill>
          </SettingsItem>
        </SettingsCard>

        <SettingsCard
          icon={Fingerprint}
          tone="bg-tile-lavender text-on-tile-lavender"
          title="Remembered Browser"
          description="How this browser is found again the next time you open the site."
          bodyClassName="divide-y divide-settings-line"
        >
          <SettingsItem
            title="Remembered"
            description="The first time this site was opened here, the browser made up a long random number and kept it in its own storage. The server files your work under that number."
          >
            <StatusPill tone="success">{t("Yes — this browser")}</StatusPill>
          </SettingsItem>
          <SettingsItem
            title="Speaking sign-in preference"
            description="There is no per-browser preference to set yet: signing in with Google or an email and password is chosen on the log-in page each time."
          >
            <StatusPill tone="neutral">{t("Not available yet")}</StatusPill>
          </SettingsItem>
          <div className="px-5 py-4 sm:px-6">
            <DetailNote>
              {t(
                "The number is not a name, an email or a password, so there is nothing to remember, write down or lose. Clearing site data, a private window or a different device starts a brand-new account unless one of those sign-in methods is used.",
              )}
            </DetailNote>
          </div>
        </SettingsCard>

        <SettingsCard
          icon={ShieldCheck}
          tone="bg-tile-mint text-on-tile-mint"
          title="Security"
          description="Ending this browser's access, and what each step actually does."
          bodyClassName="divide-y divide-settings-line"
        >
          <SettingsItem
            title="Sign out of this browser"
            description="Ends this session on the server and forgets this browser. The account itself stays; Google, or your email and password, is how you open it again. It does not sign you out of Google on this device."
          >
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setSignOutError(null);
                setSignOutModal(true);
              }}
            >
              <LogOut className="h-4 w-4" aria-hidden />
              {t("Sign out")}
            </Button>
          </SettingsItem>
          <SettingsItem
            title="Active sessions"
            description="Only this browser is listed. The server ends a session when you sign out, but it does not publish a per-device list yet, so no other device is invented here."
          >
            <StatusPill tone="neutral">{t("This browser only")}</StatusPill>
          </SettingsItem>
          <SettingsItem
            title="Starting over"
            description="Gives this browser a new identity and stops the current session on the server right away. It deletes nothing by itself — clear conversations from Privacy & Consent first if that is the goal."
          >
            <Button variant="outline" size="sm" onClick={() => setResetModal(true)}>
              <RotateCcw className="h-4 w-4" aria-hidden />
              {t("Start over on this device")}
            </Button>
          </SettingsItem>
        </SettingsCard>

        <SettingsCard
          icon={KeyRound}
          tone="bg-tile-peach text-on-tile-peach"
          title="Account Access"
          description="How this browser remembers the account, and where that memory ends."
        >
          <ul className="divide-y divide-settings-line">
            <li className="flex gap-2.5 px-5 py-4 text-xs leading-relaxed text-muted sm:px-6">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal" aria-hidden />
              <span>
                {t(
                  "Same phone or laptop, same browser: your conversations, saved careers and settings are waiting when you come back.",
                )}
              </span>
            </li>
            <li className="flex gap-2.5 px-5 py-4 text-xs leading-relaxed text-muted sm:px-6">
              <EyeOff className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal" aria-hidden />
              <span>
                {t(
                  "A different device, a private window, or cleared site data starts a brand-new account unless you sign in with Google or with your email and password. Please do not use a shared or public computer for work you want to keep.",
                )}
              </span>
            </li>
            <li className="flex gap-2.5 px-5 py-4 text-xs leading-relaxed text-muted sm:px-6">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal" aria-hidden />
              <span>
                {t(
                  "If you sign in with Google, the server also keeps Google's verified identifier for this account; it still stores no email address from it.",
                )}
              </span>
            </li>
          </ul>
        </SettingsCard>
      </div>

      <Modal
        open={signOutModal}
        onClose={() => !signingOut && setSignOutModal(false)}
        title={strands ? t("This browser is the only way back") : t("Sign out of this browser?")}
        description={
          strands
            ? t("This account has no Google sign-in and no email sign-in.")
            : t("The account is kept. Only this browser's session ends.")
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setSignOutModal(false)} disabled={signingOut}>
              {t("Keep me signed in")}
            </Button>
            <Button
              variant={strands ? "danger" : "secondary"}
              loading={signingOut}
              onClick={() => void doSignOut()}
            >
              <LogOut className="h-4 w-4" aria-hidden />
              {strands ? t("Sign out anyway") : t("Sign out")}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm leading-relaxed text-muted">
            {strands
              ? t(
                  "This browser holds the account's identity. Signing out forgets it, and without Google or an email there is nothing to bring this work back. The work itself is not deleted either way — it is only the way back that would be lost.",
                )
              : `${t("You can return to this work by")} ${waysBack}. ${t(
                  "This ends the app session on the server; it does not sign you out of Google itself, or of any other site.",
                )}`}
          </p>
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

      <Modal
        open={resetModal}
        onClose={() => !resetting && setResetModal(false)}
        title={t("Start over on this device?")}
        description={t("This browser will be treated as somebody who has never been here.")}
        footer={
          <>
            <Button variant="outline" onClick={() => setResetModal(false)} disabled={resetting}>
              {t("Keep my work")}
            </Button>
            <Button variant="danger" loading={resetting} onClick={() => void doStartOver()}>
              {t("Start over")}
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-muted">
          {t(
            "You will be taken back to the one question, and whatever is in this session now will not be reachable from this browser again. If the goal is a clean slate for the messages rather than a new student, delete the conversation history in the privacy section instead.",
          )}
        </p>
      </Modal>
    </>
  );
}
