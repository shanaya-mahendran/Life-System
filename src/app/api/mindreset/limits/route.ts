import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireApiUser } from "@/lib/api";
import { mindResetEnabled } from "@/lib/mindreset/flags";
import { createLimit, deleteLimit, findPreset, setLimitEnabled, togglePreset } from "@/lib/mindreset/service";
import { formatZodError } from "@/lib/validation";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  label: z.string().trim().max(80).optional(),
  type: z.enum(["cap", "schedule", "budget", "preset"]),
  target: z.string().trim().max(80).optional(),
  minutes: z.number().int().min(1).max(1440).nullable().optional(),
  startMinute: z.number().int().min(0).max(1439).nullable().optional(),
  endMinute: z.number().int().min(0).max(1439).nullable().optional(),
  days: z.array(z.number().int().min(0).max(6)).max(7).optional(),
  strict: z.boolean().optional(),
  preset: z.string().max(40).nullable().optional(),
});

const patchSchema = z.object({
  id: z.string().min(1),
  enabled: z.boolean(),
});

const presetSchema = z.object({
  preset: z.enum(["Bedtime", "Work Focus", "Brick Mode"]),
});

export async function POST(request: Request) {
  if (!mindResetEnabled()) return jsonError("MindReset is disabled.", 404);
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);

  const presetParsed = presetSchema.safeParse(body);
  if (presetParsed.success) {
    const config = findPreset(presetParsed.data.preset);
    if (!config) return jsonError("Unknown preset.");
    const result = await togglePreset(auth.ctx.userId, config);
    if (!result.ok) return jsonError(result.message);
    return NextResponse.json(result);
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return jsonError(formatZodError(parsed.error));

  const result = await createLimit(auth.ctx.userId, {
    label: parsed.data.label ?? parsed.data.target ?? "",
    type: parsed.data.type,
    target: parsed.data.target,
    minutes: parsed.data.minutes ?? null,
    startMinute: parsed.data.startMinute ?? null,
    endMinute: parsed.data.endMinute ?? null,
    days: parsed.data.days,
    strict: parsed.data.strict,
    preset: parsed.data.preset ?? null,
  });
  if (!result.ok) return jsonError(result.message);
  return NextResponse.json(result);
}

export async function PATCH(request: Request) {
  if (!mindResetEnabled()) return jsonError("MindReset is disabled.", 404);
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return jsonError(formatZodError(parsed.error));

  const result = await setLimitEnabled(auth.ctx.userId, parsed.data.id, parsed.data.enabled);
  if (!result.ok) return jsonError(result.message);
  return NextResponse.json(result);
}

export async function DELETE(request: Request) {
  if (!mindResetEnabled()) return jsonError("MindReset is disabled.", 404);
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return jsonError("Missing limit id.");

  const result = await deleteLimit(auth.ctx.userId, id);
  if (!result.ok) return jsonError(result.message);
  return NextResponse.json(result);
}
