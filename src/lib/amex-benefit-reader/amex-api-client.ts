import type { z } from "zod";
import type { IssueCode } from "./contract";
import {
  AMEX_API_TIMEOUT_MS,
  CATALOG_READ_ENDPOINT,
  MEMBER_READ_ENDPOINT,
  TRACKER_READ_ENDPOINT,
  buildCatalogRequestBody,
  buildTrackerRequestBody,
  catalogResponseSchema,
  memberResponseSchema,
  trackerResponseSchema,
  type CatalogResponse,
  type MemberResponse,
  type TrackerResponse,
} from "./amex-api-contract";

export class AmexApiError extends Error {
  constructor(
    public readonly issueCode: IssueCode,
    public readonly retryable = false,
  ) {
    super(issueCode);
    this.name = "AmexApiError";
  }
}

export type AmexFetch = (url: string, init?: RequestInit) => Promise<Response>;

export interface AmexApiClientOptions {
  fetch?: AmexFetch;
  timeoutMs?: number;
}

interface FixedReadRequest<T> {
  endpoint: {
    origin: string;
    path: string;
    method: "GET" | "POST";
    headers: Readonly<Record<string, string>>;
  };
  body?: string;
  schema: z.ZodType<T>;
}

function throwIfCancelled(signal: AbortSignal): void {
  if (signal.aborted) throw new AmexApiError("scan_cancelled");
}

function exactEndpointUrl(endpoint: FixedReadRequest<unknown>["endpoint"]): string {
  return `${endpoint.origin}${endpoint.path}`;
}

export class AmexApiClient {
  private readonly fetchImpl: AmexFetch;
  private readonly timeoutMs: number;

  constructor(options: AmexApiClientOptions = {}) {
    // Native browser fetch requires the global receiver in some isolated
    // extension worlds. Store a receiver-neutral wrapper rather than the bare
    // platform function so calling it as this.fetchImpl(...) stays valid.
    this.fetchImpl = options.fetch ?? ((url, init) => globalThis.fetch(url, init));
    this.timeoutMs = options.timeoutMs ?? AMEX_API_TIMEOUT_MS;
    if (!Number.isFinite(this.timeoutMs) || this.timeoutMs <= 0) {
      throw new Error("The Amex read timeout must be positive.");
    }
  }

  discoverAccounts(signal: AbortSignal): Promise<MemberResponse> {
    return this.executeWithRetry({
      endpoint: MEMBER_READ_ENDPOINT,
      schema: memberResponseSchema,
    }, signal);
  }

  async readBenefitTrackers(accountToken: string, signal: AbortSignal): Promise<TrackerResponse> {
    return this.executeWithRetry({
      endpoint: TRACKER_READ_ENDPOINT,
      body: buildTrackerRequestBody(accountToken),
      schema: trackerResponseSchema,
    }, signal);
  }

  async readBenefitCatalog(accountToken: string, signal: AbortSignal): Promise<CatalogResponse> {
    return this.executeWithRetry({
      endpoint: CATALOG_READ_ENDPOINT,
      body: buildCatalogRequestBody(accountToken),
      schema: catalogResponseSchema,
    }, signal);
  }

  private async executeWithRetry<T>(request: FixedReadRequest<T>, signal: AbortSignal): Promise<T> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      throwIfCancelled(signal);
      try {
        return await this.executeOnce(request, signal);
      } catch (error) {
        const classified = this.classifyThrownError(error, signal);
        if (!classified.retryable || attempt === 1) throw classified;
      }
    }
    throw new AmexApiError("network_error");
  }

  private async executeOnce<T>(request: FixedReadRequest<T>, signal: AbortSignal): Promise<T> {
    const url = exactEndpointUrl(request.endpoint);
    const timeoutController = new AbortController();
    let timedOut = false;
    const forwardAbort = () => timeoutController.abort(signal.reason);
    signal.addEventListener("abort", forwardAbort, { once: true });
    const timer = setTimeout(() => {
      timedOut = true;
      timeoutController.abort();
    }, this.timeoutMs);

    let rawJson: unknown;
    try {
      const response = await this.fetchImpl(url, {
        method: request.endpoint.method,
        headers: request.endpoint.headers,
        body: request.body,
        credentials: "include",
        // Manual mode prevents Fetch from following an unknown destination and
        // lets opaque/manual redirects be rejected without a network retry.
        redirect: "manual",
        signal: timeoutController.signal,
      });
      if (response.type === "opaqueredirect" || response.redirected || response.url !== url) {
        throw new AmexApiError("redirect_rejected");
      }
      if (response.status === 401 || response.status === 403) {
        throw new AmexApiError("signed_out");
      }
      if (!response.ok) {
        throw new AmexApiError("http_error", response.status >= 500 && response.status <= 599);
      }
      const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
      if (!/^application\/json(?:\s*;|$)/.test(contentType)) {
        throw new AmexApiError("content_type_invalid");
      }

      try {
        rawJson = await response.json();
      } catch {
        if (signal.aborted) throw new AmexApiError("scan_cancelled");
        if (timedOut) throw new AmexApiError("request_timeout");
        throw new AmexApiError("response_schema_invalid");
      }
      const parsed = request.schema.safeParse(rawJson);
      if (!parsed.success) throw new AmexApiError("response_schema_invalid");
      return parsed.data;
    } catch (error) {
      if (signal.aborted) throw new AmexApiError("scan_cancelled");
      if (timedOut) throw new AmexApiError("request_timeout");
      throw error;
    } finally {
      rawJson = undefined;
      clearTimeout(timer);
      signal.removeEventListener("abort", forwardAbort);
    }
  }

  private classifyThrownError(error: unknown, signal: AbortSignal): AmexApiError {
    if (error instanceof AmexApiError) return error;
    if (signal.aborted) return new AmexApiError("scan_cancelled");
    if (error instanceof DOMException && error.name === "AbortError") {
      return new AmexApiError("network_error", true);
    }
    if (error instanceof TypeError) return new AmexApiError("network_error", true);
    return new AmexApiError("network_error", true);
  }
}
