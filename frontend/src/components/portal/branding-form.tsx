"use client";

import { useCallback, useState } from "react";
import { Check, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { ErrorState, LoadingPanel } from "@/components/ui/feedback";
import { Input, Textarea } from "@/components/ui/field";
import { api, ApiError } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { ACCENTS } from "@/lib/portal";
import { cn } from "@/lib/utils";
import { useResource } from "@/lib/use-resource";
import type { Branding } from "@/lib/types";

/**
 * A portal's look.
 *
 * The colour is chosen from the platform's seven tokens and cannot be typed, because an
 * accent colour is how a screen says "this is the button" — on a page a child reads, a
 * free-form hex is a way to make a warning look like a call to action. The logo is a link
 * and not an upload, for the reason the backend gives: a platform that stores a school's
 * logo has taken on its identity, its backups and its deletion requests in one action.
 */
export function BrandingForm({ slug }: { slug: string }) {
  const load = useCallback(() => api.orgBranding(slug), [slug]);
  const { state, data, error, reload } = useResource(load);

  return (
    <Card className="space-y-5">
      <CardHeader
        title="How this portal looks to the people who join it"
        description="The heading and the note are what a student reads before deciding to open the link. Nothing here changes what the portal can see."
        icon={<Palette className="h-5 w-5" aria-hidden />}
      />

      {state === "loading" && !data ? <LoadingPanel label="Loading the portal's look" /> : null}
      {state === "error" && !data ? (
        <ErrorState description={error} onRetry={reload} retryLabel="Try again" />
      ) : null}

      {/* Keyed by the row's own stamp so the fields are seeded once, from the server's
          values, and start again after a save rather than holding an edited box that has
          already been written. */}
      {data ? (
        <BrandingFields key={data.changed_at} slug={slug} branding={data} onSaved={reload} />
      ) : null}
    </Card>
  );
}

function BrandingFields({
  slug,
  branding,
  onSaved,
}: {
  slug: string;
  branding: Branding;
  onSaved: () => void;
}) {
  const t = useT();
  const [title, setTitle] = useState(branding.portal_title ?? "");
  const [note, setNote] = useState(branding.welcome_note ?? "");
  const [logo, setLogo] = useState(branding.logo_url ?? "");
  const [accent, setAccent] = useState(branding.accent_color ?? ACCENTS[0].value);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const trimmedLogo = logo.trim();
  const badLogo =
    trimmedLogo !== "" && (!/^https:\/\/\S+$/.test(trimmedLogo) || trimmedLogo.includes("@"));

  const changed =
    title !== (branding.portal_title ?? "") ||
    note !== (branding.welcome_note ?? "") ||
    trimmedLogo !== (branding.logo_url ?? "") ||
    accent !== (branding.accent_color ?? ACCENTS[0].value);

  async function save() {
    setBusy(true);
    setFailure(null);
    setSaved(false);
    try {
      await api.saveBranding(slug, {
        portal_title: title.trim() ? title.trim().slice(0, 80) : null,
        welcome_note: note.trim() ? note.trim().slice(0, 600) : null,
        logo_url: trimmedLogo || null,
        accent_color: accent,
      });
      setSaved(true);
      onSaved();
    } catch (caught) {
      setFailure(caught instanceof ApiError ? caught.message : t("Something went wrong."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Input
        label={t("Portal heading")}
        value={title}
        maxLength={80}
        onChange={(event) => setTitle(event.target.value)}
        hint={t("Shown above the platform's own name. The platform label is always there too.")}
      />
      <Textarea
        label={t("Welcome note")}
        rows={5}
        value={note}
        maxLength={600}
        onChange={(event) => setNote(event.target.value)}
        hint={t("Only a member of this portal reads it. Nothing written here is sent to another portal.")}
      />
      <Input
        label={t("Logo link (https)")}
        type="url"
        value={logo}
        maxLength={500}
        spellCheck={false}
        onChange={(event) => setLogo(event.target.value)}
        error={
          badLogo ? t("A logo has to be a plain https link, with no spaces and no password in it.") : undefined
        }
        hint={t("There is no upload on this platform, so the file stays hosted by whoever owns it.")}
      />

      <div>
        <p className="mb-2 text-sm font-medium text-ink">{t("Accent colour")}</p>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("Accent colour")}>
          {ACCENTS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={accent === option.value}
              onClick={() => setAccent(option.value)}
              className={cn(
                "flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-colors",
                accent === option.value
                  ? "border-ink/30 bg-canvas text-ink"
                  : "border-line text-muted hover:border-brand/40",
              )}
            >
              <span
                className="h-5 w-5 rounded-full ring-1 ring-black/10"
                style={{ backgroundColor: option.value }}
                aria-hidden
              />
              {option.name}
              {accent === option.value ? <Check className="h-3.5 w-3.5" aria-hidden /> : null}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          {t("Seven colours, the platform's own. A portal can look like itself and still cannot redefine what a colour means.")}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => void save()} loading={busy} disabled={badLogo || !changed}>
          {t("Save")}
        </Button>
        {saved && !busy ? <p className="text-sm text-success">{t("Saved.")}</p> : null}
        {failure ? (
          <p role="alert" className="text-sm text-danger">
            {failure}
          </p>
        ) : null}
      </div>

      <p className="text-xs text-muted">
        {t("Last changed")} {new Date(branding.changed_at).toLocaleString()}
      </p>
    </>
  );
}
