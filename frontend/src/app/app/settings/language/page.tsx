import { SettingsPageShell } from "@/components/settings/settings-page-shell";
import { LanguageVoiceSettings } from "@/components/settings/language-voice-settings";

export default function LanguageVoiceSettingsPage() {
  return (
    <SettingsPageShell
      title="Language & Voice"
      description="Personalize how CareerGuide AI communicates with you."
    >
      <LanguageVoiceSettings />
    </SettingsPageShell>
  );
}
