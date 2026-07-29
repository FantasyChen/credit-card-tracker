import {
  LOCAL_AMEX_SYNC_HANDOFF_TARGET,
  PRODUCTION_AMEX_SYNC_HANDOFF_TARGET,
  resolveAmexSyncHandoffTarget,
  resolveAmexSyncHandoffTargetForOrigin,
  resolveApprovedAmexSyncApplicationOrigin,
} from "../handoff-target";

describe("Amex sync handoff targets", () => {
  it("resolves only the two reviewed build targets", () => {
    expect(resolveAmexSyncHandoffTarget("production")).toBe(PRODUCTION_AMEX_SYNC_HANDOFF_TARGET);
    expect(resolveAmexSyncHandoffTarget("local")).toBe(LOCAL_AMEX_SYNC_HANDOFF_TARGET);
    expect(() => resolveAmexSyncHandoffTarget("https://example.com")).toThrow("Unsupported");
    expect(() => resolveAmexSyncHandoffTarget(undefined)).toThrow("Unsupported");
  });

  it("accepts only exact production and localhost origins", () => {
    expect(resolveAmexSyncHandoffTargetForOrigin("https://www.perks-reminder.com"))
      .toBe(PRODUCTION_AMEX_SYNC_HANDOFF_TARGET);
    expect(resolveAmexSyncHandoffTargetForOrigin("http://localhost:3000"))
      .toBe(LOCAL_AMEX_SYNC_HANDOFF_TARGET);
    expect(resolveAmexSyncHandoffTargetForOrigin("https://perks-reminder.com")).toBeNull();
    expect(resolveAmexSyncHandoffTargetForOrigin("https://localhost:3000")).toBeNull();
    expect(resolveAmexSyncHandoffTargetForOrigin("http://localhost:3001")).toBeNull();
    expect(resolveAmexSyncHandoffTargetForOrigin("https://evil.example")).toBeNull();
  });

  it("allows the server request boundary to use an explicitly configured local site URL", () => {
    expect(resolveApprovedAmexSyncApplicationOrigin("http://localhost:3000"))
      .toBe("http://localhost:3000");
    expect(resolveApprovedAmexSyncApplicationOrigin("https://www.perks-reminder.com"))
      .toBe("https://www.perks-reminder.com");
    expect(resolveApprovedAmexSyncApplicationOrigin("http://localhost:3001")).toBeNull();
    expect(resolveApprovedAmexSyncApplicationOrigin("https://preview.example.com")).toBeNull();
    expect(resolveApprovedAmexSyncApplicationOrigin("not a URL")).toBeNull();
  });
});
