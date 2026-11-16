import { SettingsPageShell } from "@/components/settings/settings-page-shell";
import { PrivacySettings } from "@/components/settings/privacy-settings";

export default function PrivacySettingsPage() {
  return (
    <SettingsPageShell
      title="Privacy & Consent"
      description="Understand and control how your information is used."
    >
      <PrivacySettings />
    </SettingsPageShell>
  );
}
