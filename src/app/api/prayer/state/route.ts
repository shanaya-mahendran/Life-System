import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireApiUser } from "@/lib/api";
import { prayerEnabled } from "@/lib/prayer/flags";
import { setDayState } from "@/lib/prayer/service";
import { dayKey } from "@/lib/time";
import { formatZodError } from "@/lib/validation";

export const dynamic = "force-dynamic";

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const stateSchema = z.object({
  dateKey: dateKey.optional(),
  state: z.enum(["active", "excused", "adapted", "traveller", "review"]),
  // Domain suggestions carry their source; the person still confirms.
  source: z.enum(["user", "health", "cycle", "travel", "mood"]).optional(),
  note: z.string().max(200).optional(),
});

export async function POST(request: Request) {
  if (!prayerEnabled()) return jsonError("Prayer is disabled.", 404);
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = stateSchema.safeParse(body);
  if (!parsed.success) return jsonError(formatZodError(parsed.error));

  const target = parsed.data.dateKey ?? dayKey(new Date(), auth.ctx.user.timezone);
  const result = await setDayState(auth.ctx.userId, {
    dateKey: target,
    state: parsed.data.state,
    source: parsed.data.source,
    note: parsed.data.note,
  });
  if (!result.ok) return jsonError(result.message);

  return NextResponse.json({ ok: true, dateKey: target, state: result.state });
}

/** One-tap undo: back to Active without losing the history of the change. */
export async function DELETE(request: Request) {
  if (!prayerEnabled()) return jsonError("Prayer is disabled.", 404);
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const url = new URL(request.url);
  const target = url.searchParams.get("dateKey") ?? dayKey(new Date(), auth.ctx.user.timezone);
  if (!dateKey.safeParse(target).success) return jsonError("Invalid date.");

  await setDayState(auth.ctx.userId, { dateKey: target, state: "active", source: "user" });
  return NextResponse.json({ ok: true, dateKey: target, state: "active" });
}
