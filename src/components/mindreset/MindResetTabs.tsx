"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, House, Lock, Settings2, Timer } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/mindreset", label: "Home", icon: House },
  { href: "/mindreset/insights", label: "Insights", icon: BarChart3 },
  { href: "/mindreset/focus", label: "Focus", icon: Timer },
  { href: "/mindreset/limits", label: "Limits", icon: Lock },
  { href: "/mindreset/settings", label: "Settings", icon: Settings2 },
];

export function MindResetTabs() {
  const pathname = usePathname();

  return (
    <nav aria-label="MindReset sections" className="no-scrollbar -mx-1 flex items-center gap-1 overflow-x-auto px-1 pb-0.5">
      {TABS.map((tab) => {
        const active = tab.href === "/mindreset" ? pathname === tab.href : pathname.startsWith(tab.href);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[0.72rem] font-semibold transition",
              active
                ? "border-[#f2995a]/35 bg-[#f2995a]/12 text-[#f8c69f]"
                : "border-white/[0.07] bg-white/[0.025] text-white/45 hover:border-white/15 hover:text-white/80",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
