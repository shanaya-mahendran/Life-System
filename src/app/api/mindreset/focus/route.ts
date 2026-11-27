import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireApiUser } from "@/lib/api";
import { mindResetEnabled } from "@/lib/mindreset/flags";
import { finishFocusSession, startFocusSession } from "@/lib/mindreset/service";
import { formatZodError } from "@/lib/validation";

export const dynamic = "force-dynamic";

const startSchema = z.object({
  action: z.literal("start"),
  plannedMinutes: z.number().int().min(5).max(180),
  blockedApps: z.array(z.string().trim().max(60)).max(12).optional(),
  domainSlug: z.string().max(40).optional(),
});

const finishSchema = z.object({
  action: z.literal("finish"),
  sessionId: z.string().min(1),
  actualMinutes: z.number().min(0).max(720),
  completed: z.boolean().optional(),
});

const schema = z.discriminatedUnion("action", [startSchema, finishSchema]);

export async function POST(request: Request) {
  if (!mindResetEnabled()) return jsonError("MindReset is disabled.", 404);
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError(formatZodError(parsed.error));

  if (parsed.data.action === "start") {
    const result = await startFocusSession(
      auth.ctx.user,
      parsed.data.plannedMinutes,
      parsed.data.blockedApps ?? [],
      parsed.data.domainSlug,
    );
    if (!result.ok) return jsonError(result.message);
    return NextResponse.json(result);
  }

  const result = await finishFocusSession(
    auth.ctx.userId,
    parsed.data.sessionId,
    parsed.data.actualMinutes,
    parsed.data.completed ?? true,
  );
  if (!result.ok) return jsonError(result.message);
  return NextResponse.json(result);
}
