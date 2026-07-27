import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { resolveAmexSyncConfiguration } from "@/lib/amex-sync/mode";
import { confirmAmexSync, previewAmexSync } from "@/lib/amex-sync/service";
import { POST as previewPost } from "../preview/route";
import { POST as confirmPost } from "../confirm/route";

jest.mock("next-auth", () => ({ getServerSession: jest.fn() }));
jest.mock("next/server", () => ({
  NextResponse: {
    json: jest.fn((body: unknown, init?: { status?: number; headers?: Record<string, string> }) => ({
      status: init?.status ?? 200,
      headers: init?.headers ?? {},
      json: async () => body,
    })),
  },
}));
jest.mock("@/lib/auth", () => ({ authOptions: {} }));
jest.mock("@/lib/amex-sync/mode", () => ({ resolveAmexSyncConfiguration: jest.fn() }));
jest.mock("@/lib/amex-sync/service", () => ({ previewAmexSync: jest.fn(), confirmAmexSync: jest.fn() }));

const session = { user: { id: "user-1" } };
const key = "synthetic-hmac-key-that-is-at-least-32-characters";
const envelope = {
  envelopeVersion: "amex-sync-envelope/1",
  observationContractVersion: "amex-benefits/2",
  scanId: "22222222-2222-4222-8222-222222222222",
  scanFinishedAt: "2026-07-15T12:00:00.000Z",
  cards: [{
    sourceLocalCardId: "11111111-1111-4111-8111-111111111111",
    productKey: "american-express-platinum-card",
    endingDigits: "1234",
    observedAt: "2026-07-15T11:59:00.000Z",
    parserVersion: "amex-api-us/2.0.2",
    rows: [],
  }],
  exclusions: [],
};

function request(path: "preview" | "confirm", body: unknown): Request {
  const headers = new Map([
    ["origin", "https://www.perks-reminder.com"],
    ["sec-fetch-site", "same-origin"],
    ["content-type", "application/json"],
  ]);
  return {
    url: `https://www.perks-reminder.com/api/integrations/amex-sync/${path}`,
    method: "POST",
    headers: { get: (name: string) => headers.get(name.toLowerCase()) ?? null },
    text: async () => JSON.stringify(body),
  } as unknown as Request;
}

const getSession = getServerSession as jest.Mock;
const configuration = resolveAmexSyncConfiguration as jest.Mock;
const preview = previewAmexSync as jest.Mock;
const confirm = confirmAmexSync as jest.Mock;

describe("Amex sync API routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getSession.mockResolvedValue(session);
    configuration.mockReturnValue({ mode: "write", hmacKey: key });
  });

  it("authenticates preview before mode, parsing, or service work", async () => {
    getSession.mockResolvedValue(null);
    const response = await previewPost(request("preview", { malformed: true }));
    expect(response.status).toBe(401);
    expect(configuration).not.toHaveBeenCalled();
    expect(preview).not.toHaveBeenCalled();
  });

  it("keeps off mode fail-closed and performs no preview writes/service work", async () => {
    configuration.mockReturnValue({ mode: "off", hmacKey: null });
    const response = await previewPost(request("preview", { envelope, manualMappings: [] }));
    expect(response.status).toBe(503);
    expect(preview).not.toHaveBeenCalled();
  });

  it("passes only the authenticated user and validated source to read-only preview", async () => {
    preview.mockResolvedValue({ mode: "write", rows: [], proposalToken: "x".repeat(40), proposalExpiresAt: "2026-07-15T12:05:00.000Z", mappingOptions: [] });
    const response = await previewPost(request("preview", { envelope, manualMappings: [] }));
    expect(response.status).toBe(200);
    expect(preview).toHaveBeenCalledWith(expect.objectContaining({ userId: "user-1", envelope, manualMappings: [], mode: "write", hmacKey: key }));
  });

  it("rejects confirmation before parsing unless effective mode is write", async () => {
    configuration.mockReturnValue({ mode: "preview", hmacKey: key });
    const response = await confirmPost(request("confirm", { malformed: true }));
    expect(response.status).toBe(403);
    expect(confirm).not.toHaveBeenCalled();
  });

  it("revalidates affected routes only after at least one applied row", async () => {
    confirm.mockResolvedValue({ attemptId: "attempt-1", replayed: false, rows: [], updatedCount: 0 });
    let response = await confirmPost(request("confirm", { envelope, manualMappings: [], proposalToken: "x".repeat(40) }));
    expect(response.status).toBe(200);
    expect(revalidatePath).not.toHaveBeenCalled();

    confirm.mockResolvedValue({ attemptId: "attempt-2", replayed: false, rows: [], updatedCount: 1 });
    response = await confirmPost(request("confirm", { envelope, manualMappings: [], proposalToken: "x".repeat(40) }));
    expect(response.status).toBe(200);
    expect(revalidatePath).toHaveBeenCalledTimes(2);
    expect(revalidatePath).toHaveBeenCalledWith("/");
    expect(revalidatePath).toHaveBeenCalledWith("/benefits");
  });

  it("returns a re-preview conflict without revalidation", async () => {
    confirm.mockRejectedValue(new Error("conflict_repreview_required"));
    const response = await confirmPost(request("confirm", { envelope, manualMappings: [], proposalToken: "x".repeat(40) }));
    expect(response.status).toBe(409);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
