import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { resolveAmexSyncConfiguration } from "@/lib/amex-sync/mode";
import { AmexSyncRequestError, parsePreviewRequest } from "@/lib/amex-sync/request";
import { previewAmexSync } from "@/lib/amex-sync/service";

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };

export async function POST(request: Request): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: PRIVATE_HEADERS });
  }
  const configuration = resolveAmexSyncConfiguration();
  if (configuration.mode === "off" || !configuration.hmacKey) {
    return NextResponse.json({ error: "sync_off" }, { status: 503, headers: PRIVATE_HEADERS });
  }
  try {
    const parsed = await parsePreviewRequest(request);
    const preview = await previewAmexSync({
      userId: session.user.id,
      envelope: parsed.envelope,
      mode: configuration.mode,
      hmacKey: configuration.hmacKey,
    });
    return NextResponse.json(preview, { headers: PRIVATE_HEADERS });
  } catch (error) {
    if (error instanceof AmexSyncRequestError) {
      return NextResponse.json({ error: error.code }, { status: 400, headers: PRIVATE_HEADERS });
    }
    return NextResponse.json({ error: "preview_failed" }, { status: 400, headers: PRIVATE_HEADERS });
  }
}
