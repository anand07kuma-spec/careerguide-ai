"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Accessibility,
  Bookmark,
  Contrast,
  EyeOff,
  Info,
  KeyRound,
  Link2,
  LogOut,
  Mic,
  ShieldCheck,
  Trash2,
  UserRound,
  Volume2,
  Languages as LanguagesIcon,
} from "lucide-react";
import { Screen } from "@/components/layout/app-shell";
import { Card, CardHeader } from "@/components/ui/card";
import { Button, LinkButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ErrorState,
  LoadingPanel,
  EmptyState,
  Skeleton,
} from "@/components/ui/feedback";
import { Input, Select, Toggle } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/lib/api";
import { useSession } from "@/lib/session";
import type {
  ConsentRecord,
  ConversationInfo,
  GuardianLink,
  Health,
  Settings,
  ShareCode,
  StudentProfile,
  VoiceInfo,
} from "@/lib/types";
import { AGE_BANDS, CLASS_OPTIONS, INTEREST_OPTIONS, LANGUAGE_OPTIONS } from "@/lib/types";
import { cn, relativeTime } from "@/lib/utils";

type Resource<T> = {
  state: "loading" | "ready" | "error";
  data: T | null;
  error: string | null;
};

function initial<T>(): Resource<T> {
  return { state: "loading", data: null, error: null };
}

function messageFor(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "Something went wrong. Please try again.";
}

const EDUCATION_CONTEXT_OPTIONS = [
  "Government school",
  "Private school",
  "Home-schooled",
  "Other or not sure",
];

const FINANCIAL_CONTEXT_OPTIONS = [
  "Need low-cost options",
  "Some budget for books or courses",
  "Not sure yet",
  "Cost is not a concern right now",
];

/** Which voice group applies to the chosen reply language (hinglish uses English voices). */
function voiceGroupFor(language: string): string {
  return language === "hi" ? "hi" : "en";
}

const CONSENT_SCOPES: {
  scope: "profile" | "voice" | "history_sharing";
  label: string;
  grant: string;
  withdraw: string;
}[] = [
  {
    scope: "profile",
    label: "Store my profile",
    grant:
      "Lets us keep your class, age band and interests so suggestions fit you. Without it, nothing is personalised.",
    withdraw: "Withdraw any time — we stop using the stored details for suggestions.",
  },
  {
    scope: "voice",
    label: "Use my voice",
    grant:
      "Lets the guide turn what you say into text and read replies aloud. Plain typing works without this.",
    withdraw: "Withdraw any time — voice calls will be switched off for you.",
  },
  {
    scope: "history_sharing",
    label: "Include my themes in the parent summary",
    grant:
      "Lets a linked parent see the themes, saved careers and progress counts on their dashboard. Your conversation text is never included unless you switch it on for that parent below.",
    withdraw: "Withdraw any time — the parent's dashboard stops updating.",
  },
];

