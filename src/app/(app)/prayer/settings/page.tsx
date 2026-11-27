import { requireProfile } from "@/lib/auth";
import { getPrayerOverview } from "@/lib/prayer/service";
import { PrayerSettingsForm } from "@/components/prayer/PrayerSettingsForm";

export const dynamic = "force-dynamic";

export default async function PrayerSettingsPage() {
  const { user } = await requireProfile();
  const overview = await getPrayerOverview(user);

  return (
    <PrayerSettingsForm
      settings={overview.settings}
      todayState={overview.todayState.state}
      dateKey={overview.todayKey}
      timezone={user.timezone}
    />
  );
}
