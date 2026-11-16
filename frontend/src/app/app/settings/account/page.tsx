import { SettingsPageShell } from "@/components/settings/settings-page-shell";
import { AccountSettings } from "@/components/settings/account-settings";

export default function AccountSettingsPage() {
  return (
    <SettingsPageShell
      title="Account & Sign-in"
      description="Manage your account and login security."
    >
      <AccountSettings />
    </SettingsPageShell>
  );
}
