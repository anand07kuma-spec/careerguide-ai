import { SettingsPageShell } from "@/components/settings/settings-page-shell";
import { ProfileSettings } from "@/components/settings/profile-settings";

export default function ProfileSettingsPage() {
  return (
    <SettingsPageShell
      title="My Profile"
      description="Manage your personal information and learning profile."
    >
      <ProfileSettings />
    </SettingsPageShell>
  );
}
