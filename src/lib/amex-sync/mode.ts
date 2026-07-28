export type AmexSyncMode = "off" | "preview" | "write";

export interface AmexSyncConfiguration {
  mode: AmexSyncMode;
  hmacKey: string | null;
}

export function resolveAmexSyncConfiguration(
  environment: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): AmexSyncConfiguration {
  const mode = environment.AMEX_SYNC_MODE;
  const hmacKey = environment.AMEX_SYNC_HMAC_KEY;
  if ((mode !== "preview" && mode !== "write") || !hmacKey || hmacKey.length < 32) {
    return { mode: "off", hmacKey: null };
  }
  return { mode, hmacKey };
}
