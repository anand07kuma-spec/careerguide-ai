import { SettingsPageShell } from "@/components/settings/settings-page-shell";
import { FamilySettings } from "@/components/settings/family-settings";

export default function FamilySettingsPage() {
  return (
    <SettingsPageShell
      title="Family Access"
      description="Manage how your parent or guardian stays connected with your learning progress."
    >
      <FamilySettings />
    </SettingsPageShell>
  );
}
