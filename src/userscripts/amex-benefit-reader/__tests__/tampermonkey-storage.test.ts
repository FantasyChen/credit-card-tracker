import { IDENTITY_SECRET_KEY, STORE_KEY } from "@/lib/amex-benefit-reader/storage-policy";
import { TampermonkeyResultStore } from "../tampermonkey-storage";

interface FakeGm {
  getValue: jest.Mock<Promise<unknown>, [string, unknown?]>;
  setValue: jest.Mock<Promise<void>, [string, unknown]>;
  deleteValue: jest.Mock<Promise<void>, [string]>;
}

describe("Tampermonkey storage adapter", () => {
  let gm: FakeGm;

  beforeEach(() => {
    gm = {
      getValue: jest.fn<Promise<unknown>, [string, unknown?]>(async () => null),
      setValue: jest.fn<Promise<void>, [string, unknown]>(async () => undefined),
      deleteValue: jest.fn<Promise<void>, [string]>(async () => undefined),
    };
    (globalThis as unknown as { GM: FakeGm }).GM = gm;
  });

  afterEach(() => {
    delete (globalThis as unknown as { GM?: FakeGm }).GM;
  });

  it("loads an empty validated envelope without writing or scanning", async () => {
    const store = new TampermonkeyResultStore();
    await expect(store.load()).resolves.toMatchObject({ schemaVersion: 1, revision: 0, cards: {} });
    expect(gm.getValue).toHaveBeenCalledWith(STORE_KEY, null);
    expect(gm.setValue).not.toHaveBeenCalled();
  });

  it("clears exactly the normalized store and local identity secret", async () => {
    await new TampermonkeyResultStore().clear();
    expect(gm.deleteValue.mock.calls.map(([key]) => key).sort()).toEqual([
      IDENTITY_SECRET_KEY,
      STORE_KEY,
    ].sort());
  });
});
