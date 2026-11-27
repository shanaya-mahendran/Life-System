"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * The Thriving ring. Fills in 900 ms ease-out on mount, matching the reference
 * motion spec, and falls back to the final value immediately for users who ask
 * for reduced motion.
 */
export function ThrivingRing({
  value,
  label,
  size = 132,
  stroke = 12,
  className,
}: {
  value: number;
  label: string;
  size?: number;
  stroke?: number;
  className?: string;
}) {
  const [filled, setFilled] = useState(0);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setFilled(value);
      return;
    }
    const frame = window.requestAnimationFrame(() => setFilled(value));
    return () => window.cancelAnimationFrame(frame);
  }, [value]);

  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.max(0, Math.min(100, filled)) / 100);

  return (
    <div className={cn("relative shrink-0", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden focusable="false">
        <defs>
          <linearGradient id="mindreset-ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#C2622A" />
            <stop offset="1" stopColor="#F8B27A" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255,255,255,0.12)"
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#mindreset-ring)"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset .9s ease-out" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-[1.6rem] font-bold leading-none text-white">{Math.round(filled)}%</span>
        <span className="mt-0.5 text-[0.62rem] font-semibold text-white/60">{label}</span>
      </div>
    </div>
  );
}
