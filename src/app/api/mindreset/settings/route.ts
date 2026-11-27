import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireApiUser } from "@/lib/api";
import { mindResetEnabled } from "@/lib/mindreset/flags";
import { getMindResetSettings, updateMindResetSettings } from "@/lib/mindreset/service";
import { formatZodError } from "@/lib/validation";

export const dynamic = "force-dynamic";

const schema = z.object({
  goalMinutes: z.number().int().min(30).max(960).optional(),
  focusGoalMinutes: z.number().int().min(5).max(240).optional(),
  blockingOn: z.boolean().optional(),
  pauseStyle: z.enum(["reflective", "strict"]).optional(),
  strictMode: z.boolean().optional(),
  securityLock: z.boolean().optional(),
  savePauseToDiary: z.boolean().optional(),
  shareWithSleep: z.boolean().optional(),
  shareWithHabits: z.boolean().optional(),
});

export async function GET() {
  if (!mindResetEnabled()) return jsonError("MindReset is disabled.", 404);
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;
  const settings = await getMindResetSettings(auth.ctx.userId);
  return NextResponse.json({ ok: true, settings });
}

export async function PATCH(request: Request) {
  if (!mindResetEnabled()) return jsonError("MindReset is disabled.", 404);
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError(formatZodError(parsed.error));

  await updateMindResetSettings(auth.ctx.userId, parsed.data);
  const settings = await getMindResetSettings(auth.ctx.userId);
  return NextResponse.json({ ok: true, settings });
}
