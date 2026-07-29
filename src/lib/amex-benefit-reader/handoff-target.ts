export const AMEX_SYNC_HANDOFF_PATH = "/integrations/amex-sync" as const;

export type AmexSyncHandoffTargetName = "production" | "local";

export interface AmexSyncHandoffTarget {
  readonly name: AmexSyncHandoffTargetName;
  readonly origin: "https://www.perks-reminder.com" | "http://localhost:3000";
  readonly path: typeof AMEX_SYNC_HANDOFF_PATH;
}

export const PRODUCTION_AMEX_SYNC_HANDOFF_TARGET: AmexSyncHandoffTarget = Object.freeze({
  name: "production",
  origin: "https://www.perks-reminder.com",
  path: AMEX_SYNC_HANDOFF_PATH,
});

export const LOCAL_AMEX_SYNC_HANDOFF_TARGET: AmexSyncHandoffTarget = Object.freeze({
  name: "local",
  origin: "http://localhost:3000",
  path: AMEX_SYNC_HANDOFF_PATH,
});

export function resolveAmexSyncHandoffTarget(
  name: unknown,
): AmexSyncHandoffTarget {
  if (name === "production") return PRODUCTION_AMEX_SYNC_HANDOFF_TARGET;
  if (name === "local") return LOCAL_AMEX_SYNC_HANDOFF_TARGET;
  throw new Error("Unsupported Amex sync handoff target.");
}

export function resolveAmexSyncHandoffTargetForOrigin(
  origin: string,
): AmexSyncHandoffTarget | null {
  if (origin === PRODUCTION_AMEX_SYNC_HANDOFF_TARGET.origin) {
    return PRODUCTION_AMEX_SYNC_HANDOFF_TARGET;
  }
  if (origin === LOCAL_AMEX_SYNC_HANDOFF_TARGET.origin) {
    return LOCAL_AMEX_SYNC_HANDOFF_TARGET;
  }
  return null;
}

export function resolveApprovedAmexSyncApplicationOrigin(
  siteUrl: string,
): AmexSyncHandoffTarget["origin"] | null {
  try {
    return resolveAmexSyncHandoffTargetForOrigin(new URL(siteUrl).origin)?.origin ?? null;
  } catch {
    return null;
  }
}
