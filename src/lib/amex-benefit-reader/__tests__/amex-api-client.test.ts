import accountsFixture from "../__fixtures__/accounts.json";
import catalogFixture from "../__fixtures__/benefit-catalog.json";
import trackersFixture from "../__fixtures__/benefit-trackers.json";
import {
  CATALOG_READ_ENDPOINT,
  MEMBER_READ_ENDPOINT,
  TRACKER_READ_ENDPOINT,
} from "../amex-api-contract";
import { AmexApiClient } from "../amex-api-client";

const MUTATION_DENY_SENTINELS = [
  "CreateOffersHubEnrollment",
  "CreateCardAccountOfferEnrollment",
] as const;

function response(url: string, body: unknown, options: {
  status?: number;
  contentType?: string;
  redirected?: boolean;
  type?: ResponseType;
} = {}): Response {
  const status = options.status ?? 200;
  return {
    ok: status >= 200 && status < 300,
    status,
    redirected: options.redirected ?? false,
    type: options.type ?? "basic",
    url,
    headers: { get: (name: string) => name.toLowerCase() === "content-type" ? (options.contentType ?? "application/json; charset=utf-8") : null },
    json: async () => body,
  } as unknown as Response;
}

function endpointUrl(endpoint: { origin: string; path: string }): string {
  return `${endpoint.origin}${endpoint.path}`;
}

