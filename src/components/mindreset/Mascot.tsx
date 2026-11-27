import type { ThrivingMood } from "@/lib/mindreset/constants";

/**
 * The MindReset brain mascot.
 *
 * Four moods follow the Thriving bands: calm (thriving), proud (goal met),
 * cheer (drifting) and tired (overloaded). Purely decorative — every screen
 * also states the score in text.
 */
export function MindResetMascot({ mood = "calm", size = 120 }: { mood?: ThrivingMood; size?: number }) {
  const eyes: Record<ThrivingMood, React.ReactNode> = {
    calm: (
      <>
        <path d="M44 62 q6 6 12 0" stroke="#5a3b2e" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <path d="M72 62 q6 6 12 0" stroke="#5a3b2e" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      </>
    ),
    cheer: (
      <>
        <circle cx="50" cy="62" r="3.5" fill="#3b2a24" />
        <circle cx="78" cy="62" r="3.5" fill="#3b2a24" />
      </>
    ),
    tired: (
      <>
        <path d="M44 63 h12" stroke="#5a3b2e" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M72 63 h12" stroke="#5a3b2e" strokeWidth="2.5" strokeLinecap="round" />
      </>
    ),
    proud: (
      <>
        <path d="M44 64 q6 -8 12 0" stroke="#5a3b2e" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <path d="M72 64 q6 -8 12 0" stroke="#5a3b2e" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      </>
    ),
  };

  return (
    <svg width={size} height={size} viewBox="0 0 128 128" aria-hidden focusable="false">
      <ellipse cx="64" cy="118" rx="30" ry="5" fill="rgba(80,50,120,0.18)" />
      {(mood === "cheer" || mood === "proud") && (
        <>
          <path d="M26 70 q-10 -22 2 -34" stroke="#F6D9C4" strokeWidth="9" fill="none" strokeLinecap="round" />
          <path d="M102 70 q10 -22 -2 -34" stroke="#F6D9C4" strokeWidth="9" fill="none" strokeLinecap="round" />
        </>
      )}
      <path
        d="M26 66 C20 40 44 20 64 24 C84 20 108 40 102 66 C108 88 88 104 64 102 C40 104 20 88 26 66Z"
        fill="#FBE9DA"
        stroke="#F0CDB4"
        strokeWidth="2"
      />
      <path d="M64 26 V100" stroke="#F0CDB4" strokeWidth="2" strokeDasharray="3 4" />
      <path
        d="M36 48 q8 -6 14 2 M80 44 q10 -4 14 6 M34 78 q8 6 14 -2 M82 82 q8 4 12 -4"
        stroke="#F0CDB4"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="38" cy="72" r="6" fill="#F7B8B0" opacity="0.6" />
      <circle cx="90" cy="72" r="6" fill="#F7B8B0" opacity="0.6" />
      {eyes[mood]}
      {mood === "tired" ? (
        <path d="M56 78 q8 -5 16 0" stroke="#b5655a" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      ) : (
        <path d="M54 76 q10 10 20 0" stroke="#b5655a" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      )}
    </svg>
  );
}
