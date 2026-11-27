/**
 * Prayer (Salah) domain feature switch.
 *
 * Defaults to on so a fresh checkout can use the section; setting
 * PRAYER_ENABLED (or the public mirror) to "false" restores the exact
 * pre-Prayer LifeOS behaviour — the sidebar entry disappears and every Prayer
 * route returns 404.
 */

function enabled(name: string): boolean {
  return process.env[name] !== "false";
}

export function prayerEnabled(): boolean {
  return enabled("PRAYER_ENABLED") && enabled("NEXT_PUBLIC_PRAYER_ENABLED");
}
