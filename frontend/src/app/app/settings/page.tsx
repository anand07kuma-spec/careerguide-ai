"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Accessibility,
  BellOff,
  Bookmark,
  Check,
  Contrast,
  Copy,
  Download,
  EyeOff,
  Info,
  KeyRound,
  Languages as LanguagesIcon,
  Link2,
  Mail,
  Mic,
  Monitor,
  Moon,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Sun,
  Trash2,
  UserRound,
  Volume2,
} from "lucide-react";
import { Screen } from "@/components/layout/app-shell";
import { SettingsRow, SubHeading } from "@/components/settings/settings-section";
import { Card } from "@/components/ui/card";
import { Button, LinkButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState, LoadingPanel, Skeleton } from "@/components/ui/feedback";
import { Input, Select, Toggle } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { PillGroup } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/lib/api";
import { clerkEnabled } from "@/lib/clerk";
import { setUiLang, useT, useTf, useUiLang } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { setThemeChoice, useThemeChoice } from "@/lib/theme";
import type {
  ClerkStatus,
  ConsentRecord,
  ConversationInfo,
  GuardianLink,
  Health,
  Settings,
  ShareCode,
  StudentProfile,
  VoiceInfo,
} from "@/lib/types";
import { CLASS_OPTIONS, INTEREST_OPTIONS, LANGUAGE_OPTIONS } from "@/lib/types";
import { classLabel, cn, initials, relativeTime } from "@/lib/utils";
import { useAudioPlayer } from "@/lib/voice";

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

/**
 * The three configuration names the email sign-in card prints inside `<code>` chips.
 *
 * They are env-var names and a route, not interface text: the server looks for exactly
 * these bytes, so they are held as constants and drawn verbatim in every language
 * instead of being dictionary keys someone could "translate".
 */
const CLERK_SECRET_ENV = "CLERK_SECRET_KEY";
const CLERK_PUBLISHABLE_ENV = "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY";
const CLERK_WEBHOOK_ROUTE = "POST /api/webhooks/clerk";

/** Same bounds the server refuses outside of: `AGE_MIN`/`AGE_MAX` in
 * `backend/app/services/profile_facts.py` and `ge=3, le=99` on `ProfileIn.age`. */
const AGE_MIN = 3;
const AGE_MAX = 99;

/**
 * The student's age, typed.
 *
 * This used to be a five-option dropdown of bands, which asked a fourteen-year-old to
 * decide whether they belonged in "Age 11 to 12" or "Age 13 or above" — and then the
 * server had no number to check that choice against. Here the number is the input and the
 * band is what the server works out from it, so the answer can be exactly right.
 *
 * The two details that keep it honest: it commits on blur or Enter rather than on every
 * keystroke, because "1" while somebody is typing fourteen is not a valid age; and an
 * invalid number is refused here with a message, not sent to be rejected as an opaque 422.
 */
function AgeField({
  age,
  onCommit,
}: {
  age: number | null;
  onCommit: (years: number | null) => void;
}) {
  const [text, setText] = useState(age === null ? "" : String(age));
  const [error, setError] = useState<string | null>(null);

  // The server's answer wins whenever it changes underneath us — after a successful commit,
  // or after a failed one that rolled the profile back. Remembering the age last shown is
  // what lets the field reset while rendering instead of in an effect that copies the prop.
  const [shown, setShown] = useState(age);
  if (shown !== age) {
    setShown(age);
    setText(age === null ? "" : String(age));
    setError(null);
  }

  const commit = () => {
    const typed = text.trim();
    if (!typed) {
      setError(null);
      onCommit(null);
      return;
    }
    const years = Number(typed);
    if (!Number.isInteger(years) || years < AGE_MIN || years > AGE_MAX) {
      setError(`Type your age as a whole number between ${AGE_MIN} and ${AGE_MAX}.`);
      return;
    }
    setError(null);
    if (years !== age) onCommit(years);
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        commit();
      }}
    >
      <Input
        label="Age"
        hint="Type it in years, the way it is written on your school card."
        error={error}
        inputMode="numeric"
        autoComplete="off"
        placeholder="e.g. 14"
        value={text}
        onChange={(event) => setText(event.target.value)}
        onBlur={commit}
      />
    </form>
  );
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
      "Lets us keep your class, age and interests so suggestions fit you. Without it, nothing is personalised.",
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
      "Lets a linked parent see the themes, saved careers and progress counts on their dashboard. Your conversation text is never included unless you switch it on for that parent.",
    withdraw: "Withdraw any time — the parent's dashboard stops updating.",
  },
];

const BUILD_NOTES = [
  {
    icon: Bookmark,
    text: "The guide’s replies come from whichever model the server is configured with. Anything written from sample content carries a ‘Demo guide answer’ label on the reply itself, so the answer tells you which one you are reading.",
  },
  {
    icon: ShieldCheck,
    text: "The career catalogue is seeded sample data. Fees, entrances and eligibility change yearly — always verify against official sources before deciding anything.",
  },
  {
    icon: Mic,
    text: "Speech recognition depends on your browser: it works best in recent Chrome and Edge on desktop, and typing always remains available as a fallback.",
  },
  {
    icon: EyeOff,
    text: "Nothing is sold here except the plans on /pricing, and those are switched off until the operator sets real payment keys. No course, coaching class or institution is sold, and guidance is never influenced by partners or by what a family paid.",
  },
  {
    icon: Smartphone,
    text: "This prototype has no login on purpose. Your work is tied to this browser only, so a different phone or cleared browser data starts a new student and the old progress cannot be recovered.",
  },
  {
    icon: Info,
    text: "Qualified legal review (including child-data rules like India's DPDP Act) is needed before any real deployment with children. This build makes no compliance claim.",
  },
];

