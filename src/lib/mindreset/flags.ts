/**
 * MindReset digital wellbeing feature switch.
 *
 * Defaults to on so a fresh checkout can use the section; setting
 * MIND_RESET_ENABLED (or the public mirror) to "false" restores the exact
 * pre-MindReset LifeOS behaviour — the sidebar entry disappears and every
 * MindReset route returns 404.
 */

function enabled(name: string): boolean {
  return process.env[name] !== "false";
}

export function mindResetEnabled(): boolean {
  return enabled("MIND_RESET_ENABLED") && enabled("NEXT_PUBLIC_MIND_RESET_ENABLED");
}
