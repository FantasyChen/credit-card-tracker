import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { resolveAmexSyncConfiguration } from "@/lib/amex-sync/mode";
import AmexSyncPage from "../page";

jest.mock("next-auth", () => ({
  getServerSession: jest.fn(),
}));

jest.mock("next/navigation", () => ({
  redirect: jest.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

jest.mock("@/lib/amex-sync/mode", () => ({
  resolveAmexSyncConfiguration: jest.fn(),
}));

jest.mock("../AmexSyncHandoffClient", () => ({
  AmexSyncHandoffClient: jest.fn(() => null),
}));

const mockedSession = getServerSession as jest.MockedFunction<typeof getServerSession>;
const mockedRedirect = redirect as jest.MockedFunction<typeof redirect>;
const mockedConfiguration = resolveAmexSyncConfiguration as jest.MockedFunction<typeof resolveAmexSyncConfiguration>;

describe("authenticated Amex sync handoff page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedConfiguration.mockReturnValue({ mode: "off", hmacKey: null });
  });

  it("returns a signed-out user with only the validated opaque locator", async () => {
    mockedSession.mockResolvedValue(null);
    const transfer = "a".repeat(32);

    await expect(AmexSyncPage({
      searchParams: Promise.resolve({ transfer }),
    })).rejects.toThrow("NEXT_REDIRECT");

    expect(mockedRedirect).toHaveBeenCalledWith(
      `/api/auth/signin?callbackUrl=${encodeURIComponent(`/integrations/amex-sync?transfer=${transfer}`)}`,
    );
    expect(mockedConfiguration).not.toHaveBeenCalled();
  });

  it("drops an invalid locator from the sign-in callback", async () => {
    mockedSession.mockResolvedValue(null);

    await expect(AmexSyncPage({
      searchParams: Promise.resolve({ transfer: "invalid?payload=forbidden" }),
    })).rejects.toThrow("NEXT_REDIRECT");

    expect(mockedRedirect).toHaveBeenCalledWith(
      `/api/auth/signin?callbackUrl=${encodeURIComponent("/integrations/amex-sync")}`,
    );
  });
});
