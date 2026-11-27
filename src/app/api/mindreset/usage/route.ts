import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireApiUser } from "@/lib/api";
import { mindResetEnabled } from "@/lib/mindreset/flags";
import { getMindResetOverview, logUsageDay, normalizeApps, purgeMindResetData } from "@/lib/mindreset/service";
import { formatZodError } from "@/lib/validation";

export const dynamic = "force-dynamic";

const appSchema = z.object({
  name: z.string().trim().min(1).max(60),
  minutes: z.number().min(0).max(1440),
  category: z.string().max(30).optional(),
});

const usageSchema = z.object({
  dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  screenMinutes: z.number().min(0).max(1440),
  pickups: z.number().min(0).max(999).optional(),
  focusMinutes: z.number().min(0).max(1440).optional(),
  nightMinutes: z.number().min(0).max(1440).optional(),
  apps: z.array(appSchema).max(12).optional(),
  hours: z.array(z.number().min(0).max(1440)).max(24).optional(),
  source: z.enum(["manual", "sync"]).optional(),
});

export async function GET() {
  if (!mindResetEnabled()) return jsonError("MindReset is disabled.", 404);
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;
  const overview = await getMindResetOverview(auth.ctx.user);
  return NextResponse.json({ ok: true, overview });
}

export async function POST(request: Request) {
  if (!mindResetEnabled()) return jsonError("MindReset is disabled.", 404);
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = usageSchema.safeParse(body);
  if (!parsed.success) return jsonError(formatZodError(parsed.error));

  const result = await logUsageDay(auth.ctx.user, {
    dateKey: parsed.data.dateKey,
    screenMinutes: parsed.data.screenMinutes,
    pickups: parsed.data.pickups ?? 0,
    focusMinutes: parsed.data.focusMinutes ?? 0,
    nightMinutes: parsed.data.nightMinutes ?? 0,
    apps: normalizeApps(parsed.data.apps ?? []),
    hours: parsed.data.hours,
    source: parsed.data.source,
  });
  if (!result.ok) return jsonError(result.message);

  const overview = await getMindResetOverview(auth.ctx.user);
  return NextResponse.json({ ok: true, dateKey: result.dateKey, score: overview.score });
}

export async function DELETE() {
  if (!mindResetEnabled()) return jsonError("MindReset is disabled.", 404);
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;
  await purgeMindResetData(auth.ctx.userId);
  return NextResponse.json({ ok: true });
}
