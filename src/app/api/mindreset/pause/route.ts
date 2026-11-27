import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { jsonError, requireApiUser } from "@/lib/api";
import { dayKey } from "@/lib/time";
import { diaryEnabled } from "@/lib/diary/flags";
import { mindResetEnabled } from "@/lib/mindreset/flags";
import { getMindResetSettings, recordPause } from "@/lib/mindreset/service";
import { formatZodError } from "@/lib/validation";

export const dynamic = "force-dynamic";

const schema = z.object({
  app: z.string().trim().min(1).max(80),
  answer: z.string().max(500).optional(),
  moodTag: z.string().max(40).optional(),
  wentBack: z.boolean().optional(),
});

/**
 * The reflective pause. Records the one-line reason, and — when the user has
 * not turned it off — writes the same line to today's Diary entry so the
 * pause answer does not live in a second silo.
 */
export async function POST(request: Request) {
  if (!mindResetEnabled()) return jsonError("MindReset is disabled.", 404);
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError(formatZodError(parsed.error));

  const result = await recordPause(
    auth.ctx.userId,
    parsed.data.app,
    parsed.data.answer ?? "",
    parsed.data.moodTag ?? "",
    parsed.data.wentBack ?? true,
  );
  if (!result.ok) return jsonError(result.message);

  const settings = await getMindResetSettings(auth.ctx.userId);
  let diaryEntryId: string | null = null;

  if (settings.savePauseToDiary && diaryEnabled()) {
    const answer = (parsed.data.answer ?? "").trim();
    const entry = await prisma.diaryEntry.create({
      data: {
        userId: auth.ctx.userId,
        entryDate: dayKey(new Date(), auth.ctx.user.timezone),
        body: `Reflective pause · ${parsed.data.app}\n\n${answer || "No reason was written."}`,
        tags: ["mindreset", "reflective-pause"],
        ambientStatus: "off",
      },
      select: { id: true },
    });
    diaryEntryId = entry.id;
  }

  return NextResponse.json({ ok: true, savedToDiary: Boolean(diaryEntryId) });
}
