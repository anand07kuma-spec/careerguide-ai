"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, PhoneMissed } from "lucide-react";
import { SignIn } from "@clerk/nextjs";
import { useSession as useClerkSession } from "@clerk/nextjs";
import { EmailSignInNotSwitchedOn } from "@/components/account/email-sign-in-off";
import { Card } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { ErrorState, LoadingPanel } from "@/components/ui/feedback";
import { ApiError, api } from "@/lib/api";
import { clerkEnabled } from "@/lib/clerk";
import { translate, useT } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import type { ClerkStatus } from "@/lib/types";

export default function ConnectRoute() {
  if (!clerkEnabled()) return <EmailSignInNotSwitchedOn />;
  return <ConnectPanel />;
}

/**
 * The way an email gets attached to the work already on this device.
 *
 * Order matters and it is the same order the backend enforces: Clerk proves who the
 * email is, this app's own bearer token proves which device account is being changed,
 * and only the server joins the two. So this page can neither create an account nor
 * reach anybody else's — at worst it refuses and says why.
 *
 * It signs in *here*, in a box on the page, instead of sending the student to /sign-in,
 * because /sign-in ends at /account/enter: that route opens an account the email is
 * already connected to, and right now it is connected to nothing.
 */
function ConnectPanel() {
  const t = useT();
  const { session: clerkSession, isLoaded } = useClerkSession();
  const { status: accountStatus } = useSession();
  const [linked, setLinked] = useState<ClerkStatus | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  // Once per sign-in: a re-render must not send the same link request twice.
  const started = useRef(false);

  const retry = useCallback(() => {
    started.current = false;
    setFailed(null);
    setAttempt((current) => current + 1);
  }, []);

  useEffect(() => {
    if (!isLoaded || started.current) return;
    // Our own session has to settle first: without a bearer token there is no
    // account here to attach an email to, and the request would only 401.
    if (accountStatus !== "ready" || !clerkSession) return;
    started.current = true;
    void (async () => {
      try {
        const credential = await clerkSession.getToken();
        if (!credential) {
          setFailed(
            translate(
              "Clerk did not hand over a session, so nothing was connected. Please try again.",
            ),
          );
          return;
        }
        setLinked(await api.clerkLink(credential));
      } catch (error) {
        setFailed(
          error instanceof ApiError
            ? error.message
            : translate("The server could not be reached. Nothing was changed on this account."),
        );
      }
    })();
  }, [accountStatus, attempt, clerkSession, isLoaded]);

  if (failed) {
    return (
      <main className="mx-auto w-full max-w-xl px-4 py-10">
        <ErrorState
          title="The email could not be connected"
          description={failed}
          onRetry={retry}
          extra={
            <LinkButton href="/app/settings" variant="outline" size="sm">
              {t("Back to settings")}
            </LinkButton>
          }
        />
      </main>
    );
  }

  if (accountStatus === "new-device" || accountStatus === "offline") {
    return (
      <main className="mx-auto w-full max-w-xl px-4 py-10">
        <Card className="space-y-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-warning-mist text-amber-700">
            <PhoneMissed className="h-5 w-5" aria-hidden />
          </span>
          <h1 className="text-lg font-semibold text-ink">
            {t("This browser has no work to attach an email to yet")}
          </h1>
          <p className="text-sm leading-relaxed text-muted">
            {t(
              "Connecting an email does not create an account — it labels the one already on this device, so the same conversations and saved careers can be opened elsewhere. Answer the first question to start, then come back here to add the email.",
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            <LinkButton href="/onboarding">{t("Start here")}</LinkButton>
            <LinkButton href="/app/settings" variant="outline">
              {t("Back to settings")}
            </LinkButton>
          </div>
        </Card>
      </main>
    );
  }

  if (linked) {
    return (
      <main className="mx-auto w-full max-w-xl px-4 py-10">
        <Card className="space-y-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-success-mist text-success">
            <CheckCircle2 className="h-5 w-5" aria-hidden />
          </span>
          <h1 className="text-lg font-semibold text-ink">{t("Email connected")}</h1>
          <p className="text-sm leading-relaxed text-muted">{linked.note}</p>
          <div className="flex flex-wrap gap-2">
            <LinkButton href="/app/settings" variant="outline">
              {t("Back to settings")}
            </LinkButton>
            <LinkButton href="/app/profile">{t("Open my profile")}</LinkButton>
          </div>
        </Card>
      </main>
    );
  }

  if (!isLoaded || accountStatus === "loading") {
    return (
      <main className="mx-auto w-full max-w-xl px-4 py-10">
        <LoadingPanel label={t("Checking your email sign-in…")} />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-xl space-y-4 px-4 py-10">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold tracking-tight text-ink">{t("Connect an email")}</h1>
        <LinkButton href="/app/settings" variant="ghost" size="sm">
          {t("Cancel")}
        </LinkButton>
      </div>
      <p className="text-sm leading-relaxed text-muted">
        {t(
          "Sign in with the email you want to use, or make one now. This only labels the work already on this device — it does not move anything, and nothing is deleted. Disconnecting it later returns you to exactly this screen's starting point.",
        )}
      </p>
      {clerkSession ? (
        <LoadingPanel label={t("Connecting your email to this account…")} />
      ) : (
        <div className="flex justify-center">
          <SignIn routing="hash" signUpUrl="/sign-up" fallbackRedirectUrl="/account/connect" />
        </div>
      )}
    </main>
  );
}