export default function SettingsScreen() {
  const { user, profile, settings, isStudent, saveSettings, saveProfile, signOut } = useSession();
  const { toast } = useToast();

  const [voices, setVoices] = useState<Resource<VoiceInfo>>(initial);
  const [health, setHealth] = useState<Resource<Health>>(initial);
  const [conversations, setConversations] = useState<Resource<ConversationInfo[]>>(initial);
  const [consent, setConsent] = useState<Resource<ConsentRecord[]>>(initial);
  const [shareCode, setShareCode] = useState<Resource<ShareCode>>(initial);
  const [guardians, setGuardians] = useState<Resource<GuardianLink[]>>(initial);

  const [pendingProfile, setPendingProfile] = useState<Partial<StudentProfile> | null>(null);
  const [busyToggle, setBusyToggle] = useState<string | null>(null);

  const [codeBusy, setCodeBusy] = useState<"new" | "revoke" | null>(null);
  const [historyModal, setHistoryModal] = useState(false);
  const [clearingHistory, setClearingHistory] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<GuardianLink | null>(null);
  const [removing, setRemoving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  /* ------------------------------------------------------------------ loaders */

  const loadVoices = useCallback(async () => {
    setVoices({ state: "loading", data: null, error: null });
    try {
      setVoices({ state: "ready", data: await api.voices(), error: null });
    } catch (error) {
      setVoices({ state: "error", data: null, error: messageFor(error) });
    }
  }, []);

  const loadHealth = useCallback(async () => {
    setHealth({ state: "loading", data: null, error: null });
    try {
      setHealth({ state: "ready", data: await api.health(), error: null });
    } catch (error) {
      setHealth({ state: "error", data: null, error: messageFor(error) });
    }
  }, []);

  const loadConversations = useCallback(async () => {
    setConversations({ state: "loading", data: null, error: null });
    try {
      setConversations({ state: "ready", data: await api.listConversations(), error: null });
    } catch (error) {
      setConversations({ state: "error", data: null, error: messageFor(error) });
    }
  }, []);

  const loadConsent = useCallback(async () => {
    setConsent({ state: "loading", data: null, error: null });
    try {
      setConsent({ state: "ready", data: await api.listConsent(), error: null });
    } catch (error) {
      setConsent({ state: "error", data: null, error: messageFor(error) });
    }
  }, []);

  const loadShareCode = useCallback(async () => {
    setShareCode({ state: "loading", data: null, error: null });
    try {
      setShareCode({ state: "ready", data: await api.shareCode(), error: null });
    } catch (error) {
      setShareCode({ state: "error", data: null, error: messageFor(error) });
    }
  }, []);

  const loadGuardians = useCallback(async () => {
    setGuardians({ state: "loading", data: null, error: null });
    try {
      setGuardians({ state: "ready", data: await api.guardians(), error: null });
    } catch (error) {
      setGuardians({ state: "error", data: null, error: messageFor(error) });
    }
  }, []);

  useEffect(() => {
    void loadVoices();
    void loadHealth();
    void loadConsent();
    void loadGuardians();
    if (isStudent) void loadConversations();
    if (isStudent) void loadShareCode();
  }, [isStudent, loadVoices, loadHealth, loadConsent, loadGuardians, loadConversations, loadShareCode]);

  /* ------------------------------------------------------------------- saves */

  const patchSettings = useCallback(
    async (patch: Partial<Settings>) => {
      // saveSettings already rolls the local value back if the server rejects it.
      try {
        await saveSettings(patch);
      } catch (error) {
        toast(messageFor(error), "error");
      }
    },
    [saveSettings, toast],
  );

  const patchProfile = useCallback(
    async (patch: Partial<StudentProfile>) => {
      setPendingProfile((current) => ({ ...current, ...patch }));
      try {
        await saveProfile(patch);
      } catch (error) {
        // Session profile never changed, so clearing the pending patch rolls back.
        toast(messageFor(error), "error");
      } finally {
        setPendingProfile(null);
      }
    },
    [saveProfile, toast],
  );

  const view: StudentProfile = useMemo(
    () => ({
      class_level: null,
      age_range: null,
      interest_areas: [],
      education_context: null,
      financial_context: null,
      ...profile,
      ...pendingProfile,
    }),
    [profile, pendingProfile],
  );

  const toggleInterest = useCallback(
    (interest: string) => {
      const current = view.interest_areas ?? [];
      const next = current.includes(interest)
        ? current.filter((item) => item !== interest)
        : [...current, interest];
      if (next.length > 12) {
        toast("You can keep up to 12 interests — remove one to add another.", "info");
        return;
      }
      void patchProfile({ interest_areas: next });
    },
    [view.interest_areas, patchProfile, toast],
  );

  const setConsentScope = useCallback(
    async (scope: "profile" | "voice" | "history_sharing", granted: boolean) => {
      setBusyToggle(`consent:${scope}`);
      try {
        await api.consent(scope, granted);
        await loadConsent();
        toast(granted ? "Consent saved." : "Consent withdrawn.", "success");
      } catch (error) {
        toast(messageFor(error), "error");
      } finally {
        setBusyToggle(null);
      }
    },
    [loadConsent, toast],
  );

  const rotateCode = useCallback(async () => {
    setCodeBusy("new");
    try {
      setShareCode({ state: "ready", data: await api.newShareCode(), error: null });
      toast("New code ready. The previous one stopped working.", "success");
    } catch (error) {
      toast(messageFor(error), "error");
    } finally {
      setCodeBusy(null);
    }
  }, [toast]);

  const revokeCode = useCallback(async () => {
    setCodeBusy("revoke");
    try {
      setShareCode({ state: "ready", data: await api.revokeShareCode(), error: null });
      toast("Sharing code switched off.", "success");
    } catch (error) {
      toast(messageFor(error), "error");
    } finally {
      setCodeBusy(null);
    }
  }, [toast]);

  const setTranscripts = useCallback(
    async (link: GuardianLink, granted: boolean) => {
      setBusyToggle(`transcripts:${link.guardianship_id}`);
      setGuardians((current) => ({
        ...current,
        state: "ready",
        data: (current.data ?? []).map((item) =>
          item.guardianship_id === link.guardianship_id
            ? { ...item, can_see_transcripts: granted }
            : item,
        ),
      }));
      try {
        const updated = await api.setTranscriptSharing(link.guardianship_id, granted);
        setGuardians((current) => ({
          ...current,
          data: (current.data ?? []).map((item) =>
            item.guardianship_id === updated.guardianship_id ? updated : item,
          ),
        }));
      } catch (error) {
        toast(messageFor(error), "error");
        void loadGuardians();
      } finally {
        setBusyToggle(null);
      }
    },
    [loadGuardians, toast],
  );

  const confirmRemoveGuardian = useCallback(async () => {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      await api.removeGuardian(removeTarget.guardianship_id);
      setRemoveTarget(null);
      toast("Link removed. That adult can no longer see your summary.", "success");
      void loadGuardians();
    } catch (error) {
      toast(messageFor(error), "error");
    } finally {
      setRemoving(false);
    }
  }, [removeTarget, loadGuardians, toast]);

  const clearAllHistory = useCallback(async () => {
    const sessions = conversations.data ?? [];
    setClearingHistory(true);
    let failures = 0;
    for (const session of sessions) {
      try {
        await api.endConversation(session.id);
      } catch {
        /* already ended — clearing still works */
      }
      try {
        await api.clearConversation(session.id);
      } catch {
        failures += 1;
      }
    }
    setClearingHistory(false);
    setHistoryModal(false);
    await loadConversations();
    toast(
      failures === 0
        ? `Deleted the messages from ${sessions.length} conversation${sessions.length === 1 ? "" : "s"}.`
        : `${sessions.length - failures} of ${sessions.length} conversations cleared. Try again for the rest.`,
      failures === 0 ? "success" : "error",
    );
  }, [conversations.data, loadConversations, toast]);

  const doSignOut = useCallback(async () => {
    setSigningOut(true);
    try {
      await signOut();
    } catch {
      setSigningOut(false);
    }
  }, [signOut]);

  /* -------------------------------------------------------------- derived UI */

  // The session provider keeps a full settings object once ready; this guard
  // only satisfies the nullable type and covers the brief pre-ready paint.
  if (!settings) {
    return (
      <Screen title="Settings and privacy" description="Loading your preferences…">
        <LoadingPanel label="Loading your settings…" />
      </Screen>
    );
  }

  const activeGroup = voiceGroupFor(settings.language);
  const consentByScope = useMemo(() => {
    const map = new Map<string, ConsentRecord>();
    for (const record of consent.data ?? []) map.set(record.scope, record); // later wins = latest
    return map;
  }, [consent.data]);

  const sessionCount = (conversations.data ?? []).length;

  const languageOptions = [...LANGUAGE_OPTIONS].map((option) => ({ ...option }));
  const classOptions = [...CLASS_OPTIONS].map((option) => ({ ...option }));
  const ageOptions = AGE_BANDS.map((band) => ({ value: band.value as string, label: band.label }));

  const contextSelect = (
    label: string,
    field: "education_context" | "financial_context",
    value: string | null,
    options: string[],
    hint: string,
  ) => {
    // Keep any stored value visible even if it is not one of the preset bands.
    const items =
      value && !options.includes(value)
        ? [{ value, label: value }, ...options.map((v) => ({ value: v, label: v }))]
        : options.map((v) => ({ value: v, label: v }));
    return (
      <Select
        label={label}
        options={items}
        value={value ?? ""}
        placeholder="Not set"
        onChange={(event) => void patchProfile({ [field]: event.target.value || null })}
        hint={hint}
      />
    );
  };

  return (
    <Screen
      title="Settings and privacy"
      description={
        isStudent
          ? "Your language, profile and data choices — every one of them can be changed or withdrawn at any time."
          : "Your app preferences and how family data is handled on CareerGuide AI."
      }
      badge={
        <Badge tone="brand" icon={<ShieldCheck className="h-3.5 w-3.5" aria-hidden />}>
          {isStudent ? "Student account" : "Parent account"}
        </Badge>
      }
    >
      <div className="max-w-3xl space-y-5">
        {/* ------------------------------------------------ Language & conversation */}
        <Card>
          <CardHeader
            icon={<LanguagesIcon className="h-4 w-4" aria-hidden />}
            title="Language and conversation"
            description="How the guide speaks and listens to you."
          />
          <div className="mt-4 space-y-4">
            <Select
              label="Reply language"
              options={languageOptions}
              value={settings.language}
              onChange={(event) => void patchSettings({ language: event.target.value })}
              hint="This is only how the guide opens the conversation — it answers in whatever language you actually use, and Hinglish mixes Hindi and English the way friends talk. Nothing about this setting sends your data anywhere new."
            />

            {voices.state === "loading" ? (
              <Skeleton className="h-11" />
            ) : voices.state === "error" ? (
              <ErrorState
                title="Voice list could not load"
                description={voices.error ?? undefined}
                onRetry={loadVoices}
              />
            ) : (
              <div className="space-y-4">
                {(voices.data?.voices ?? []).map((group) => {
                  const active = group.language === activeGroup;
                  return (
                    <Select
                      key={group.language}
                      label={
                        group.language === "hi"
                          ? "Voice — Hindi"
                          : group.language === "en"
                            ? "Voice — English (also used for Hinglish)"
                            : `Voice — ${group.language}`
                      }
                      options={group.voices.map((voice) => ({ value: voice.id, label: voice.label }))}
                      placeholder="Use the default voice"
                      value={active ? (settings.voice ?? "") : ""}
                      disabled={!active}
                      onChange={(event) =>
                        void patchSettings({ voice: event.target.value || null })
                      }
                      hint={
                        active
                          ? voices.data?.note
                          : "Not available for your current reply language — switch the language above to pick from this set."
                      }
                    />
                  );
                })}
              </div>
            )}

            <div className="space-y-3 rounded-2xl bg-canvas p-4">
              <Toggle
                checked={settings.speak_responses}
                onChange={(next) => void patchSettings({ speak_responses: next })}
                label={
                  <span className="inline-flex items-center gap-1.5">
                    <Volume2 className="h-4 w-4 text-brand-dark" aria-hidden />
                    Read replies aloud
                  </span>
                }
                description="Replies are read aloud using Microsoft Edge text-to-speech — it needs an internet connection and is not a human voice."
              />
              <Toggle
                checked={settings.continuous_conversation}
                onChange={(next) => void patchSettings({ continuous_conversation: next })}
                label={
                  <span className="inline-flex items-center gap-1.5">
                    <Mic className="h-4 w-4 text-brand-dark" aria-hidden />
                    Hands-free conversation on calls
                  </span>
                }
                description="Keeps listening during an open call so you do not tap each turn. It never listens between calls, and nothing is recorded."
              />
            </div>

            {health.state === "ready" && health.data?.demo_mode ? (
              <p className="flex items-start gap-1.5 rounded-xl bg-warning-mist/60 px-3.5 py-2.5 text-xs leading-relaxed text-ink">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700" aria-hidden />
                Answers come from a built-in demo guide until an AI key is added on the server. The
                demo still walks you through real exploration — but replies are scripted samples.
              </p>
            ) : null}
            {health.state === "error" ? (
              <ErrorState title="Server status unknown" description={health.error ?? undefined} onRetry={loadHealth} />
            ) : null}
          </div>
        </Card>

        {/* ----------------------------------------------------------- My profile */}
        {isStudent ? (
          <Card>
            <CardHeader
              icon={<UserRound className="h-4 w-4" aria-hidden />}
              title="My profile"
              description="Only these coarse details are stored — never your full name at school, address, documents, Aadhaar, bank details or passwords. We do not ask for those, ever."
            />
            <div className="mt-4 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Select
                  label="Class"
                  options={classOptions}
                  placeholder="Not set"
                  value={view.class_level ?? ""}
                  onChange={(event) => void patchProfile({ class_level: event.target.value || null })}
                  hint="Sets how simply the guide explains things."
                />
                <Select
                  label="Age band"
                  options={ageOptions}
                  placeholder="Not set"
                  value={view.age_range ?? ""}
                  onChange={(event) => void patchProfile({ age_range: event.target.value || null })}
                  hint={AGE_BANDS.find((band) => band.value === view.age_range)?.note}
                />
              </div>

              <div>
                <p className="mb-1.5 block text-sm font-medium text-ink">
                  Interests <span className="text-xs font-normal text-muted">(pick up to 12)</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {INTEREST_OPTIONS.map((interest) => {
                    const selected = (view.interest_areas ?? []).includes(interest);
                    return (
                      <button
                        key={interest}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => toggleInterest(interest)}
                        className={cn(
                          "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                          selected
                            ? "border-brand bg-brand text-white"
                            : "border-line bg-surface text-muted hover:border-brand-light hover:text-ink",
                        )}
                      >
                        {interest}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-muted">
                  Interests are things you might enjoy trying — they never decide what you are allowed
                  to become.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {contextSelect(
                  "School setting",
                  "education_context",
                  view.education_context,
                  EDUCATION_CONTEXT_OPTIONS,
                  "Helps the guide suggest realistic routes. Change it any time — nothing here is a judgment about you.",
                )}
                {contextSelect(
                  "Cost situation",
                  "financial_context",
                  view.financial_context,
                  FINANCIAL_CONTEXT_OPTIONS,
                  "A coarse band used only to suggest affordable routes and scholarships — never a judgment about your family. We never ask for bank details or documents.",
                )}
              </div>
            </div>
          </Card>
        ) : (
          <Card>
            <CardHeader
              icon={<UserRound className="h-4 w-4" aria-hidden />}
              title="My account"
              description="You are signed in as a parent, so your profile has no class, age band or interests — those belong to your child's own account."
            />
            <div className="mt-4">
              <Input label="Display name" value={user?.display_name ?? ""} readOnly disabled />
              <p className="mt-1.5 text-xs text-muted">
                Your child's name and profile live on their account and can only be changed by them.
              </p>
            </div>
          </Card>
        )}

        {/* ------------------------------------------------------- Privacy & data */}
        <Card>
          <CardHeader
            icon={<EyeOff className="h-4 w-4" aria-hidden />}
            title="Privacy and data"
            description="What gets stored, who can see it, and how to erase it."
          />
          <div className="mt-4 space-y-4">
            <div className="space-y-3 rounded-2xl bg-canvas p-4">
              <Toggle
                checked={settings.save_history}
                onChange={(next) => void patchSettings({ save_history: next })}
                label="Save my conversation history"
                description="If this is off, closing a conversation deletes its messages."
              />
              <Toggle
                checked={settings.reduced_motion}
                onChange={(next) => void patchSettings({ reduced_motion: next })}
                label={
                  <span className="inline-flex items-center gap-1.5">
                    <Accessibility className="h-4 w-4 text-brand-dark" aria-hidden />
                    Reduce motion
                  </span>
                }
                description="Turns off animations and transitions across the whole app."
              />
              <Toggle
                checked={settings.high_contrast}
                onChange={(next) => void patchSettings({ high_contrast: next })}
                label={
                  <span className="inline-flex items-center gap-1.5">
                    <Contrast className="h-4 w-4 text-brand-dark" aria-hidden />
                    High contrast
                  </span>
                }
                description="Darker text and stronger borders for easier reading."
              />
            </div>

            {isStudent ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line p-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">Delete my conversation history</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted">
                    {conversations.state === "loading"
                      ? "Checking your stored conversations…"
                      : conversations.state === "error"
                        ? conversations.error
                        : sessionCount === 0
                          ? "No conversations are stored right now."
                          : `${sessionCount} conversation${sessionCount === 1 ? "" : "s"} stored. Deleting ends each one and removes its messages.`}
                  </p>
                </div>
                <Button
                  variant="danger"
                  size="sm"
                  disabled={conversations.state !== "ready" || sessionCount === 0}
                  onClick={() => setHistoryModal(true)}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                  Delete history
                </Button>
              </div>
            ) : (
              <p className="rounded-2xl border border-line p-4 text-xs leading-relaxed text-muted">
                Your parent account does not store conversations. Conversation history belongs to each
                child's own account, and only they can view or delete it.
              </p>
            )}

            <div>
              <p className="text-sm font-semibold text-ink">Consent records</p>
              <p className="mt-0.5 text-xs text-muted">
                Exactly what you have agreed to, with the date. You can withdraw any of these here at
                any time — that is what this screen is for.
              </p>
              <div className="mt-3 space-y-3">
                {consent.state === "loading" ? (
                  <LoadingPanel label="Loading your consent records…" />
                ) : consent.state === "error" ? (
                  <ErrorState description={consent.error ?? undefined} onRetry={loadConsent} />
                ) : (
                  CONSENT_SCOPES.map((entry) => {
                    const record = consentByScope.get(entry.scope);
                    const granted = record?.granted ?? false;
                    return (
                      <div key={entry.scope} className="rounded-2xl border border-line p-4">
                        <Toggle
                          checked={granted}
                          disabled={busyToggle === `consent:${entry.scope}`}
                          onChange={(next) => void setConsentScope(entry.scope, next)}
                          label={entry.label}
                          description={entry.grant}
                        />
                        <p className="mt-2 text-[11px] text-muted">
                          {record
                            ? `Last updated ${relativeTime(record.created_at)} · consent version ${record.version}`
                            : "No decision recorded yet — treating this as not granted."}
                          {" · "}
                          {entry.withdraw}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <p className="rounded-xl bg-brand-mist/50 px-3.5 py-2.5 text-xs leading-relaxed text-brand-dark">
              What this app protects: your conversations are not shared with parents by default, links
              only exist because a student chose them, and there are no ads or payments. What it does
              not protect: this is a demo build without a legal/compliance certification — do not enter
              real personal documents, and get qualified review before using it with actual children.
            </p>
          </div>
        </Card>

        {/* -------------------------------------------------------- Family access */}
        {isStudent ? (
          <Card>
            <CardHeader
              icon={<Link2 className="h-4 w-4" aria-hidden />}
              title="Family access"
              description="A parent can only see a summary if you give them this code — they cannot attach by guessing. You can revoke it any time."
            />
            <div className="mt-4 space-y-4">
              {shareCode.state === "loading" ? (
                <Skeleton className="h-24" />
              ) : shareCode.state === "error" ? (
                <ErrorState description={shareCode.error ?? undefined} onRetry={loadShareCode} />
              ) : (
                <div className="rounded-2xl bg-canvas p-4">
                  {shareCode.data?.code ? (
                    <>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                        Your sharing code
                      </p>
                      <p className="mt-1 font-mono text-3xl font-bold tracking-[0.3em] text-ink sm:text-4xl">
                        {shareCode.data.code}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm font-medium text-ink">Sharing is currently switched off</p>
                  )}
                  {shareCode.data?.note ? (
                    <p className="mt-2 text-xs leading-relaxed text-muted">{shareCode.data.note}</p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant={shareCode.data?.code ? "outline" : "primary"}
                      loading={codeBusy === "new"}
                      disabled={codeBusy !== null && codeBusy !== "new"}
                      onClick={() => void rotateCode()}
                    >
                      <KeyRound className="h-4 w-4" aria-hidden />
                      Generate a new code
                    </Button>
                    {shareCode.data?.code ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        loading={codeBusy === "revoke"}
                        disabled={codeBusy !== null && codeBusy !== "revoke"}
                        onClick={() => void revokeCode()}
                      >
                        <EyeOff className="h-4 w-4" aria-hidden />
                        Stop sharing
                      </Button>
                    ) : null}
                  </div>
                </div>
              )}

              <div>
                <p className="text-sm font-semibold text-ink">Adults who can see your summary</p>
                <div className="mt-2">
                  {guardians.state === "loading" ? (
                    <LoadingPanel label="Checking linked adults…" />
                  ) : guardians.state === "error" ? (
                    <ErrorState description={guardians.error ?? undefined} onRetry={loadGuardians} />
                  ) : (guardians.data ?? []).length === 0 ? (
                    <EmptyState
                      icon={Link2}
                      title="No adults are linked"
                      description="Nobody outside your account can see anything. If you later want a parent to see your exploration summary, share the code above with them."
                    />
                  ) : (
                    <ul className="space-y-2.5">
                      {(guardians.data ?? []).map((link) => (
                        <li key={link.guardianship_id} className="rounded-2xl border border-line p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-ink">
                                {link.name}
                                {link.relationship ? (
                                  <span className="ml-2 text-xs font-normal text-muted">
                                    {link.relationship}
                                  </span>
                                ) : null}
                              </p>
                              <p className="mt-0.5 text-xs text-muted">
                                Linked {relativeTime(link.linked_at)} · sees summary only
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setRemoveTarget(link)}
                            >
                              Remove
                            </Button>
                          </div>
                          <div className="mt-3 border-t border-line pt-3">
                            <Toggle
                              checked={link.can_see_transcripts}
                              disabled={busyToggle === `transcripts:${link.guardianship_id}`}
                              onChange={(next) => void setTranscripts(link, next)}
                              label={`Conversation text shared: ${link.can_see_transcripts ? "yes" : "no"}`}
                              description={`Themes and progress are shared either way. Only turn this on if you want ${link.name} to read the actual messages.`}
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </Card>
        ) : null}

        {/* ------------------------------------------------------ About this build */}
        <Card>
          <CardHeader
            icon={<Info className="h-4 w-4" aria-hidden />}
            title="About this build"
            description="Honest limitations, in plain words."
          />
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted">
            <li className="flex gap-2">
              <Bookmark className="mt-0.5 h-4 w-4 shrink-0 text-teal" aria-hidden />
              The AI guide is scripted demo content until an API key is configured on the server —
              replies are sample conversations, not a live model.
            </li>
            <li className="flex gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-teal" aria-hidden />
              The career catalogue is seeded sample data. Fees, entrances and eligibility change
              yearly — always verify against official sources before deciding anything.
            </li>
            <li className="flex gap-2">
              <Mic className="mt-0.5 h-4 w-4 shrink-0 text-teal" aria-hidden />
              Speech recognition depends on your browser: it works best in recent Chrome and Edge on
              desktop, and typing always remains available as a fallback.
            </li>
            <li className="flex gap-2">
              <EyeOff className="mt-0.5 h-4 w-4 shrink-0 text-teal" aria-hidden />
              There are no payments, courses or paid services anywhere in this app, and guidance is
              never influenced by partners.
            </li>
            <li className="flex gap-2">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-teal" aria-hidden />
              Qualified legal review (including child-data rules like India's DPDP Act) is needed
              before any real deployment with children. This build makes no compliance claim.
            </li>
          </ul>
        </Card>

        {/* ------------------------------------------------------------- Sign out */}
        <Card className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-ink">Sign out of CareerGuide AI</p>
            <p className="mt-0.5 text-xs text-muted">
              Your settings and consent choices stay on the account for next time.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isStudent ? null : (
              <LinkButton href="/parent" variant="outline" size="sm">
                Parent dashboard
              </LinkButton>
            )}
            <Button variant="secondary" loading={signingOut} onClick={() => void doSignOut()}>
              <LogOut className="h-4 w-4" aria-hidden />
              Sign out
            </Button>
          </div>
        </Card>
      </div>

      {/* Delete-history confirm */}
      <Modal
        open={historyModal}
        onClose={() => !clearingHistory && setHistoryModal(false)}
        title="Delete your conversation history?"
        description={`This ends and clears ${sessionCount} conversation${sessionCount === 1 ? "" : "s"} — the messages, not your saved careers or themes.`}
        footer={
          <>
            <Button variant="outline" onClick={() => setHistoryModal(false)} disabled={clearingHistory}>
              Keep them
            </Button>
            <Button variant="danger" loading={clearingHistory} onClick={() => void clearAllHistory()}>
              Delete {sessionCount} conversation{sessionCount === 1 ? "" : "s"}
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-muted">
          This cannot be undone from this screen. Saved careers, interest themes and your journey
          counts stay — only the message text is deleted. If you want everything gone, that is fine:
          delete the history, then remove careers you saved from the explorer.
        </p>
      </Modal>

      {/* Remove guardian confirm */}
      <Modal
        open={removeTarget !== null}
        onClose={() => !removing && setRemoveTarget(null)}
        title="Remove this adult's access?"
        description={removeTarget ? `${removeTarget.name} will no longer see your summary.` : undefined}
        footer={
          <>
            <Button variant="outline" onClick={() => setRemoveTarget(null)} disabled={removing}>
              Keep the link
            </Button>
            <Button variant="danger" loading={removing} onClick={() => void confirmRemoveGuardian()}>
              Remove access
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-muted">
          Removing access is your choice and takes effect immediately. Nothing about your account is
          deleted — if you ever want {removeTarget?.name ?? "this adult"} to see a summary again, you
          would share a new code.
        </p>
      </Modal>
    </Screen>
  );
}
