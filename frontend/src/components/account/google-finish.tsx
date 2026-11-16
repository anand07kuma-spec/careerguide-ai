"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, ShieldCheck } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { Wordmark } from "@/components/brand";
import { Card } from "@/components/ui/card";
import { Button, LinkButton } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { useSession } from "@/lib/session";

/**
 * Where Google sends the browser back to, on this app's own origin.
 *
 * The callback on the API has already verified the identity and written a session
 * cookie. This page asks the app the one question every other screen asks — "who is
 * this browser?" — and then moves to the dashboard the *server's* role names. It does
 * not read a role from the URL, and it does not trust one it was handed.
 */
export function GoogleFinish() {
  const t = useT();
  const router = useRouter();
  const { status, isParent, reload } = useSession();

  useEffect(() => {
    if (status === "ready") router.replace(isParent ? "/parent" : "/app");
  }, [status, isParent, router]);

  const failed = status === "new-device";
  const offline = status === "offline";

  return (
    <div className="min-h-dvh bg-canvas">
      <SiteHeader width="focus" skipTo="#main-content" skipLabel={t("Skip to content")}>
        <Wordmark />
      </SiteHeader>
      <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-focus px-4 py-12 sm:px-6">
        <Card className="p-6 text-center sm:p-8">
          {failed ? (
            <>
              <span className="mx-auto inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-warning-mist text-ink">
                <AlertTriangle className="h-5 w-5" aria-hidden />
              </span>
              <h1 className="mt-4 text-xl font-semibold text-heading">
                {t("The sign-in finished, but this browser did not keep the session")}
              </h1>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
                {t(
                  "That usually means this browser blocks the cookie the server sets across origins. Try signing in again from the sign-in page.",
                )}
              </p>
              <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
                <LinkButton href="/login">{t("Try signing in again")}</LinkButton>
              </div>
            </>
          ) : offline ? (
            <>
              <span className="mx-auto inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-warning-mist text-ink">
                <AlertTriangle className="h-5 w-5" aria-hidden />
              </span>
              <h1 className="mt-4 text-xl font-semibold text-heading">
                {t("The server could not be reached")}
              </h1>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
                {t(
                  "The sign-in may have completed on the server. Check your connection and try again — nothing was created twice, because Google's subject id belongs to one account.",
                )}
              </p>
              <Button className="mt-5" onClick={() => void reload()}>
                {t("Check again")}
              </Button>
            </>
          ) : (
            <>
              <span className="mx-auto inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-mist text-brand-dark">
                <ShieldCheck className="h-5 w-5" aria-hidden />
              </span>
              <h1 className="mt-4 text-xl font-semibold text-heading">
                {t("Opening your dashboard…")}
              </h1>
              <p className="mt-2 inline-flex items-center gap-2 text-sm text-muted">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                {t("Checking the account this browser just opened.")}
              </p>
            </>
          )}

          <p className="mt-6 text-xs text-muted">
            <Link className="underline-offset-4 hover:text-ink hover:underline" href="/">
              {t("Back to home")}
            </Link>
          </p>
        </Card>
      </main>
    </div>
  );
}
