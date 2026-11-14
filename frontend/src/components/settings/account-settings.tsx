"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BellOff,
  KeyRound,
  Lock,
  Mail,
  MonitorSmartphone,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { GoogleMark } from "@/components/account/google-login";
import { Button, LinkButton } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { clerkEnabled } from "@/lib/clerk";
import { deviceId } from "@/lib/device";
import { useT } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import type {
  ClerkStatus,
  GoogleStatus,
  SignInMethods,
} from "@/lib/types";
import { relativeTime } from "@/lib/utils";
import {
  DetailNote,
  SettingsCard,
  SettingsItem,
  StatusPill,
} from "./settings-page-shell";
import { initial, messageFor, type Resource } from "./settings-shared";

function memberSince(iso: string | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

export function AccountSettings() {
  const { user } = useSession();
  const { toast } = useToast();
  const t = useT();

  const [signIn, setSignIn] = useState<Resource<SignInMethods>>(initial);
  const [google, setGoogle] = useState<Resource<GoogleStatus>>(initial);
  const [clerk, setClerk] = useState<Resource<ClerkStatus>>(initial);
  const [disconnecting, setDisconnecting] = useState(false);

  const loadClerk = useCallback(async () => {
    try {
      setClerk({ state: "ready", data: await api.clerkStatus(), error: null });
    } catch (error) {
      setClerk({ state: "error", data: null, error: messageFor(error) });
    }
  }, []);

  /** What actually opens this account, as the server knows it — not as a page guesses. */
  const loadSignIn = useCallback(async () => {
    try {
      setSignIn({ state: "ready", data: await api.signInMethods(), error: null });
    } catch (error) {
      setSignIn({ state: "error", data: null, error: messageFor(error) });
    }
  }, []);

  /** Whether this deployment can offer Google at all, separately from whether it is linked. */
  const loadGoogle = useCallback(async () => {
    try {
      setGoogle({ state: "ready", data: await api.googleStatus(), error: null });
    } catch (error) {
      setGoogle({ state: "error", data: null, error: messageFor(error) });
    }
  }, []);

  useEffect(() => {
    // Fetching is the whole purpose of this effect, and every setState inside
    // those loaders happens after an await.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadClerk();
    void loadSignIn();
    void loadGoogle();
  }, [loadClerk, loadSignIn, loadGoogle]);

  const disconnectEmail = useCallback(async () => {
    setDisconnecting(true);
    try {
      setClerk({ state: "ready", data: await api.clerkUnlink(), error: null });
      toast("Email disconnected. This browser still opens your work exactly as before.", "success");
    } catch (error) {
      toast(messageFor(error), "error");
      void loadClerk();
    } finally {
      setDisconnecting(false);
    }
  }, [loadClerk, toast]);

  const googleLinked = signIn.data?.google ?? false;
  const googleReady = google.data?.configured ?? false;
  /** An address this account signs in with — the password it was created with, or
   * the email identity service, when that is connected. */
  const emailLinked = signIn.data?.email ?? false;

  return (
    <>
      <div className="space-y-4">
        <SettingsCard
          icon={UserRound}
          tone="bg-tile-blue text-on-tile-blue"
          title="Account Information"
          description="What this account is, and which door opens it on this device."
          action={
            <LinkButton href="/app/settings/profile" variant="outline" size="sm">
              {t("My Profile")}
            </LinkButton>
          }
          bodyClassName="divide-y divide-settings-line"
        >
          <SettingsItem title="Account type">
            <StatusPill tone="brand">
              {user?.role === "student" ? "Student" : "Parent"}
            </StatusPill>
          </SettingsItem>
          <SettingsItem title="Name" description="The name on this account. It is changed from My Profile.">
            <p className="text-sm font-medium text-ink">{user?.display_name ?? t("Not set")}</p>
          </SettingsItem>
          <SettingsItem
            title="Member since"
            description="When this account first opened on CareerGuide AI."
          >
            <p className="text-sm font-medium text-ink">
              {memberSince(user?.created_at) ?? t("Not recorded")}
            </p>
          </SettingsItem>
        </SettingsCard>

        <SettingsCard
          icon={Lock}
          tone="bg-tile-lavender text-on-tile-lavender"
          title="Sign-in Methods"
          description="Every door that opens this same account. None of them changes its role or moves its work."
          bodyClassName="divide-y divide-settings-line"
        >
          <SettingsItem
            title="This browser"
            description="The handshake that keeps this account open on this device. It never leaves this device."
          >
            <StatusPill tone="success">{t("Connected")}</StatusPill>
          </SettingsItem>

          <SettingsItem
            title={
              <span className="inline-flex items-center gap-1.5">
                <GoogleMark className="h-3.5 w-3.5" aria-hidden />
                {t("Google")}
              </span>
            }
            description={
              signIn.state === "loading"
                ? "Asking the server how this account opens…"
                : signIn.state === "error"
                  ? signIn.error
                  : googleLinked
                    ? "Signing in with Google on the log-in page opens this same account, with the same role and the same progress. The server keeps only Google's stable account identifier — no email address — and never matches accounts by email."
                    : emailLinked
                      ? "This account opens with the email and password you set, and with this browser. Connecting Google adds another verified way to open the same account from any device."
                      : "This account opens through this browser. Connecting Google adds a verified way to open the same account from another device."
            }
          >
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill tone={googleLinked ? "success" : "neutral"}>
                {signIn.state === "loading"
                  ? t("Checking…")
                  : googleLinked
                    ? t("Connected")
                    : t("Not connected")}
              </StatusPill>
              {!googleLinked && googleReady ? (
                <LinkButton href={api.googleStartUrl(null, deviceId())} size="sm">
                  <GoogleMark className="h-4 w-4" aria-hidden />
                  {t("Connect Google")}
                </LinkButton>
              ) : null}
            </div>
          </SettingsItem>

          {!googleLinked && google.state === "ready" && !google.data?.configured ? (
            <div className="px-5 py-4 sm:px-6">
              <DetailNote>
                {t(
                  "Google sign-in is not switched on for this deployment, so there is nothing to connect yet. The operator has to configure it on the server first.",
                )}
              </DetailNote>
            </div>
          ) : null}
          {googleLinked ? (
            <div className="px-5 py-4 sm:px-6">
              <DetailNote>
                {t(
                  "There is no separate button to disconnect Google yet. Adding it gives this account another way in from any device; it does not replace this browser.",
                )}
              </DetailNote>
            </div>
          ) : null}

          <SettingsItem
            title="Email and password"
            description={
              emailLinked
                ? "This account can be opened with the email and password you set on the log-in page."
                : "No email and password are set for this account. This browser is the way in."
            }
          >
            <StatusPill tone={emailLinked ? "success" : "neutral"}>
              {signIn.state === "loading"
                ? t("Checking…")
                : emailLinked
                  ? t("Connected")
                  : t("Not connected")}
            </StatusPill>
          </SettingsItem>

          <SettingsItem
            title="Second email identity"
            description={
              clerk.state === "loading"
                ? "Asking the server whether an email is connected…"
                : clerk.state === "error"
                  ? clerk.error
                  : clerk.data?.linked
                    ? clerk.data.note
                    : emailLinked
                      ? "This account already opens with the email and password you set, so this optional extra is not needed."
                      : clerk.data?.note
            }
          >
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill tone={clerk.data?.linked ? "success" : "neutral"}>
                {clerk.state === "loading"
                  ? t("Checking…")
                  : clerk.data?.linked
                    ? t("Connected")
                    : t("Not connected")}
              </StatusPill>
              {clerk.data?.linked && clerk.data.linked_at ? (
                <span className="text-xs text-muted">
                  {relativeTime(clerk.data.linked_at)}
                </span>
              ) : null}
              {clerkEnabled() && !clerk.data?.linked ? (
                <LinkButton href="/account/connect" size="sm">
                  <Mail className="h-4 w-4" aria-hidden />
                  {t("Connect an email")}
                </LinkButton>
              ) : null}
              {clerk.data?.linked ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void disconnectEmail()}
                  disabled={disconnecting}
                >
                  <KeyRound className="h-4 w-4" aria-hidden />
                  {disconnecting ? t("Disconnecting…") : t("Disconnect the email")}
                </Button>
              ) : null}
            </div>
          </SettingsItem>

          {!clerkEnabled() ? (
            <div className="px-5 py-4 sm:px-6">
              <DetailNote>
                {t(
                  "Connecting a second email identity is not switched on for this site, and that is the operator's choice, not yours: it needs both CLERK_SECRET_KEY on the backend and NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY on the frontend, plus a webhook pointed at POST /api/webhooks/clerk. Nothing you already use changes — this browser keeps your work, Google sign-in (where configured) is a separate way in, and an email and password you created still signs you in.",
                )}
              </DetailNote>
            </div>
          ) : null}
        </SettingsCard>

        <SettingsCard
          icon={ShieldCheck}
          tone="bg-tile-mint text-on-tile-mint"
          title="Password & Security"
          description="What this build can and cannot do about the password."
          bodyClassName="divide-y divide-settings-line"
        >
          <SettingsItem
            title="Change password"
            description="Changing the password while signed in is not available in this build. On the log-in page, Forgot password sends a reset link to the address this account signs in with, when an email sign-in exists."
          >
            <StatusPill tone="neutral">{t("Not available yet")}</StatusPill>
          </SettingsItem>
          <div className="px-5 py-4 sm:px-6">
            <DetailNote>
              {t(
                "Two-step verification, recovery phone numbers and security questions do not exist here. Nothing is stored that could be used to answer them, and a switch that pretended otherwise would be worse than none.",
              )}
            </DetailNote>
          </div>
        </SettingsCard>

        <SettingsCard
          icon={MonitorSmartphone}
          tone="bg-tile-slate text-on-tile-slate"
          title="Active Sessions"
          description="Where this account is open, as far as this build can see."
          bodyClassName="divide-y divide-settings-line"
        >
          <SettingsItem
            title="This browser"
            description="The only session this page can list. A per-device list is not published yet, so no other device is invented here."
          >
            <StatusPill tone="success">{t("Signed in")}</StatusPill>
          </SettingsItem>
        </SettingsCard>

        <SettingsCard
          icon={BellOff}
          tone="bg-tile-yellow text-on-tile-yellow"
          title="Not available yet"
          description="Things people often look for here, said plainly instead of shown as a switch that does nothing."
          bodyClassName="divide-y divide-settings-line"
        >
          <SettingsItem
            title="Notifications"
            description="Nothing in this app messages you, reminds you or rings you — you come to it when you want to. So there is no notification switch to offer, and no switch is hiding somewhere else."
          />
          <SettingsItem
            title="Export everything"
            description="The report PDF on your Reports page is the only export there is today. There is no button yet that hands over every conversation, every saved career and every answer at once."
          />
        </SettingsCard>
      </div>
    </>
  );
}
