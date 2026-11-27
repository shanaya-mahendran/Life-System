import { requireProfile } from "@/lib/auth";
import { getPrayerOverview } from "@/lib/prayer/service";
import { QadaBoard } from "@/components/prayer/QadaBoard";

export const dynamic = "force-dynamic";

export default async function PrayerQadaPage() {
  const { user } = await requireProfile();
  const overview = await getPrayerOverview(user);

  return (
    <div className="space-y-3">
      <QadaBoard rows={overview.qada} plan={overview.settings.qadaPlan} />
    </div>
  );
}
