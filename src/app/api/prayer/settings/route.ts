import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireApiUser } from "@/lib/api";
import { prayerEnabled } from "@/lib/prayer/flags";
import { ensurePrayerSettings, updatePrayerSettings } from "@/lib/prayer/service";
import { formatZodError } from "@/lib/validation";

export const dynamic = "force-dynamic";

const settingsSchema = z.object({
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  locationLabel: z.string().max(60).optional(),
  method: z.enum(["mwl", "isna", "egypt", "karachi", "umm_al_qura", "tehran"]).optional(),
  asrMethod: z.enum(["standard", "hanafi"]).optional(),
  highLatitude: z.enum(["angle", "middle", "seventh"]).optional(),
  madhhab: z.enum(["shafii", "hanafi", "maliki", "hanbali", "other"]).optional(),
  adjustMinutes: z.number().int().min(-45).max(45).optional(),
  remindersOn: z.boolean().optional(),
  fajrAlarm: z.boolean().optional(),
  lockDuringPrayer: z.boolean().optional(),
  trackSunnah: z.boolean().optional(),
  trackWitr: z.boolean().optional(),
  qadaPlan: z.enum(["with_each", "two_with_each", "friday"]).optional(),
});

export async function GET() {
  if (!prayerEnabled()) return jsonError("Prayer is disabled.", 404);
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const settings = await ensurePrayerSettings(auth.ctx.userId, auth.ctx.user.timezone);
  return NextResponse.json({ ok: true, settings });
}

export async function PATCH(request: Request) {
  if (!prayerEnabled()) return jsonError("Prayer is disabled.", 404);
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) return jsonError(formatZodError(parsed.error));

  const result = await updatePrayerSettings(auth.ctx.user, parsed.data);
  if (!result.ok) return jsonError(result.message);

  return NextResponse.json({ ok: true });
}
