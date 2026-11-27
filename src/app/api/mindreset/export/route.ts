import { NextResponse } from "next/server";
import { jsonError, requireApiUser } from "@/lib/api";
import { mindResetEnabled } from "@/lib/mindreset/flags";
import { getMindResetExport } from "@/lib/mindreset/service";

export const dynamic = "force-dynamic";

/** Every MindReset record the account holds, as one JSON download. */
export async function GET() {
  if (!mindResetEnabled()) return jsonError("MindReset is disabled.", 404);
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const payload = await getMindResetExport(auth.ctx.user);
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="mindreset-export-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
