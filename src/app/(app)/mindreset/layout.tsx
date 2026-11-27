import { notFound } from "next/navigation";
import { Smartphone } from "lucide-react";
import { mindResetEnabled } from "@/lib/mindreset/flags";
import { MIND_RESET_ACCENT } from "@/lib/mindreset/constants";
import { PageBanner } from "@/components/shell/PageBanner";
import { MindResetTabs } from "@/components/mindreset/MindResetTabs";

export const metadata = { title: "MindReset · LifeOS" };
export const dynamic = "force-dynamic";

export default function MindResetLayout({ children }: { children: React.ReactNode }) {
  if (!mindResetEnabled()) notFound();

  return (
    <div className="space-y-4">
      <PageBanner
        icon={<Smartphone className="h-5 w-5" />}
        title="MindReset"
        subtitle="An honest picture of phone use, a focus timer, and limits that pause before they block."
        accent={MIND_RESET_ACCENT}
        aside={
          <div className="hidden rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-right sm:block">
            <p className="font-display text-[0.95rem] font-semibold text-white">Digital wellbeing</p>
            <p className="text-[0.58rem] uppercase tracking-[0.16em] text-white/30">on-device summaries</p>
          </div>
        }
      />
      <MindResetTabs />
      {children}
    </div>
  );
}
