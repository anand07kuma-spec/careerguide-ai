import { SettingsPageShell } from "@/components/settings/settings-page-shell";
import { AboutSettings } from "@/components/settings/about-settings";

export default function AboutSettingsPage() {
  return (
    <SettingsPageShell
      title="About CareerGuide AI"
      description="Learn about the platform that supports your career journey."
    >
      <AboutSettings />
    </SettingsPageShell>
  );
}
