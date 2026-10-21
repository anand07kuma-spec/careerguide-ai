"use client";

import Link from "next/link";
import { useCallback, useState, type ReactNode } from "react";
import { ArrowRight, MailQuestion, ShieldCheck } from "lucide-react";
import { Wordmark } from "@/components/brand";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LoadingPanel } from "@/components/ui/feedback";
import { Checkbox } from "@/components/ui/field";
import { api, ApiError } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { ROLE_WORDS, subdomainFromHost } from "@/lib/portal";
import { logoSrcIsAllowed } from "@/lib/site";
import { useSession } from "@/lib/session";
import { useResource } from "@/lib/use-resource";
import type { AcceptResult } from "@/lib/types";

/**
 * The page an invitation letter opens.
 *
 * Two things are deliberately absent from it. There is no place to type a school's name:
 * an address is only ever asked for so the *look* of the right portal can be painted, and
 * the accept call carries a token, not a claim about who the child is. And there is no
 * promise that a portal can see anything — `share_results` starts off, and the person
 * holding the link is the one who sets it.
 */
export function JoinForm({
  token,
  portal,
  host,
}: {
  token: string | null;
  portal: string | null;
  host: string;
}) {
  const t = useT();
  const { status } = useSession();
  const slug = portal ?? subdomainFromHost(host);

  const load = useCallback(() => (slug ? api.orgPortal(slug) : Promise.resolve(null)), [slug]);
  const branding = useResource(load);

  const [share, setShare] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [joined, setJoined] = useState<AcceptResult | null>(null);

  // Drawn only when the host is one the deployment has allowlisted, because that same
  // list is what `img-src` is built from: asking for a picture the policy would block
  // produces a broken image icon on the page of a child deciding whether to trust a
  // school, which is worse than the school's name on its own.
  const logoUrl = branding.data?.logo_url && logoSrcIsAllowed(branding.data.logo_url)
    ? branding.data.logo_url
    : null;

  async function accept() {
    if (!token) return;
    setBusy(true);
    setFailure(null);
    try {
      setJoined(await api.acceptInvite({ token, share_results: share }));
    } catch (caught) {
      setFailure(caught instanceof ApiError ? caught.message : t("Something went wrong."));
    } finally {
      setBusy(false);
    }
  }

  if (joined) {
    return (
      <Frame>
        <Card className="space-y-4">
          <Badge tone="success">{t("You have joined")}</Badge>
          <h1 className="text-xl font-semibold text-ink">{joined.portal_title || joined.name}</h1>
          <p className="text-sm leading-relaxed text-muted">
            {t("You are on this portal as")}: <strong className="text-ink">{ROLE_WORDS[joined.org_role]}</strong>.{" "}
            {joined.share_results
              ? t("Your finished reports are visible to it. You can change that whenever you like.")
              : t("Nothing you write or answer is visible to it. Only what you choose to share, and you have not chosen yet.")}
          </p>
          <div className="flex flex-wrap gap-2">
            <LinkButton href={`/${joined.kind}/dashboard?portal=${joined.slug}`}>
              {t("Open the portal")}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </LinkButton>
            <LinkButton href="/app" variant="outline">
              {t("Go to my own work")}
            </LinkButton>
          </div>
        </Card>
      </Frame>
    );
  }

  return (
    <Frame>
      <Card className="space-y-5">
        {slug ? (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                  {t("You have been invited to")}
                </p>
                <h1 className="mt-1 text-xl font-semibold text-ink">
                  {branding.data?.portal_title || branding.data?.name || slug}
                </h1>
              </div>
              {branding.data ? (
                <Badge tone={branding.data.verified ? "success" : "neutral"}>
                  {branding.data.verified ? t("Verified by the platform") : t("Not verified")}
                </Badge>
              ) : null}
            </div>
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" className="h-12 w-auto max-w-[160px] rounded-xl object-contain" />
            ) : null}
            {branding.state === "error" && !branding.data ? (
              <p className="text-sm text-muted">
                {t("That portal is not open here, so its name is not shown. The invitation below still works if the link is live.")}
              </p>
            ) : null}
          </>
        ) : (
          <div className="flex items-start gap-3">
            <MailQuestion className="mt-0.5 h-5 w-5 shrink-0 text-brand-dark" aria-hidden />
            <div>
              <h1 className="text-lg font-semibold text-ink">{t("An invitation to a portal")}</h1>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                {t("This link does not say which school or practice sent it, and the platform will not guess: the name appears when the invitation is accepted.")}
              </p>
            </div>
          </div>
        )}

        <ul className="space-y-2 rounded-xl bg-canvas p-4 text-sm leading-relaxed text-ink">
          <li className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
            {t("Your answers, your conversations and your report stay yours.")}
          </li>
          <li className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
            {t("Joining holds a place for you. It does not hand this portal anything.")}
          </li>
          <li className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
            {t("No tier, price or sponsorship changes what the guide tells you.")}
          </li>
        </ul>

        {!token ? (
          <p role="alert" className="text-sm text-danger">
            {t("There is no invitation in this link. Open the one from the letter, or ask the portal to write to your address again.")}
          </p>
        ) : status === "new-device" ? (
          <div className="space-y-3">
            <p className="text-sm leading-relaxed text-muted">
              {t("This browser has not been introduced to CareerGuide AI yet. Choose who is using it, then open this link again — the invitation waits for you.")}
            </p>
            <LinkButton href="/onboarding">
              {t("Say who is using this device")}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </LinkButton>
          </div>
        ) : status === "loading" || status === "offline" ? (
          <LoadingPanel label="Checking this device" />
        ) : (
          <>
            <Checkbox
              label={t("Let this portal see my finished reports")}
              description={t("Off to begin with. A school that wants your reports asks, and you answer here or in the portal.")}
              checked={share}
              onChange={(event) => setShare(event.target.checked)}
            />
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={() => void accept()} loading={busy}>
                {t("Accept the invitation")}
              </Button>
              {failure ? (
                <p role="alert" className="max-w-md text-sm text-danger">
                  {failure}
                </p>
              ) : null}
            </div>
            <p className="text-xs leading-relaxed text-muted">
              {t("The link is the invitation. Nobody checks who it was addressed to, so keep it on your own device: whoever opens it next is the person who takes the place.")}
            </p>
          </>
        )}
      </Card>
    </Frame>
  );
}

function Frame({ children }: { children: ReactNode }) {
  const t = useT();
  return (
    <div className="min-h-dvh bg-canvas">
      <header className="border-b border-line bg-surface/80 px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <Link href="/" className="block">
            <Wordmark />
          </Link>
          <Link href="/app" className="text-xs font-medium text-muted hover:text-ink">
            {t("My own work")}
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-10">{children}</main>
    </div>
  );
}
