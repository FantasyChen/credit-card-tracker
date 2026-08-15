import type { ReaderStorage } from "@/userscripts/amex-benefit-reader/storage-port";

export interface ChromeStorageArea {
  get(keys?: string | string[] | Record<string, unknown> | null): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
}

declare const chrome: { storage: { local: ChromeStorageArea } };

export class ChromeLocalStorage implements ReaderStorage {
  constructor(private readonly area: ChromeStorageArea = chrome.storage.local) {}

  async getValue(key: string, defaultValue?: unknown): Promise<unknown> {
    const values = await this.area.get(key);
    return Object.hasOwn(values, key) ? values[key] : defaultValue;
  }

  setValue(key: string, value: unknown): Promise<void> {
    return this.area.set({ [key]: value });
  }

  removeValue(key: string): Promise<void> {
    return this.area.remove(key);
  }

  deleteValue(key: string): Promise<void> {
    return this.area.remove(key);
  }
}
