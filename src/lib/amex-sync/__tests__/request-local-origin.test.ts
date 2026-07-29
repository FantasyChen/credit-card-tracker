function syntheticRequest(origin: string): Request {
  const headers = new Map([
    ["origin", origin],
    ["sec-fetch-site", "same-origin"],
    ["content-type", "application/json"],
  ]);
  return {
    headers: { get: (name: string) => headers.get(name.toLowerCase()) ?? null },
  } as unknown as Request;
}

describe("configured local Amex sync request origin", () => {
  const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  afterEach(() => {
    if (originalSiteUrl === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
    jest.resetModules();
  });

  it("accepts exact localhost requests only when the local site URL is supplied", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
    jest.resetModules();
    const { assertSameOriginAmexSyncRequest } = await import("../request");

    expect(() => assertSameOriginAmexSyncRequest(syntheticRequest("http://localhost:3000")))
      .not.toThrow();
    expect(() => assertSameOriginAmexSyncRequest(syntheticRequest("https://www.perks-reminder.com")))
      .toThrow("origin_rejected");
  });

  it("rejects a configured site URL outside the two approved origins", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://preview.example.com";
    jest.resetModules();
    const { assertSameOriginAmexSyncRequest } = await import("../request");

    expect(() => assertSameOriginAmexSyncRequest(syntheticRequest("https://preview.example.com")))
      .toThrow("origin_rejected");
  });
});
