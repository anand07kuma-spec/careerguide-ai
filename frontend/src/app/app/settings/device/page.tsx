import { SettingsPageShell } from "@/components/settings/settings-page-shell";
import { DeviceSettings } from "@/components/settings/device-settings";

export default function DeviceSettingsPage() {
  return (
    <SettingsPageShell
      title="This Device"
      description="Manage this browser and your current device access."
    >
      <DeviceSettings />
    </SettingsPageShell>
  );
}
