import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireApiUser } from "@/lib/api";
import { prayerEnabled } from "@/lib/prayer/flags";
import { updateQada } from "@/lib/prayer/service";
import { formatZodError } from "@/lib/validation";

export const dynamic = "force-dynamic";

const qadaSchema = z.object({
  prayer: z.enum(["fajr", "dhuhr", "asr", "maghrib", "isha"]),
  owed: z.number().int().min(0).max(9999).optional(),
  completed: z.number().int().min(0).max(9999).optional(),
});

export async function POST(request: Request) {
  if (!prayerEnabled()) return jsonError("Prayer is disabled.", 404);
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = qadaSchema.safeParse(body);
  if (!parsed.success) return jsonError(formatZodError(parsed.error));

  const result = await updateQada(auth.ctx.userId, parsed.data.prayer, {
    owed: parsed.data.owed,
    completed: parsed.data.completed,
  });
  if (!result.ok) return jsonError(result.message);

  return NextResponse.json({ ok: true });
}
