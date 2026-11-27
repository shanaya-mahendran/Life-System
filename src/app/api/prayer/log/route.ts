import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireApiUser } from "@/lib/api";
import { prayerEnabled } from "@/lib/prayer/flags";
import { clearPrayer, logPrayer } from "@/lib/prayer/service";
import { dayKey } from "@/lib/time";
import { formatZodError } from "@/lib/validation";

export const dynamic = "force-dynamic";

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const logSchema = z.object({
  dateKey: dateKey.optional(),
  prayer: z.enum(["fajr", "dhuhr", "asr", "maghrib", "isha", "sunnah", "witr"]),
  status: z.enum(["on_time", "late", "missed"]),
  method: z.enum(["normal", "seated", "lying", "combined", "shortened"]).optional(),
});

export async function POST(request: Request) {
  if (!prayerEnabled()) return jsonError("Prayer is disabled.", 404);
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = logSchema.safeParse(body);
  if (!parsed.success) return jsonError(formatZodError(parsed.error));

  const target = parsed.data.dateKey ?? dayKey(new Date(), auth.ctx.user.timezone);
  const result = await logPrayer(auth.ctx.userId, {
    dateKey: target,
    prayer: parsed.data.prayer,
    status: parsed.data.status,
    method: parsed.data.method,
  });
  if (!result.ok) return jsonError(result.message);

  return NextResponse.json({ ok: true, dateKey: target });
}

export async function DELETE(request: Request) {
  if (!prayerEnabled()) return jsonError("Prayer is disabled.", 404);
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const url = new URL(request.url);
  const target = url.searchParams.get("dateKey") ?? dayKey(new Date(), auth.ctx.user.timezone);
  const prayer = url.searchParams.get("prayer");
  if (!prayer || !dateKey.safeParse(target).success) return jsonError("Missing date or prayer.");

  await clearPrayer(auth.ctx.userId, target, prayer);
  return NextResponse.json({ ok: true });
}
