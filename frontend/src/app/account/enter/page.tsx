"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MailWarning } from "lucide-react";
import { useSession as useClerkSession } from "@clerk/nextjs";
import { EmailSignInNotSwitchedOn } from "@/components/account/email-sign-in-off";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState, LoadingPanel } from "@/components/ui/feedback";
import { ApiError, api, setAuthToken } from "@/lib/api";
import { clerkEnabled } from "@/lib/clerk";
import { useSession } from "@/lib/session";
import { translate, useT } from "@/lib/i18n";

export default function EnterRoute() {
  if (!clerkEnabled()) return <EmailSignInNotSwitchedOn />;
  return <HandOver />;
}

/**
 * The one screen that turns an email sign-in into this app's own session.
 *
 * Clerk answers "this is user X"; the backend answers with a session for the account
 * that X was connected to, written as an `httpOnly` cookie. Until that session is in
 * hand this page has opened nothing, which is why it exists at all: the app never trusts
 * a Clerk session as authorisation, and a family that signed in by email continues on
 * exactly the same credential as a family that never did.
 */
function HandOver() {
  const t = useT();
  const router = useRouter();
  const { session: clerkSession, isLoaded } = useClerkSession();
  const { reload } = useSession();
  const [failed, setFailed] = useState<string | null>(null);
  // An effect that fires twice would ask the backend for two tokens for the same
  // sign-in, and the second one would win — harmless here, but it is the kind of
  // double request that hides a real bug in anything else.
  const started = useRef(false);

  useEffect(() => {
    if (!isLoaded || started.current) return;
    started.current = true;
    if (!clerkSession) return;
    void (async () => {
      try {
        const credential = await clerkSession.getToken();
        if (!credential) {
          setFailed(
            translate("Clerk did not hand over a session, so nothing was opened. Please sign in again."),
          );
          return;
        }
        const opened = await api.clerkEnter(credential);
        // The server has already written the session cookie with this reply; this is the
        // copy for the browsers that will not keep a cookie set across two origins. It
        // lives in memory for this page load and is never stored.
        setAuthToken(opened.token);
        // The provider still holds whatever this browser was doing a moment ago —
        // on a new device, nothing. Re-read it through the session just issued.
        await reload();
        router.replace("/app");
      } catch (error) {
        setFailed(
          error instanceof ApiError
            ? error.message
            : translate("Something went wrong while opening your work. Nothing was lost."),
        );
      }
    })();
  }, [isLoaded, clerkSession, reload, router]);

  if (failed) {
    return (
      <main className="mx-auto w-full max-w-xl px-4 py-10">
        <ErrorState
          title="Your email sign-in could not open anything"
          description={failed}
          onRetry={() => router.replace("/sign-in")}
          retryLabel="Sign in again"
          extra={
            <LinkButton href="/onboarding" variant="outline" size="sm">
              {t("Continue without an email")}
            </LinkButton>
          }
        />
      </main>
    );
  }

  if (!isLoaded) {
    return (
      <main className="mx-auto w-full max-w-xl px-4 py-10">
        <LoadingPanel label="Checking your email sign-in…" />
      </main>
    );
  }

  if (!clerkSession) {
    return (
      <main className="mx-auto w-full max-w-xl px-4 py-10">
        <Card className="space-y-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-mist text-brand-dark">
            <MailWarning className="h-5 w-5" aria-hidden />
          </span>
          <h1 className="text-lg font-semibold text-ink">{t("No email sign-in finished")}</h1>
          <p className="text-sm leading-relaxed text-muted">
            {t(
              "This page opens the work that belongs to the email you signed in with. Right now there is no email signed in here, so there is nothing to open — and nothing on this device was changed.",
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => router.replace("/sign-in")}>{t("Sign in with an email")}</Button>
            <LinkButton href="/onboarding" variant="outline">
              {t("Continue without an email")}
            </LinkButton>
          </div>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-10">
      <LoadingPanel label="Opening your work…" />
    </main>
  );
}
