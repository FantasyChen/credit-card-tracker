import { ChromeLocalStorage } from "../storage";

describe("Chrome local storage adapter", () => {
  it("maps reader key/value operations to chrome.storage.local without widening the port", async () => {
    const values = new Map<string, unknown>();
    const area = {
      get: jest.fn(async (key: string) => values.has(key) ? { [key]: values.get(key) } : {}),
      set: jest.fn(async (items: Record<string, unknown>) => {
        Object.entries(items).forEach(([key, value]) => values.set(key, value));
      }),
      remove: jest.fn(async (keys: string | string[]) => {
        for (const key of Array.isArray(keys) ? keys : [keys]) values.delete(key);
      }),
    };
    const storage = new ChromeLocalStorage(area);

    await expect(storage.getValue("missing", "fallback")).resolves.toBe("fallback");
    await storage.setValue("reader.store", { normalized: true });
    await expect(storage.getValue("reader.store")).resolves.toEqual({ normalized: true });
    await storage.deleteValue("reader.store");
    await expect(storage.getValue("reader.store", null)).resolves.toBeNull();
    expect(area.get).toHaveBeenCalledTimes(3);
    expect(area.set).toHaveBeenCalledWith({ "reader.store": { normalized: true } });
    expect(area.remove).toHaveBeenCalledWith("reader.store");
  });
});
