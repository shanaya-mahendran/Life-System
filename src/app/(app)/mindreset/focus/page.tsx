import { requireProfile } from "@/lib/auth";
import { getMindResetOverview } from "@/lib/mindreset/service";
import { FocusSession } from "@/components/mindreset/FocusSession";

export const dynamic = "force-dynamic";

export default async function MindResetFocusPage() {
  const { user } = await requireProfile();
  const overview = await getMindResetOverview(user);

  return (
    <div className="space-y-3">
      <div className="px-1">
        <h2 className="font-display text-[1.05rem] font-semibold text-white">Go into focus mode</h2>
        <p className="mt-0.5 text-[0.7rem] leading-relaxed text-white/35">
          Pick a target, choose the apps to hold back, and the timer records the session. A finished block also appears
          in your focus history.
        </p>
      </div>

      <FocusSession
        focus={overview.focus}
        blockingOn={overview.settings.blockingOn}
        blockedApps={overview.blockedApps}
        focusGoalMinutes={overview.settings.focusGoalMinutes}
      />
    </div>
  );
}
