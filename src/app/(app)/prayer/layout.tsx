import { notFound } from "next/navigation";
import { MoonStar } from "lucide-react";
import { prayerEnabled } from "@/lib/prayer/flags";
import { PRAYER_ACCENT } from "@/lib/prayer/constants";
import { PageBanner } from "@/components/shell/PageBanner";
import { PrayerTabs } from "@/components/prayer/PrayerTabs";

export const metadata = { title: "Prayer · LifeOS" };
export const dynamic = "force-dynamic";

export default function PrayerLayout({ children }: { children: React.ReactNode }) {
  if (!prayerEnabled()) notFound();

  return (
    <div className="space-y-4">
      <PageBanner
        icon={<MoonStar className="h-5 w-5" />}
        title="Prayer"
        subtitle="Five prayers, gently kept — times, one-tap logging, qada and the long view."
        accent={PRAYER_ACCENT}
        aside={
          <div className="hidden rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-right sm:block">
            <p className="font-display text-[0.95rem] font-semibold text-white">Salah</p>
            <p className="text-[0.58rem] uppercase tracking-[0.16em] text-white/30">private · on your device</p>
          </div>
        }
      />
      <PrayerTabs />
      {children}
    </div>
  );
}
