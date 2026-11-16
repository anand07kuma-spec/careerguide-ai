"use client";

import { useCallback, useEffect, useState } from "react";
import { AudioLines, Check, Info, Mic, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/feedback";
import { Select, Switch } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { setUiLang, useT, useUiLang } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import type { Health, Settings, VoiceInfo } from "@/lib/types";
import { cn, relativeTime } from "@/lib/utils";
import { useAudioPlayer } from "@/lib/voice";
import {
  ChoicePills,
  DetailNote,
  Segmented,
  SettingsCard,
  SettingsItem,
} from "./settings-page-shell";
import { initial, messageFor, type Resource } from "./settings-shared";

/** Which voice group applies to the chosen reply language (hinglish uses English voices). */
function voiceGroupFor(language: string): string {
  return language === "hi" ? "hi" : "en";
}

const REPLY_LANGUAGES = [
  { value: "en", label: "English" },
  { value: "hi", label: "हिन्दी" },
  { value: "hinglish", label: "Hinglish" },
];

const SPEEDS = [
  { value: "slow", label: "Slow" },
  { value: "normal", label: "Normal" },
  { value: "fast", label: "Fast" },
];

export function LanguageVoiceSettings() {
  const { settings, saveSettings } = useSession();
  const { toast } = useToast();
  const t = useT();
  const uiLang = useUiLang();
  const player = useAudioPlayer();

  const [voices, setVoices] = useState<Resource<VoiceInfo>>(initial);
  const [health, setHealth] = useState<Resource<Health>>(initial);
  // Language & Voice edits are held here until "Save Changes" is pressed. The
  // session's own settings stay untouched until then, so a failed save leaves the
  // committed values intact and the draft still on screen to try again.
  const [langDraft, setLangDraft] = useState<Partial<Settings>>({});
  const [savingLang, setSavingLang] = useState(false);
  const [voiceTest, setVoiceTest] = useState<{ busy: boolean; ok: boolean; message: string }>({
    busy: false,
    ok: false,
    message: "",
  });

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

  useEffect(() => {
    // Fetching is the whole purpose of this effect, and every setState inside
    // these loaders happens after an await.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadVoices();
    void loadHealth();
  }, [loadVoices, loadHealth]);

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

  const language = settings?.language ?? "en";
  // What this panel is showing: the committed setting with the draft laid over it.
  const shownLanguage = langDraft.language ?? language;
  const shownVoice =
    "voice" in langDraft ? (langDraft.voice ?? null) : (settings?.voice ?? null);
  const shownSpeak = langDraft.speak_responses ?? settings?.speak_responses ?? false;
  const shownHandsFree =
    langDraft.continuous_conversation ?? settings?.continuous_conversation ?? false;
  const activeGroup = voiceGroupFor(shownLanguage);
  const languageDirty = Object.entries(langDraft).some(([key, value]) => {
    const committed = settings ? (settings[key as keyof Settings] ?? null) : null;
    return (value ?? null) !== committed;
  });

  // `tts_ready` only says the settings are complete. This verdict comes from the
  // last time audio was really asked for, and one made against a different
  // service — before a key was added, say — does not count for the current one.
  const attempt = health.data?.tts_last_attempt ?? null;
  const lastVoiceTry =
    attempt && attempt.ok !== null && attempt.provider === health.data?.tts_provider
      ? attempt
      : null;
  const voiceStatusLine =
    health.state === "loading"
      ? "Asking the server which speech service it uses…"
      : health.state === "error"
        ? "The server could not be reached, so its voice is unknown."
        : lastVoiceTry?.ok === true
          ? `${lastVoiceTry.provider} turned a reply into real audio${
              lastVoiceTry.checked_at ? ` ${relativeTime(lastVoiceTry.checked_at)}` : ""
            }.`
          : lastVoiceTry?.ok === false
            ? `${lastVoiceTry.provider} was asked and refused: ${
                lastVoiceTry.reason ?? "no audio came back"
              } Replies are read by your browser's own voice instead.`
            : `Nothing has been spoken by ${
                health.data?.tts_provider ?? "the server"
              } yet. Run the test below to ask it for audio.`;

  const saveLanguage = useCallback(async () => {
    if (!languageDirty) return;
    setSavingLang(true);
    try {
      await saveSettings(langDraft);
      setLangDraft({});
      toast("Voice and language settings saved.", "success");
    } catch (error) {
      toast(messageFor(error), "error");
    } finally {
      setSavingLang(false);
    }
  }, [langDraft, languageDirty, saveSettings, toast]);

  const activeVoices =
    voices.data?.voices.find((group) => group.language === activeGroup)?.voices ?? [];
  // A saved voice that is not in this language's list stays visible rather than
  // silently disappearing from the control that set it.
  const voiceChoices = shownVoice
    ? [
        { value: shownVoice, label: shownVoice },
        ...activeVoices
          .filter((voice) => voice.id !== shownVoice)
          .map((voice) => ({ value: voice.id, label: voice.label })),
      ]
    : activeVoices.map((voice) => ({ value: voice.id, label: voice.label }));

  return (
    <>
      <SettingsCard
        title={t("Language Preferences")}
        description={t("Choose the language the guide opens with, and the language of this screen.")}
      >
        <div className="px-5 py-5 sm:px-6">
          <p className="text-sm font-medium text-ink">{t("Preferred language")}</p>
          <p className="mt-0.5 max-w-2xl text-xs leading-relaxed text-muted">
            {t(
              "How the guide opens the conversation. It answers in whatever language you actually use, and Hinglish mixes Hindi and English the way friends talk.",
            )}
          </p>
          <div className="mt-3">
            <ChoicePills
              items={REPLY_LANGUAGES}
              value={shownLanguage}
              onChange={(next) => setLangDraft((draft) => ({ ...draft, language: next }))}
              label="Preferred language"
            />
          </div>
        </div>
        <div className="border-t border-settings-line px-5 py-4 sm:px-6">
          <p className="text-sm font-medium text-ink">{t("Interface language")}</p>
          <p className="mt-0.5 max-w-2xl text-xs leading-relaxed text-muted">
            {t(
              "This changes the menus, buttons and page titles on this device, and it stays as you left it. Nothing else switches it — not even a Hindi conversation.",
            )}
          </p>
          <div className="mt-3">
            <ChoicePills
              items={[
                { value: "en", label: "English" },
                { value: "hi", label: "हिन्दी" },
              ]}
              value={uiLang}
              onChange={(next) => setUiLang(next === "hi" ? "hi" : "en")}
              label="Interface language"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-settings-line bg-settings-page px-5 py-3.5 sm:px-6">
          <p
            className={cn(
              "text-xs leading-relaxed",
              languageDirty ? "font-medium text-brand-dark" : "text-muted",
            )}
          >
            {languageDirty ? t("Unsaved changes") : t("All changes saved")}
          </p>
          <Button
            variant="primary"
            size="sm"
            loading={savingLang}
            disabled={!languageDirty || savingLang}
            onClick={() => void saveLanguage()}
          >
            <Check className="h-4 w-4" aria-hidden />
            {t("Save Changes")}
          </Button>
        </div>
      </SettingsCard>

      <SettingsCard
        icon={Mic}
        tone="bg-tile-lavender text-on-tile-lavender"
        title={t("Voice Responses")}
        description={t("Enable or disable spoken replies. The words always stay on screen.")}
        action={
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted">{shownSpeak ? t("On") : t("Off")}</span>
            <Switch
              checked={shownSpeak}
              onChange={(next) => setLangDraft((draft) => ({ ...draft, speak_responses: next }))}
              ariaLabel={t("Voice responses")}
            />
          </div>
        }
      >
        <SettingsItem
          title={t("Voice type")}
          description={t("Which voice reads replies, when the chosen language is spoken.")}
        >
          <div className="w-full sm:w-60">
            {voices.state === "loading" ? (
              <Select
                aria-label={t("Voice type")}
                options={[]}
                placeholder="Checking available voices…"
                value=""
                disabled
                onChange={() => undefined}
              />
            ) : voices.state === "error" ? (
              <Button variant="outline" size="sm" onClick={() => void loadVoices()}>
                {t("Retry the voice list")}
              </Button>
            ) : (
              <Select
                aria-label={t("Voice type")}
                options={[{ value: "", label: "Use the default voice" }, ...voiceChoices]}
                value={shownVoice ?? ""}
                onChange={(event) =>
                  setLangDraft((draft) => ({ ...draft, voice: event.target.value || null }))
                }
              />
            )}
          </div>
        </SettingsItem>
        <SettingsItem
          title={t("Hear a sample")}
          description={t(
            "Ask the server for one short clip. This is the only proof of which speech service really speaks.",
          )}
        >
          <Button variant="outline" size="sm" loading={voiceTest.busy} onClick={() => void testVoice()}>
            <Volume2 className="h-4 w-4" aria-hidden />
            {t("Test the voice")}
          </Button>
        </SettingsItem>
        <div className="space-y-2 px-5 pb-4 sm:px-6">
          <DetailNote>{voiceStatusLine}</DetailNote>
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
                : t("Your browser's own voice still reads replies aloud, and it sounds different.")}
            </p>
          ) : null}
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
      </SettingsCard>

      <SettingsCard
        icon={AudioLines}
        tone="bg-tile-peach text-on-tile-peach"
        title={t("Speaking Experience")}
        description={t("How replies are paced, and whether the guide keeps listening.")}
      >
        <SettingsItem
          title={t("Speaking speed")}
          description={t(
            "Replies play at one steady pace today. Choosing a pace is not supported yet, so this control is deliberately off.",
          )}
        >
          <Segmented items={SPEEDS} value="normal" disabled label="Speaking speed" />
        </SettingsItem>
        <SettingsItem
          title={t("Hands-free mode")}
          description={t(
            "Keeps listening during an open call so you do not tap each turn. It never listens between calls, and nothing is recorded.",
          )}
        >
          <Switch
            checked={shownHandsFree}
            onChange={(next) =>
              setLangDraft((draft) => ({ ...draft, continuous_conversation: next }))
            }
            ariaLabel={t("Hands-free mode")}
          />
        </SettingsItem>
      </SettingsCard>
    </>
  );
}