/**
 * The two halves of the delete-account dialog, written to match what
 * `app/routers/users.py::erase_account` actually does — its `_removals` list and its `KEPT`
 * list. A dialog that promised more than the route removes would be the app lying about an
 * erasure, and the number that gets believed afterwards is worth more than a reassuring word.
 */
const ERASE_GOES = [
  "Every conversation and every message in it, including anything you asked by voice.",
  "Your assessments: the sittings, the answers and the results scored from them.",
  "The reports — the career report and any PDF that was generated from it.",
  "Study plans, journey counts, interest observations, saved careers and recommendations.",
  "The resume you wrote — the job title, the class rows, the skills and projects, as one document.",
  "Your profile, your settings, every consent you recorded, and any family or portal link.",
  "Every session on every device, so a second laptop signed in to this account stops working too.",
];

const ERASE_KEPT = [
  "The record of a payment you made or were refunded. A money ledger has to outlive the person it is about.",
  "The operator log. This erasure is written in it, without your name attached.",
  "The row that used to be your account, holding nothing but the date it was erased on.",
];

type SectionKey = "language" | "profile" | "account" | "privacy" | "family" | "device" | "about";

export default function SettingsScreen() {
  const { user, profile, settings, isStudent, saveSettings, saveProfile, startOver } = useSession();
  const { toast } = useToast();
  const t = useT();
  const tf = useTf();
  const uiLang = useUiLang();
  const themeChoice = useThemeChoice();

  const [voices, setVoices] = useState<Resource<VoiceInfo>>(initial);
  const [health, setHealth] = useState<Resource<Health>>(initial);
  const [conversations, setConversations] = useState<Resource<ConversationInfo[]>>(initial);
  const [consent, setConsent] = useState<Resource<ConsentRecord[]>>(initial);
  const [shareCode, setShareCode] = useState<Resource<ShareCode>>(initial);
  const [guardians, setGuardians] = useState<Resource<GuardianLink[]>>(initial);
  const [clerk, setClerk] = useState<Resource<ClerkStatus>>(initial);
  const [disconnecting, setDisconnecting] = useState(false);

  const [section, setSection] = useState<SectionKey | null>(null);
  const [pendingProfile, setPendingProfile] = useState<Partial<StudentProfile> | null>(null);
  const [busyToggle, setBusyToggle] = useState<string | null>(null);
  const [codeBusy, setCodeBusy] = useState<"new" | "revoke" | null>(null);
  const [copied, setCopied] = useState<"share" | null>(null);
  const [historyModal, setHistoryModal] = useState(false);
  const [clearingHistory, setClearingHistory] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<GuardianLink | null>(null);
  const [removing, setRemoving] = useState(false);
  const [resetModal, setResetModal] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [eraseModal, setEraseModal] = useState(false);
  const [erasing, setErasing] = useState(false);
  const [eraseError, setEraseError] = useState<string | null>(null);
  const [voiceTest, setVoiceTest] = useState<{ busy: boolean; ok: boolean; message: string }>({
    busy: false,
    ok: false,
    message: "",
  });
  const player = useAudioPlayer();

  /* ------------------------------------------------------------------ loaders */

  const loadVoices = useCallback(async () => {
    try {
      setVoices({ state: "ready", data: await api.voices(), error: null });
    } catch (error) {
      setVoices({ state: "error", data: null, error: messageFor(error) });
    }
  }, []);

  const loadHealth = useCallback(async () => {
    try {
      setHealth({ state: "ready", data: await api.health(), error: null });
    } catch (error) {
      setHealth({ state: "error", data: null, error: messageFor(error) });
    }
  }, []);

  /** Ask the server for a real clip. Nothing else proves which service speaks. */
  const testVoice = useCallback(async () => {
    setVoiceTest({ busy: true, ok: false, message: "" });
    const spoken = settings?.language ?? "en";
    const sample =
      spoken === "hi"
        ? "नमस्ते! मैं CareerGuide की आवाज़ हूँ।"
        : "Hello! This is the CareerGuide voice, spoken by the server.";
    try {
      const result = await api.speak(sample, spoken, settings?.voice ?? null);
      await player.play(result.audio_url);
      setVoiceTest({ busy: false, ok: true, message: `${result.provider} made this audio.` });
    } catch (error) {
      setVoiceTest({ busy: false, ok: false, message: messageFor(error) });
    }
    // The server just answered (or refused), so the status line can be re-read.
    void loadHealth();
  }, [loadHealth, player, settings]);

  const loadConversations = useCallback(async () => {
    try {
      setConversations({ state: "ready", data: await api.listConversations(), error: null });
    } catch (error) {
      setConversations({ state: "error", data: null, error: messageFor(error) });
    }
  }, []);

  const loadConsent = useCallback(async () => {
    try {
      setConsent({ state: "ready", data: await api.listConsent(), error: null });
    } catch (error) {
      setConsent({ state: "error", data: null, error: messageFor(error) });
    }
  }, []);

  const loadShareCode = useCallback(async () => {
    try {
      setShareCode({ state: "ready", data: await api.shareCode(), error: null });
    } catch (error) {
      setShareCode({ state: "error", data: null, error: messageFor(error) });
    }
  }, []);

  const loadGuardians = useCallback(async () => {
    try {
      setGuardians({ state: "ready", data: await api.guardians(), error: null });
    } catch (error) {
      setGuardians({ state: "error", data: null, error: messageFor(error) });
    }
  }, []);

  const loadClerk = useCallback(async () => {
    try {
      setClerk({ state: "ready", data: await api.clerkStatus(), error: null });
    } catch (error) {
      setClerk({ state: "error", data: null, error: messageFor(error) });
    }
  }, []);

  useEffect(() => {
    // Fetching is the whole purpose of this effect, and every setState inside
    // those loaders happens after an await.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadVoices();
    void loadHealth();
    void loadConsent();
    void loadGuardians();
    void loadClerk();
    if (isStudent) void loadConversations();
    if (isStudent) void loadShareCode();
  }, [
    isStudent,
    loadVoices,
    loadHealth,
    loadConsent,
    loadGuardians,
    loadClerk,
    loadConversations,
    loadShareCode,
  ]);

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
      age: null,
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
      toast("New sharing code ready. The previous one stopped working.", "success");
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

  const copyValue = useCallback(
    async (value: string, which: "share") => {
      try {
        await navigator.clipboard.writeText(value);
      } catch {
        toast("Your browser blocked copying — please write it down instead.", "info");
        return;
      }
      setCopied(which);
      setTimeout(() => setCopied(null), 2000);
    },
    [toast],
  );

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

  const doStartOver = useCallback(async () => {
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
  }, [startOver, toast]);

  /** Erase this account, then do the same teardown "Start over" does. */
  const doErase = useCallback(async () => {
    setErasing(true);
    setEraseError(null);
    try {
      await api.deleteAccount();
      // The server has by now deleted every session on the account and expired the cookie.
      // What is left is the client's half: stop believing this browser holds a credential,
      // and drop the device id the erased row was found by, so the next visit is a stranger
      // rather than a resurrection.
      await startOver();
    } catch (error) {
      // The refusal stays on the dialog, in the server's own words: an account that runs
      // the site is refused here and closed by another operator instead.
      setEraseError(messageFor(error));
      setErasing(false);
    }
  }, [startOver]);

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

  /* -------------------------------------------------------------- derived UI */

  const language = settings?.language ?? "en";
  const activeGroup = voiceGroupFor(language);
  const consentByScope = useMemo(() => {
    const map = new Map<string, ConsentRecord>();
    for (const record of consent.data ?? []) map.set(record.scope, record); // later wins = latest
    return map;
  }, [consent.data]);

  const sessionCount = (conversations.data ?? []).length;
  const grantedCount = CONSENT_SCOPES.filter((entry) => consentByScope.get(entry.scope)?.granted).length;
  const guardianCount = (guardians.data ?? []).length;
  const languageLabel = t(
    LANGUAGE_OPTIONS.find((option) => option.value === language)?.label ?? language,
  );
  const interestCount = (view.interest_areas ?? []).length;

  // `tts_ready` only says the settings are complete. This verdict comes from the
  // last time audio was really asked for, and one made against a different
  // service — before a key was added, say — does not count for the current one.
  const attempt = health.data?.tts_last_attempt ?? null;
  const lastVoiceTry =
    attempt && attempt.ok !== null && attempt.provider === health.data?.tts_provider
      ? attempt
      : null;
  // Every branch names a service or a timestamp the server chose, so the sentence
  // around it is a template and the data goes in through `{…}` — the Hindi entry puts
  // the provider name where Hindi wants it, not where English does.
  const voiceStatusLine =
    health.state === "loading"
      ? t("Asking the server which speech service it uses…")
      : health.state === "error"
        ? t("The server could not be reached, so its voice is unknown.")
        : lastVoiceTry?.ok === true
          ? tf("{provider} turned a reply into real audio{when}.", {
              provider: lastVoiceTry.provider ?? t("the server"),
              when: lastVoiceTry.checked_at ? ` ${relativeTime(lastVoiceTry.checked_at)}` : "",
            })
          : lastVoiceTry?.ok === false
            ? tf(
                "{provider} was asked and refused: {reason} Replies are read by your browser's own voice instead.",
                {
                  provider: lastVoiceTry.provider ?? t("the server"),
                  reason: lastVoiceTry.reason ?? t("no audio came back"),
                },
              )
            : tf("Nothing has been spoken by {provider} yet. Run the test below to ask it for audio.", {
                provider: health.data?.tts_provider ?? t("the server"),
              });

  const classOptions = [...CLASS_OPTIONS].map((option) => ({ ...option }));

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

  const closeSection = () => setSection(null);

  return (
    <Screen
      title="Settings"
      description="Each line opens one part of this account. Everything here is yours to change."
      badge={
        <Badge tone="brand" icon={<ShieldCheck className="h-3.5 w-3.5" aria-hidden />}>
          {t(isStudent ? "Student account" : "Parent account")}
        </Badge>
      }
    >
      <div className="max-w-3xl space-y-5">
        {/* ------------------------------------------------------------- Identity */}
        <Card className="flex flex-wrap items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand text-lg font-semibold text-white">
            {initials(user?.display_name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold text-ink">{user?.display_name}</p>
            <p className="mt-0.5 truncate text-sm text-muted">
              {isStudent
                ? `${classLabel(profile?.class_level) ?? t("Class not set")} · ${languageLabel}`
                : t("Parent account · sees only what a child shares")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {isStudent ? (
              <LinkButton href="/app" variant="outline" size="sm">
                {t("Dashboard")}
              </LinkButton>
            ) : (
              <LinkButton href="/parent" variant="outline" size="sm">
                {t("Parent dashboard")}
              </LinkButton>
            )}
            <Button variant="ghost" size="sm" onClick={() => setSection("device")}>
              <Smartphone className="h-4 w-4" aria-hidden />
              {t("This device")}
            </Button>
          </div>
        </Card>

        {/* ------------------------------------------------------------ Settings list */}
        <Card className="divide-y divide-line overflow-hidden p-0">
          <SettingsRow
            icon={LanguagesIcon}
            tone="bg-brand-mist text-brand-dark"
            title="Language and voice"
            value={`${languageLabel} · ${
              settings?.speak_responses ? t("reads replies aloud") : t("silent")
            } · ${
              settings?.continuous_conversation ? t("hands-free on") : t("tap to speak")
            }`}
            onClick={() => setSection("language")}
          />
          {isStudent ? (
            <SettingsRow
              icon={UserRound}
              tone="bg-teal-mist text-teal"
              title="My profile"
              value={`${classLabel(profile?.class_level) ?? t("Class not set")} · ${tf(
                "{count} interests",
                { count: interestCount },
              )}`}
              onClick={() => setSection("profile")}
            />
          ) : (
            <SettingsRow
              icon={UserRound}
              tone="bg-teal-mist text-teal"
              title="My account"
              value="A parent account holds no class, age or interests"
              onClick={() => setSection("profile")}
            />
          )}
          <SettingsRow
            icon={Mail}
            tone="bg-brand-mist text-brand-dark"
            title="Account and email sign-in"
            value={
              clerk.state === "loading"
                ? "Checking whether an email is connected…"
                : clerk.data?.linked
                  ? "Connected — this work also opens where you sign in with that email"
                  : clerkEnabled()
                    ? "Not connected — this browser is still the only way in"
                    : "Email sign-in is not switched on for this site"
            }
            onClick={() => setSection("account")}
          />
          <SettingsRow
            icon={EyeOff}
            tone="bg-brand-mist text-brand-dark"
            title="Privacy, consent and display"
            value={
              consent.state === "loading"
                ? "Checking your consent…"
                : `${tf("{granted} of {total} consents given", {
                    granted: grantedCount,
                    total: CONSENT_SCOPES.length,
                  })} · ${settings?.save_history ? t("history saved") : t("history not saved")}`
            }
            onClick={() => setSection("privacy")}
          />
          {isStudent ? (
            <SettingsRow
              icon={Link2}
              tone="bg-success-mist text-success"
              title="Family access"
              value={
                guardians.state === "loading"
                  ? "Checking linked adults…"
                  : guardianCount === 0
                    ? "No adult can see your summary"
                    : tf("{count} adults can see your summary", { count: guardianCount })
              }
              onClick={() => setSection("family")}
            />
          ) : null}
          <SettingsRow
            icon={Smartphone}
            tone="bg-brand-mist text-brand-dark"
            title="This device"
            value="No login — this browser is what remembers your work"
            onClick={() => setSection("device")}
          />
          <SettingsRow
            icon={Info}
            tone="bg-slate-100 text-slate-600"
            title="About this build"
            value={tf("{count} honest limitations, in plain words", {
              count: BUILD_NOTES.length,
            })}
            onClick={() => setSection("about")}
          />
        </Card>

        {/* ---------------------------------------------------------- This device */}
        <Card className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">{t("There is nothing to sign out of")}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted">
              {t(
                "This browser is the account, so just close the tab — everything will be waiting next time you open it from here. Use start over only if somebody else will use this device.",
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSection("device")}>
              <Info className="h-4 w-4" aria-hidden />
              {t("How this works")}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setResetModal(true)}>
              <RotateCcw className="h-4 w-4" aria-hidden />
              {t("Start over")}
            </Button>
          </div>
        </Card>

        {/* ------------------------------------------------------ Delete the account */}
        <Card className="flex flex-wrap items-center justify-between gap-3 border-danger/30 bg-danger-mist/30">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">{t("Delete this account")}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted">
              {t(
                "Erases what this account holds on the server — the messages, the assessments and their answers, the reports, the plans, the saved careers, the resume you wrote, the settings and every session on every device. Not everything goes: the dialog lists, before you press anything, exactly which few records stay and why.",
              )}
            </p>
          </div>
          <Button variant="danger" size="sm" onClick={() => setEraseModal(true)}>
            <Trash2 className="h-4 w-4" aria-hidden />
            {t("Delete account")}
          </Button>
        </Card>
      </div>

      {/* --------------------------------------------------- Language and voice */}
      <Modal
        open={section === "language"}
        onClose={closeSection}
        title="Language and voice"
        description="How the guide speaks and listens to you."
        footer={
          <Button variant="outline" onClick={closeSection}>
            {t("Done")}
          </Button>
        }
      >
        <div className="space-y-4">
          <div className="space-y-2.5 rounded-2xl bg-canvas p-4">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
              <LanguagesIcon className="h-4 w-4 text-brand-dark" aria-hidden />
              {t("Interface language")}
            </p>
            <PillGroup
              items={[
                { value: "en", label: "English" },
                { value: "hi", label: "हिन्दी" },
              ]}
              value={uiLang}
              onChange={(next) => setUiLang(next === "hi" ? "hi" : "en")}
            />
            <p className="text-xs leading-relaxed text-muted">
              {t(
                "This changes the menus, buttons and page titles on this device, and it stays as you left it. Nothing else switches it — not even a Hindi conversation. Reply language below is a separate thing, and that one does follow how you actually talk.",
              )}
            </p>
          </div>

          <Select
            label="Reply language"
            options={[...LANGUAGE_OPTIONS].map((option) => ({ ...option }))}
            value={language}
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
            (voices.data?.voices ?? []).map((group) => {
              const active = group.language === activeGroup;
              return (
                <Select
                  key={group.language}
                  label={
                    group.language === "hi"
                      ? "Voice — Hindi"
                      : group.language === "en"
                        ? "Voice — English (also used for Hinglish)"
                        : tf("Voice — {language}", { language: group.language })
                  }
                  options={group.voices.map((voice) => ({ value: voice.id, label: voice.label }))}
                  placeholder="Use the default voice"
                  value={active ? (settings?.voice ?? "") : ""}
                  disabled={!active}
                  onChange={(event) => void patchSettings({ voice: event.target.value || null })}
                  hint={
                    active
                      ? voices.data?.note
                      : "Not available for your current reply language — switch the language above to pick from this set."
                  }
                />
              );
            })
          )}

          <div className="space-y-3 rounded-2xl bg-canvas p-4">
            <Toggle
              checked={settings?.speak_responses ?? false}
              onChange={(next) => void patchSettings({ speak_responses: next })}
              label={
                <span className="inline-flex items-center gap-1.5">
                  <Volume2 className="h-4 w-4 text-brand-dark" aria-hidden />
                  {t("Read replies aloud")}
                </span>
              }
              description="Replies are read aloud by the server's speech service — the one named just below — and by your browser's own voice if that fails. Either way it is not a human voice, and the words stay on screen."
            />
            <Toggle
              checked={settings?.continuous_conversation ?? false}
              onChange={(next) => void patchSettings({ continuous_conversation: next })}
              label={
                <span className="inline-flex items-center gap-1.5">
                  <Mic className="h-4 w-4 text-brand-dark" aria-hidden />
                  {t("Hands-free conversation on calls")}
                </span>
              }
              description="Keeps listening during an open call so you do not tap each turn. It never listens between calls, and nothing is recorded."
            />
          </div>

          <div className="space-y-2.5 rounded-2xl bg-canvas p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-ink">{t("The server's voice")}</p>
              <Button
                variant="outline"
                size="sm"
                loading={voiceTest.busy}
                onClick={() => void testVoice()}
              >
                <Volume2 className="h-4 w-4" aria-hidden />
                {t("Test the voice")}
              </Button>
            </div>
            <p className="text-xs leading-relaxed text-muted">{voiceStatusLine}</p>
            {voiceTest.message ? (
              <p
                role="status"
                className={cn(
                  "rounded-xl px-3 py-2 text-xs leading-relaxed",
                  voiceTest.ok ? "bg-success-mist text-green-900" : "bg-warning-mist/60 text-ink",
                )}
              >
                {voiceTest.message}{" "}
                {voiceTest.ok
                  ? t("If you heard it, replies are spoken by the server in this browser.")
                  : t(
                      "Your browser's own voice still reads replies aloud, and it sounds different.",
                    )}
              </p>
            ) : null}
          </div>

          {health.state === "ready" && health.data?.demo_mode ? (
            <p className="flex items-start gap-1.5 rounded-xl bg-warning-mist/60 px-3.5 py-2.5 text-xs leading-relaxed text-ink">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700" aria-hidden />
              {t(
                "Answers come from a built-in demo guide until an AI key is added on the server. The demo still walks you through real exploration — but replies are scripted samples.",
              )}
            </p>
          ) : null}
          {health.state === "error" ? (
            <ErrorState
              title="Server status unknown"
              description={health.error ?? undefined}
              onRetry={loadHealth}
            />
          ) : null}
        </div>
      </Modal>

      {/* ---------------------------------------------------------- My profile */}
      <Modal
        open={section === "profile"}
        onClose={closeSection}
        title={isStudent ? "My profile" : "My account"}
        description={
          isStudent
            ? "Only coarse details are stored — never your full name at school, address, documents, Aadhaar, bank details or passwords. We do not ask for those, ever."
            : "You are signed in as a parent, so your profile has no class, age or interests — those belong to your child's own account."
        }
        footer={
          <Button variant="outline" onClick={closeSection}>
            {t("Done")}
          </Button>
        }
      >
        {isStudent ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                label="Class"
                options={classOptions}
                placeholder="Not set"
                value={view.class_level ?? ""}
                onChange={(event) => void patchProfile({ class_level: event.target.value || null })}
                hint="Sets how simply the guide explains things."
              />
              <AgeField age={view.age ?? null} onCommit={(years) => void patchProfile({ age: years })} />
            </div>

            <div>
              <p className="mb-1.5 block text-sm font-medium text-ink">
                {t("Interests")} <span className="text-xs font-normal text-muted">{t("(pick up to 12)")}</span>
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
                      {t(interest)}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-muted">
                {t(
                  "Interests are things you might enjoy trying — they never decide what you are allowed to become.",
                )}
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
        ) : (
          <div>
            <Input label="Display name" value={user?.display_name ?? ""} readOnly disabled />
            <p className="mt-1.5 text-xs text-muted">
              {t(
                "Your child's name and profile live on their account and can only be changed by them.",
              )}
            </p>
          </div>
        )}
      </Modal>

      {/* ------------------------------------------------------------- Account */}
      <Modal
        open={section === "account"}
        onClose={closeSection}
        title="Account and email sign-in"
        description="How this account is held, what you can add to it, and what it does not have."
        footer={
          <Button variant="outline" onClick={closeSection}>
            {t("Done")}
          </Button>
        }
      >
        <div className="space-y-5">
          <div className="rounded-2xl bg-canvas p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-ink">
              <Mail className="h-4 w-4 shrink-0 text-brand-dark" aria-hidden />
              {clerk.data?.linked
                ? t("An email opens this account too")
                : t("This browser is the account")}
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted">
              {clerk.state === "loading"
                ? t("Asking the server whether an email is connected…")
                : clerk.state === "error"
                  ? clerk.error
                  : t(clerk.data?.note ?? "")}
            </p>
            {clerk.data?.linked && clerk.data.linked_at ? (
              <p className="mt-1.5 text-xs text-muted">
                {t("Connected")} {relativeTime(clerk.data.linked_at)}.
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
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
            <LinkButton href="/app/profile" variant="outline" size="sm">
              <UserRound className="h-4 w-4" aria-hidden />
              {t("My profile")}
            </LinkButton>
          </div>

          {!clerkEnabled() ? (
            <p className="rounded-2xl border border-line p-4 text-xs leading-relaxed text-muted">
              {t(
                "Email sign-in is not switched on for this site, and that is the operator's choice, not yours: it needs both",
              )}{" "}
              <code className="font-mono">{CLERK_SECRET_ENV}</code> {t("on the backend and")}{" "}
              <code className="font-mono">{CLERK_PUBLISHABLE_ENV}</code>{" "}
              {t("on the frontend, plus a webhook pointed at")}{" "}
              <code className="font-mono">{CLERK_WEBHOOK_ROUTE}</code>
              {t(
                ". Until then nothing is different here — this browser keeps your work, and there is no email or password that could be lost. The one control that can end this account is the Delete account card at the bottom of this screen, and only you can press it.",
              )}
            </p>
          ) : null}

          <div className="space-y-2">
            <SubHeading>What this account does not have</SubHeading>
            <ul className="space-y-2 text-xs leading-relaxed text-muted">
              <li className="flex gap-2">
                <BellOff className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
                <span>
                  <strong className="font-semibold text-ink">{t("Notifications.")}</strong>{" "}
                  {t(
                    "Nothing in this app messages you, reminds you or rings you — you come to it when you want to. So there is no notification switch to offer, and no switch is hiding somewhere else.",
                  )}
                </span>
              </li>
              <li className="flex gap-2">
                <Download className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
                <span>
                  <strong className="font-semibold text-ink">{t("Export.")}</strong>{" "}
                  {t(
                    "The report PDF on your Reports page is the only export there is today. There is no button yet that hands over every conversation, every saved career and every answer at once.",
                  )}
                </span>
              </li>
              <li className="flex gap-2">
                <Trash2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
                <span>
                  <strong className="font-semibold text-ink">{t("Delete account.")}</strong>{" "}
                  {t(
                    "The card at the bottom of this screen erases this account in one step: the conversations and messages, the assessments with their answers and results, the reports and the PDFs printed from them, the plans, saved careers, the resume as it was written, profile, settings and every consent go, and every device signs out. There is no password, phone number or email to delete, because this account was never made from one. The dialog lists the few records that stay, and why, before you press anything. Clearing conversations and starting over on this device still work on their own, for someone who wants one without the other.",
                  )}
                </span>
              </li>
            </ul>
          </div>
        </div>
      </Modal>

      {/* -------------------------------------------------- Privacy and consent */}
      <Modal
        open={section === "privacy"}
        onClose={closeSection}
        title="Privacy, consent and display"
        description="What gets stored, what you have agreed to, and how to erase it."
        footer={
          <Button variant="outline" onClick={closeSection}>
            {t("Done")}
          </Button>
        }
      >
        <div className="space-y-5">
          <div className="space-y-4">
            <SubHeading>Storage and appearance</SubHeading>
            <div className="space-y-3 rounded-2xl bg-canvas p-4">
              <Toggle
                checked={settings?.save_history ?? false}
                onChange={(next) => void patchSettings({ save_history: next })}
                label="Save my conversation history"
                description="If this is off, closing a conversation deletes its messages."
              />
              <Toggle
                checked={settings?.reduced_motion ?? false}
                onChange={(next) => void patchSettings({ reduced_motion: next })}
                label={
                  <span className="inline-flex items-center gap-1.5">
                    <Accessibility className="h-4 w-4 text-brand-dark" aria-hidden />
                    {t("Reduce motion")}
                  </span>
                }
                description="Turns off animations and transitions across the whole app."
              />
              <Toggle
                checked={settings?.high_contrast ?? false}
                onChange={(next) => void patchSettings({ high_contrast: next })}
                label={
                  <span className="inline-flex items-center gap-1.5">
                    <Contrast className="h-4 w-4 text-brand-dark" aria-hidden />
                    {t("High contrast")}
                  </span>
                }
                description="Darker text and stronger borders for easier reading."
              />
              {/* Appearance, not an account fact: this is the third control on the
                  device-local pattern next to the two switches above it that do go
                  to the server. Nothing here is sent, so a family sharing one
                  account can keep a bright screen and a dark one. */}
              <div className="space-y-2 border-t border-line pt-3.5">
                <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
                  <Sun className="h-4 w-4 text-brand-dark" aria-hidden />
                  {t("Theme")}
                </p>
                <PillGroup
                  items={[
                    { value: "light", label: "Light", icon: <Sun className="h-4 w-4" aria-hidden /> },
                    { value: "dark", label: "Dark", icon: <Moon className="h-4 w-4" aria-hidden /> },
                    { value: "system", label: "System", icon: <Monitor className="h-4 w-4" aria-hidden /> },
                  ]}
                  value={themeChoice}
                  onChange={(next) =>
                    setThemeChoice(next === "dark" || next === "system" ? next : "light")
                  }
                />
                <p className="text-xs leading-relaxed text-muted">
                  {t(
                    "This changes light and dark on this device only, and it stays as you left it. System follows whatever your phone or browser is set to, including when it changes by itself in the evening.",
                  )}
                </p>
              </div>
            </div>
          </div>

          {isStudent ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line p-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">{t("Delete my conversation history")}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted">
                  {conversations.state === "loading"
                    ? t("Checking your stored conversations…")
                    : conversations.state === "error"
                      ? conversations.error
                      : sessionCount === 0
                        ? t("No conversations are stored right now.")
                        : tf(
                            sessionCount === 1
                              ? "{count} conversation stored. Deleting ends each one and removes its messages."
                              : "{count} conversations stored. Deleting ends each one and removes its messages.",
                            { count: sessionCount },
                          )}
                </p>
              </div>
              <Button
                variant="danger"
                size="sm"
                disabled={conversations.state !== "ready" || sessionCount === 0}
                onClick={() => {
                  closeSection();
                  setHistoryModal(true);
                }}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
                {t("Delete history")}
              </Button>
            </div>
          ) : (
            <p className="rounded-2xl border border-line p-4 text-xs leading-relaxed text-muted">
              {t(
                "Your parent account does not store conversations. Conversation history belongs to each child's own account, and only they can view or delete it.",
              )}
            </p>
          )}

          <div className="space-y-3">
            <SubHeading>Consent records</SubHeading>
            <p className="text-xs text-muted">
              {t(
                "Exactly what you have agreed to, with the date. You can withdraw any of these here at any time — that is what this screen is for.",
              )}
            </p>
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
                        ? tf("Last updated {time} · consent version {version}", {
                            time: relativeTime(record.created_at),
                            version: record.version,
                          })
                        : t("No decision recorded yet — treating this as not granted.")}
                      {" · "}
                      {t(entry.withdraw)}
                    </p>
                  </div>
                );
              })
            )}
          </div>

          <p className="rounded-xl bg-brand-mist/50 px-3.5 py-2.5 text-xs leading-relaxed text-brand-dark">
            {t(
              "What this app protects: your conversations are not shared with parents by default, links only exist because a student chose them, and there are no ads or payments. What it does not protect: this is a demo build without a legal/compliance certification — do not enter real personal documents, and get qualified review before using it with actual children.",
            )}
          </p>
        </div>
      </Modal>

      {/* -------------------------------------------------------- Family access */}
      <Modal
        open={section === "family"}
        onClose={closeSection}
        title="Family access"
        description="A parent can only see a summary if you give them this code — they cannot attach by guessing. You can revoke it any time."
        footer={
          <Button variant="outline" onClick={closeSection}>
            {t("Done")}
          </Button>
        }
      >
        <div className="space-y-5">
          <div>
            <SubHeading>Sharing code</SubHeading>
            <div className="mt-2">
              {shareCode.state === "loading" ? (
                <Skeleton className="h-24" />
              ) : shareCode.state === "error" ? (
                <ErrorState description={shareCode.error ?? undefined} onRetry={loadShareCode} />
              ) : (
                <div className="rounded-2xl bg-canvas p-4">
                  {shareCode.data?.code ? (
                    <div className="flex flex-wrap items-end justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                          {t("Give this to a parent")}
                        </p>
                        <p className="mt-1 font-mono text-2xl font-bold tracking-[0.28em] text-ink sm:text-3xl">
                          {shareCode.data.code}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void copyValue(shareCode.data?.code ?? "", "share")}
                      >
                        {copied === "share" ? (
                          <Check className="h-4 w-4 text-success" aria-hidden />
                        ) : (
                          <Copy className="h-4 w-4" aria-hidden />
                        )}
                        {copied === "share" ? t("Copied") : t("Copy")}
                      </Button>
                    </div>
                  ) : (
                    <p className="text-sm font-medium text-ink">{t("Sharing is currently switched off")}</p>
                  )}
                  {shareCode.data?.note ? (
                    <p className="mt-2 text-xs leading-relaxed text-muted">
                      {t(shareCode.data.note)}
                    </p>
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
                      {t("Generate a new code")}
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
                        {t("Stop sharing")}
                      </Button>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div>
            <SubHeading>Adults who can see your summary</SubHeading>
            <div className="mt-2">
              {guardians.state === "loading" ? (
                <LoadingPanel label="Checking linked adults…" />
              ) : guardians.state === "error" ? (
                <ErrorState description={guardians.error ?? undefined} onRetry={loadGuardians} />
              ) : guardianCount === 0 ? (
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
                            {t("Linked")} {relativeTime(link.linked_at)} {t("· sees summary only")}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            closeSection();
                            setRemoveTarget(link);
                          }}
                        >
                          {t("Remove")}
                        </Button>
                      </div>
                      <div className="mt-3 border-t border-line pt-3">
                        <Toggle
                          checked={link.can_see_transcripts}
                          disabled={busyToggle === `transcripts:${link.guardianship_id}`}
                          onChange={(next) => void setTranscripts(link, next)}
                          label={t(
                            link.can_see_transcripts
                              ? "Conversation text shared: yes"
                              : "Conversation text shared: no",
                          )}
                          description={tf(
                            "Themes and progress are shared either way. Only turn this on if you want {name} to read the actual messages.",
                            { name: link.name },
                          )}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </Modal>

      {/* ------------------------------------------------------------ This device */}
      <Modal
        open={section === "device"}
        onClose={closeSection}
        title="This device"
        description="This prototype has no login, so this browser is what your work belongs to."
        footer={
          <Button variant="outline" onClick={closeSection}>
            {t("Done")}
          </Button>
        }
      >
        <div className="space-y-4">
          <div className="rounded-2xl bg-canvas p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-ink">
              <Smartphone className="h-4 w-4 shrink-0 text-brand-dark" aria-hidden />
              {t("How you are recognised")}
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted">
              {t(
                "The first time this site was opened here, the browser made up a long random number and kept it in its own storage. The server files your work under that number. It is not a name, an email or a password, so there is nothing to remember, write down or lose.",
              )}
            </p>
          </div>

          <ul className="space-y-2 text-xs leading-relaxed text-muted">
            <li className="flex gap-2">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal" aria-hidden />
              {t(
                "Same phone or laptop, same browser: your conversations, saved careers and settings are waiting when you come back.",
              )}
            </li>
            <li className="flex gap-2">
              <EyeOff className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal" aria-hidden />
              {t(
                "A different device, a private window, or cleared site data starts a brand-new student. That is the price of having no sign-in — nothing can bring the old work back, so please do not use a shared or public computer.",
              )}
            </li>
            <li className="flex gap-2">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal" aria-hidden />
              {t(
                "Starting over gives this browser a new identity and stops the current session on the server right away. It deletes nothing by itself: to clear what is stored, delete your conversations from the privacy section first.",
              )}
            </li>
          </ul>

          <Button variant="secondary" size="sm" onClick={() => setResetModal(true)}>
            <RotateCcw className="h-4 w-4" aria-hidden />
            {t("Start over on this device")}
          </Button>
        </div>
      </Modal>

      {/* Start-over confirm */}
      <Modal
        open={resetModal}
        onClose={() => !resetting && setResetModal(false)}
        title="Start over on this device?"
        description="This browser will be treated as somebody who has never been here."
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

      {/* Delete-account confirm. The whole point of this dialog is that it does not say
          "everything goes" when three things do not go. */}
      <Modal
        open={eraseModal}
        onClose={() => !erasing && setEraseModal(false)}
        title="Delete this account for good?"
        description="There is no undo, and there is no email to confirm with: this browser's session is the only proof of whose account this is. That is why this dialog is the last step."
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setEraseModal(false)} disabled={erasing}>
              {t("Keep my work")}
            </Button>
            <Button variant="danger" loading={erasing} onClick={() => void doErase()}>
              <Trash2 className="h-4 w-4" aria-hidden />
              {t("Delete it")}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold text-ink">{t("Gone from the database")}</p>
            <ul className="mt-1.5 space-y-1 text-xs leading-relaxed text-muted">
              {ERASE_GOES.map((line) => (
                <li key={line} className="flex gap-2">
                  <Trash2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger" aria-hidden />
                  <span>{t(line)}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-sm font-semibold text-ink">{t("Stays, and why")}</p>
            <ul className="mt-1.5 space-y-1 text-xs leading-relaxed text-muted">
              {ERASE_KEPT.map((line) => (
                <li key={line} className="flex gap-2">
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal" aria-hidden />
                  <span>{t(line)}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="rounded-2xl bg-canvas p-3 text-xs leading-relaxed text-muted">
            {t(
              "This is the app's own erasure step. Whether it satisfies a particular law is a question for whoever runs the site and their own adviser — a button here cannot claim that answer, and this page does not try to.",
            )}
          </p>
          <p className="text-xs leading-relaxed text-muted">
            {t(
              "If this account is the one that runs the site, the server refuses and says why: an operator is closed by another operator, so the log keeps saying who stopped being able to change things.",
            )}
          </p>

          {eraseError ? (
            <p role="alert" className="rounded-card border border-danger/30 bg-danger-mist p-3 text-xs leading-relaxed text-ink">
              {eraseError}
            </p>
          ) : null}
        </div>
      </Modal>

      {/* ------------------------------------------------------- About this build */}
      <Modal
        open={section === "about"}
        onClose={closeSection}
        title="About this build"
        description="Honest limitations, in plain words."
        footer={
          <Button variant="outline" onClick={closeSection}>
            {t("Done")}
          </Button>
        }
      >
        <ul className="space-y-3 text-sm leading-relaxed text-muted">
          {BUILD_NOTES.map((note) => (
            <li key={note.text} className="flex gap-2.5">
              <note.icon className="mt-0.5 h-4 w-4 shrink-0 text-teal" aria-hidden />
              {t(note.text)}
            </li>
          ))}
        </ul>
      </Modal>

      {/* Delete-history confirm */}
      <Modal
        open={historyModal}
        onClose={() => !clearingHistory && setHistoryModal(false)}
        title="Delete your conversation history?"
        description={tf(
          sessionCount === 1
            ? "This ends and clears {count} conversation — the messages, not your saved careers or themes."
            : "This ends and clears {count} conversations — the messages, not your saved careers or themes.",
          { count: sessionCount },
        )}
        footer={
          <>
            <Button variant="outline" onClick={() => setHistoryModal(false)} disabled={clearingHistory}>
              {t("Keep them")}
            </Button>
            <Button variant="danger" loading={clearingHistory} onClick={() => void clearAllHistory()}>
              {tf(
                sessionCount === 1
                  ? "Delete {count} conversation"
                  : "Delete {count} conversations",
                { count: sessionCount },
              )}
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-muted">
          {t(
            "This cannot be undone from this screen. Saved careers, interest themes and your journey counts stay — only the message text is deleted. If you want everything gone, that is fine: delete the history, then remove careers you saved from the explorer.",
          )}
        </p>
      </Modal>

      {/* Remove guardian confirm */}
      <Modal
        open={removeTarget !== null}
        onClose={() => !removing && setRemoveTarget(null)}
        title="Remove this adult's access?"
        description={
          removeTarget
            ? tf("{name} will no longer see your summary.", { name: removeTarget.name })
            : undefined
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setRemoveTarget(null)} disabled={removing}>
              {t("Keep the link")}
            </Button>
            <Button variant="danger" loading={removing} onClick={() => void confirmRemoveGuardian()}>
              {t("Remove access")}
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-muted">
          {t(
            "Removing access is your choice and takes effect immediately. Nothing about your account is deleted — if you ever want",
          )}{" "}
          {removeTarget?.name ?? t("this adult")}{" "}
          {t("to see a summary again, you would share a new code.")}
        </p>
      </Modal>
    </Screen>
  );
}