describe("allowlisted Amex private read client", () => {
  it("calls the native default fetch through the global receiver", async () => {
    const originalFetch = globalThis.fetch;
    const receiverCheckedFetch = jest.fn(function (this: unknown, url: string) {
      if (this !== globalThis) throw new TypeError("Illegal invocation");
      return Promise.resolve(response(url, accountsFixture));
    });
    globalThis.fetch = receiverCheckedFetch as unknown as typeof fetch;
    try {
      const client = new AmexApiClient();
      await expect(client.discoverAccounts(new AbortController().signal)).resolves.toBeDefined();
      expect(receiverCheckedFetch).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("constructs only the three exact reviewed tuples, headers, and bodies", async () => {
    const fetchMock = jest.fn<Promise<Response>, [string, RequestInit?]>(async (url) => {
      if (url === endpointUrl(MEMBER_READ_ENDPOINT)) return response(String(url), accountsFixture);
      if (url === endpointUrl(TRACKER_READ_ENDPOINT)) return response(String(url), trackersFixture);
      return response(String(url), catalogFixture);
    });
    const client = new AmexApiClient({ fetch: fetchMock });
    const signal = new AbortController().signal;
    await client.discoverAccounts(signal);
    await client.readBenefitTrackers("invented-transient-token", signal);
    await client.readBenefitCatalog("invented-transient-token", signal);

    expect(fetchMock.mock.calls).toEqual([
      [endpointUrl(MEMBER_READ_ENDPOINT), expect.objectContaining({
        method: "GET",
        headers: { Accept: "application/json" },
        body: undefined,
        credentials: "include",
        redirect: "manual",
        signal: expect.any(AbortSignal),
      })],
      [endpointUrl(TRACKER_READ_ENDPOINT), expect.objectContaining({
        method: "POST",
        headers: { Accept: "*/*", "Content-Type": "application/json" },
        body: JSON.stringify([{ accountToken: "invented-transient-token", locale: "en-US", limit: "ALL" }]),
        credentials: "include",
        redirect: "manual",
        signal: expect.any(AbortSignal),
      })],
      [endpointUrl(CATALOG_READ_ENDPOINT), expect.objectContaining({
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ accountToken: "invented-transient-token", locale: "en-US" }),
        credentials: "include",
        redirect: "manual",
        signal: expect.any(AbortSignal),
      })],
    ]);
    const serializedDestinations = JSON.stringify(fetchMock.mock.calls.map(([url, init]) => [url, init?.method]));
    MUTATION_DENY_SENTINELS.forEach((fragment) => expect(serializedDestinations).not.toContain(fragment));
  });

  it("retries one network failure and one 5xx, but never retries auth or other 4xx", async () => {
    const networkThenSuccess = jest.fn<Promise<Response>, [string, RequestInit?]>()
      .mockRejectedValueOnce(new TypeError("synthetic network failure"))
      .mockResolvedValueOnce(response(endpointUrl(MEMBER_READ_ENDPOINT), accountsFixture));
    await expect(new AmexApiClient({ fetch: networkThenSuccess }).discoverAccounts(new AbortController().signal)).resolves.toBeDefined();
    expect(networkThenSuccess).toHaveBeenCalledTimes(2);

    const serverThenSuccess = jest.fn<Promise<Response>, [string, RequestInit?]>()
      .mockResolvedValueOnce(response(endpointUrl(MEMBER_READ_ENDPOINT), {}, { status: 503 }))
      .mockResolvedValueOnce(response(endpointUrl(MEMBER_READ_ENDPOINT), accountsFixture));
    await expect(new AmexApiClient({ fetch: serverThenSuccess }).discoverAccounts(new AbortController().signal)).resolves.toBeDefined();
    expect(serverThenSuccess).toHaveBeenCalledTimes(2);

    for (const [status, code] of [[401, "signed_out"], [403, "signed_out"], [400, "http_error"], [429, "http_error"]] as const) {
      const denied = jest.fn<Promise<Response>, [string, RequestInit?]>(async () => response(endpointUrl(MEMBER_READ_ENDPOINT), {}, { status }));
      await expect(new AmexApiClient({ fetch: denied }).discoverAccounts(new AbortController().signal)).rejects.toMatchObject({ issueCode: code });
      expect(denied).toHaveBeenCalledTimes(1);
    }
  });

  it("retries one catalog 502 and returns the exact redacted HTTP issue after exhaustion", async () => {
    const catalogUrl = endpointUrl(CATALOG_READ_ENDPOINT);
    const fetchMock = jest.fn<Promise<Response>, [string, RequestInit?]>(async () =>
      response(catalogUrl, {}, { status: 502 }));

    await expect(new AmexApiClient({ fetch: fetchMock }).readBenefitCatalog(
      "invented-transient-token",
      new AbortController().signal,
    )).rejects.toMatchObject({ issueCode: "http_error" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.every(([url, init]) => url === catalogUrl && init?.method === "POST")).toBe(true);
  });

  it("rejects redirects, non-JSON, malformed envelopes, and invalid JSON without retry", async () => {
    const cases: Array<[Response, string]> = [
      [response("https://global.americanexpress.com/sign-in", accountsFixture, { redirected: true }), "redirect_rejected"],
      [response(endpointUrl(MEMBER_READ_ENDPOINT), accountsFixture, { type: "opaqueredirect" }), "redirect_rejected"],
      [response(endpointUrl(MEMBER_READ_ENDPOINT), accountsFixture, { contentType: "text/html" }), "content_type_invalid"],
      [response(endpointUrl(MEMBER_READ_ENDPOINT), accountsFixture, { contentType: "application/jsonp" }), "content_type_invalid"],
      [response(endpointUrl(MEMBER_READ_ENDPOINT), { accounts: "not-an-array" }), "response_schema_invalid"],
      [{ ...response(endpointUrl(MEMBER_READ_ENDPOINT), accountsFixture), json: async () => { throw new SyntaxError("synthetic invalid JSON"); } } as Response, "response_schema_invalid"],
    ];
    for (const [syntheticResponse, issueCode] of cases) {
      const fetchMock = jest.fn<Promise<Response>, [string, RequestInit?]>(async () => syntheticResponse);
      await expect(new AmexApiClient({ fetch: fetchMock }).discoverAccounts(new AbortController().signal)).rejects.toMatchObject({ issueCode });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    }
  });

  it("enforces bounded timeout and caller cancellation without retry", async () => {
    const hanging = jest.fn<Promise<Response>, [string, RequestInit?]>((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
    }));
    await expect(new AmexApiClient({ fetch: hanging, timeoutMs: 5 }).discoverAccounts(new AbortController().signal)).rejects.toMatchObject({ issueCode: "request_timeout" });
    expect(hanging).toHaveBeenCalledTimes(1);

    const controller = new AbortController();
    controller.abort();
    const neverCalled = jest.fn<Promise<Response>, [string, RequestInit?]>();
    await expect(new AmexApiClient({ fetch: neverCalled }).discoverAccounts(controller.signal)).rejects.toMatchObject({ issueCode: "scan_cancelled" });
    expect(neverCalled).not.toHaveBeenCalled();
  });

  it("rejects empty or oversized transient tokens before making a request", async () => {
    const fetchMock = jest.fn<Promise<Response>, [string, RequestInit?]>();
    const client = new AmexApiClient({ fetch: fetchMock });
    await expect(client.readBenefitCatalog("", new AbortController().signal)).rejects.toThrow("transient account identity");
    await expect(client.readBenefitTrackers("x".repeat(4097), new AbortController().signal)).rejects.toThrow("transient account identity");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
