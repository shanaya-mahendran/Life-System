import { requireProfile } from "@/lib/auth";
import { getMindResetOverview } from "@/lib/mindreset/service";
import { LimitsBoard } from "@/components/mindreset/LimitsBoard";

export const dynamic = "force-dynamic";

export default async function MindResetLimitsPage() {
  const { user } = await requireProfile();
  const overview = await getMindResetOverview(user);

  return <LimitsBoard limits={overview.limits} blockingOn={overview.settings.blockingOn} />;
}
