"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Accessibility,
  Download,
  MessageSquare,
  Moon,
  Monitor,
  ShieldCheck,
  Sun,
  Trash2,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { Switch } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { PillGroup } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { setThemeChoice, useThemeChoice } from "@/lib/theme";
import type { ConsentRecord, ConversationInfo, Settings } from "@/lib/types";
import { relativeTime } from "@/lib/utils";
import {
  DetailNote,
  SettingsCard,
  SettingsItem,
  StatusPill,
} from "./settings-page-shell";
import { initial, messageFor, type Resource } from "./settings-shared";

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
      "Lets an adult you approve see the themes, saved careers and progress counts on their dashboard. Approving a request in Family Access turns this on. Your conversation text is never included unless you switch it on for that adult.",
    withdraw:
      "Withdraw any time — every guardian link ends immediately and their dashboard stops.",
  },
];

export function PrivacySettings() {
  const { settings, isStudent, saveSettings } = useSession();
  const { toast } = useToast();
  const t = useT();
  const themeChoice = useThemeChoice();

  const [conversations, setConversations] = useState<Resource<ConversationInfo[]>>(initial);
  const [consent, setConsent] = useState<Resource<ConsentRecord[]>>(initial);
  const [busyToggle, setBusyToggle] = useState<string | null>(null);
  const [historyModal, setHistoryModal] = useState(false);
  const [clearingHistory, setClearingHistory] = useState(false);

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

  useEffect(() => {
    // Fetching is the whole purpose of this effect, and every setState inside
    // those loaders happens after an await.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadConsent();
    if (isStudent) void loadConversations();
  }, [isStudent, loadConsent, loadConversations]);

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
        ? `Deleted the messages and interest notes from ${sessions.length} conversation${sessions.length === 1 ? "" : "s"}.`
        : `${sessions.length - failures} of ${sessions.length} conversations cleared. Try again for the rest.`,
      failures === 0 ? "success" : "error",
    );
  }, [conversations.data, loadConversations, toast]);

  const consentByScope = useMemo(() => {
    const map = new Map<string, ConsentRecord>();
    for (const record of consent.data ?? []) map.set(record.scope, record); // later wins = latest
    return map;
  }, [consent.data]);

  const sessionCount = (conversations.data ?? []).length;

  const conversationSummary =
    conversations.state === "loading"
      ? t("Checking your stored conversations…")
      : conversations.state === "error"
        ? conversations.error
        : sessionCount === 0
          ? t("No conversations are stored right now.")
          : `${sessionCount} ${
              sessionCount === 1 ? t("conversation stored") : t("conversations stored")
            }. ${t(
              "Deleting ends each one, removes its messages, and clears the interest notes it produced.",
            )}`;

  return (
    <>
      <div className="space-y-4">
        <SettingsCard
          icon={UserRound}
          tone="bg-tile-blue text-on-tile-blue"
          title="Personal Data"
          description="What this account holds, and who it was ever meant for."
          bodyClassName="divide-y divide-settings-line"
        >
          <SettingsItem
            title="What is stored"
            description="Your class, age, school setting and interests; your conversations and assessments; the reports and plans made from them; and the resume you wrote."
          />
          <SettingsItem
            title="Who can see it"
            description="Only you, on this browser. A parent sees just the summary you choose to share through Family Access — never the conversation text unless you switch that on for them."
          />
          <div className="px-5 py-4 sm:px-6">
            <DetailNote>
              {t(
                "There are no ads, no selling of data and no third-party analytics on this build. It is a demo without a legal or compliance certification — do not enter real personal documents, and get qualified review before using it with actual children.",
              )}
            </DetailNote>
          </div>
        </SettingsCard>

        <SettingsCard
          icon={MessageSquare}
          tone="bg-tile-lavender text-on-tile-lavender"
          title="AI & Conversation History"
          description="What the guide keeps after a conversation closes."
          bodyClassName="divide-y divide-settings-line"
        >
          <SettingsItem
            title="Save my conversation history"
            description="If this is off, closing a conversation deletes its messages and the interest notes it produced."
          >
            <Switch
              checked={settings?.save_history ?? false}
              onChange={(next) => void patchSettings({ save_history: next })}
              ariaLabel={t("Save my conversation history")}
            />
          </SettingsItem>
          {isStudent ? (
            <SettingsItem
              title="Stored conversations"
              description={conversationSummary}
            >
              <StatusPill tone={sessionCount > 0 ? "brand" : "neutral"}>
                {conversations.state === "loading"
                  ? t("Checking…")
                  : sessionCount === 0
                    ? t("None stored")
                    : `${sessionCount}`}
              </StatusPill>
            </SettingsItem>
          ) : (
            <div className="px-5 py-4 sm:px-6">
              <DetailNote>
                {t(
                  "A parent account stores no conversations. Conversation history belongs to each child's own account, and only they can view or delete it.",
                )}
              </DetailNote>
            </div>
          )}
        </SettingsCard>

        <SettingsCard
          icon={ShieldCheck}
          tone="bg-tile-mint text-on-tile-mint"
          title="Consent Preferences"
          description="Exactly what you have agreed to, with the date. You can withdraw any of these here at any time."
          bodyClassName="divide-y divide-settings-line"
        >
          {consent.state === "loading" ? (
            <div className="space-y-3 px-5 py-4 sm:px-6">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
          ) : consent.state === "error" ? (
            <div className="px-5 py-4 sm:px-6">
              <ErrorState
                description={consent.error ?? undefined}
                onRetry={loadConsent}
              />
            </div>
          ) : (
            CONSENT_SCOPES.map((entry) => {
              const record = consentByScope.get(entry.scope);
              const granted = record?.granted ?? false;
              const busy = busyToggle === `consent:${entry.scope}`;
              return (
                <div key={entry.scope} className="px-5 py-4 sm:px-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink">{t(entry.label)}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted">{t(entry.grant)}</p>
                    </div>
                    <Switch
                      checked={granted}
                      disabled={busy}
                      onChange={(next) => void setConsentScope(entry.scope, next)}
                      ariaLabel={t(entry.label)}
                    />
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-muted">
                    {record
                      ? `${t("Last updated")} ${relativeTime(record.created_at)} · ${t("consent version")} ${record.version}`
                      : t("No decision recorded yet — treating this as not granted.")}
                    {" · "}
                    {t(entry.withdraw)}
                  </p>
                </div>
              );
            })
          )}
        </SettingsCard>

        <SettingsCard
          icon={Download}
          tone="bg-tile-peach text-on-tile-peach"
          title="Data Management"
          description="Taking a copy, or taking it all back."
          bodyClassName="divide-y divide-settings-line"
        >
          <SettingsItem
            title="Download my data"
            description="The report PDF on your Reports page is the only export today. There is no button yet that hands over every conversation, every saved career and every answer at once."
          >
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill tone="neutral">{t("Not available yet")}</StatusPill>
              <Button variant="outline" size="sm" disabled>
                <Download className="h-4 w-4" aria-hidden />
                {t("Download")}
              </Button>
            </div>
          </SettingsItem>
          {isStudent ? (
            <SettingsItem
              title="Delete conversation history"
              description={conversationSummary}
            >
              <Button
                variant="danger"
                size="sm"
                disabled={conversations.state !== "ready" || sessionCount === 0}
                onClick={() => setHistoryModal(true)}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
                {t("Delete history")}
              </Button>
            </SettingsItem>
          ) : null}
          <div className="px-5 py-4 sm:px-6">
            <DetailNote>
              {t(
                "Deleting history clears your conversations and the interest notes they produced. To remove the whole account — profile, assessments, reports, plans, resume and sign-in — use Delete account on the main Settings page.",
              )}
            </DetailNote>
          </div>
        </SettingsCard>

        <SettingsCard
          icon={Accessibility}
          tone="bg-tile-slate text-on-tile-slate"
          title="Reading & appearance"
          description="Comfort settings. Motion and contrast are stored with your account; the theme is kept on this device."
          bodyClassName="divide-y divide-settings-line"
        >
          <SettingsItem
            title="Reduce motion"
            description="Turns off animations and transitions across the whole app."
          >
            <Switch
              checked={settings?.reduced_motion ?? false}
              onChange={(next) => void patchSettings({ reduced_motion: next })}
              ariaLabel={t("Reduce motion")}
            />
          </SettingsItem>
          <SettingsItem
            title="High contrast"
            description="Darker text and stronger borders for easier reading."
          >
            <Switch
              checked={settings?.high_contrast ?? false}
              onChange={(next) => void patchSettings({ high_contrast: next })}
              ariaLabel={t("High contrast")}
            />
          </SettingsItem>
          <div className="px-5 py-4 sm:px-6">
            <p className="text-sm font-medium text-ink">{t("Theme")}</p>
            <div className="mt-2.5">
              <PillGroup
                items={[
                  { value: "light", label: t("Light"), icon: <Sun className="h-4 w-4" aria-hidden /> },
                  { value: "dark", label: t("Dark"), icon: <Moon className="h-4 w-4" aria-hidden /> },
                  { value: "system", label: t("System"), icon: <Monitor className="h-4 w-4" aria-hidden /> },
                ]}
                value={themeChoice}
                onChange={(next) =>
                  setThemeChoice(next === "dark" || next === "system" ? next : "light")
                }
              />
            </div>
            <p className="mt-2.5 text-xs leading-relaxed text-muted">
              {t(
                "This changes light and dark on this device only, and it stays as you left it. System follows whatever your phone or browser is set to, including when it changes by itself in the evening.",
              )}
            </p>
          </div>
        </SettingsCard>
      </div>

      {/* Delete-history confirm */}
      <Modal
        open={historyModal}
        onClose={() => !clearingHistory && setHistoryModal(false)}
        title="Delete your conversation history?"
        description={`This ends and clears ${sessionCount} conversation${sessionCount === 1 ? "" : "s"} — the messages and the interest notes each conversation produced. Saved careers, assessments, reports and your profile stay.`}
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
          This cannot be undone from this screen. Every message and every interest note the guide
          wrote from these conversations is deleted. Saved careers, assessment answers, reports,
          plans, your profile and resume stay, as do interest notes saved separately from an
          assessment. To erase the whole account instead, use Delete account on the main Settings
          page.
        </p>
      </Modal>
    </>
  );
}
