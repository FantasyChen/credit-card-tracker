import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { resolveAmexSyncConfiguration } from "@/lib/amex-sync/mode";
import { AmexSyncRequestError, parseConfirmRequest } from "@/lib/amex-sync/request";
import { confirmAmexSync } from "@/lib/amex-sync/service";

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };

export async function POST(request: Request): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: PRIVATE_HEADERS });
  }
  const configuration = resolveAmexSyncConfiguration();
  if (configuration.mode !== "write" || !configuration.hmacKey) {
    return NextResponse.json({ error: "write_disabled" }, { status: 403, headers: PRIVATE_HEADERS });
  }
  try {
    const parsed = await parseConfirmRequest(request);
    const result = await confirmAmexSync({
      userId: session.user.id,
      envelope: parsed.envelope,
      proposalToken: parsed.proposalToken,
      hmacKey: configuration.hmacKey,
    });
    if (result.updatedCount > 0) {
      revalidatePath("/");
      revalidatePath("/benefits");
    }
    return NextResponse.json(result, { headers: PRIVATE_HEADERS });
  } catch (error) {
    if (error instanceof AmexSyncRequestError) {
      return NextResponse.json({ error: error.code }, { status: 400, headers: PRIVATE_HEADERS });
    }
    const code = error instanceof Error && error.message === "conflict_repreview_required"
      ? "conflict_repreview_required"
      : "confirmation_failed";
    return NextResponse.json({ error: code }, { status: code === "conflict_repreview_required" ? 409 : 400, headers: PRIVATE_HEADERS });
  }
}
