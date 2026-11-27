import { requireProfile } from "@/lib/auth";
import { getMindResetSettings } from "@/lib/mindreset/service";
import { MindResetSettingsForm } from "@/components/mindreset/MindResetSettingsForm";

export const dynamic = "force-dynamic";

export default async function MindResetSettingsPage() {
  const { user } = await requireProfile();
  const settings = await getMindResetSettings(user.id);

  return <MindResetSettingsForm initial={settings} />;
}
