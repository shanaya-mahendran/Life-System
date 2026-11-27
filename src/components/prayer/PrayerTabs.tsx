"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, House, ListChecks, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { PRAYER_ACCENT } from "@/lib/prayer/constants";

const TABS = [
  { href: "/prayer", label: "Today", icon: House },
  { href: "/prayer/progress", label: "Progress", icon: Compass },
  { href: "/prayer/qada", label: "Qada", icon: ListChecks },
  { href: "/prayer/settings", label: "Settings", icon: Settings2 },
];

export function PrayerTabs() {
  const pathname = usePathname();

  return (
    <nav aria-label="Prayer sections" className="no-scrollbar -mx-1 flex items-center gap-1 overflow-x-auto px-1 pb-0.5">
      {TABS.map((tab) => {
        const active = tab.href === "/prayer" ? pathname === tab.href : pathname.startsWith(tab.href);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition",
              active
                ? "border-[#3db596]/35 bg-[#3db596]/12 text-[#9fe0c9]"
                : "border-white/[0.07] bg-white/[0.025] text-white/45 hover:border-white/15 hover:text-white/80",
            )}
            style={active ? { borderColor: `${PRAYER_ACCENT}59` } : undefined}
          >
            <Icon className="h-3.5 w-3.5" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
