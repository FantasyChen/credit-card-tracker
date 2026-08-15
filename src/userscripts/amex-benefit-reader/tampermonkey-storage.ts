import {
  BrowserCardIdentityService,
  BrowserMailboxStorage,
  BrowserResultStore,
  type ReaderStorage,
} from "./storage-port";

declare const GM: {
  getValue(key: string, defaultValue?: unknown): Promise<unknown>;
  setValue(key: string, value: unknown): Promise<void>;
  deleteValue(key: string): Promise<void>;
};

class TampermonkeyStorage implements ReaderStorage {
  getValue(key: string, defaultValue?: unknown): Promise<unknown> {
    return GM.getValue(key, defaultValue);
  }

  setValue(key: string, value: unknown): Promise<void> {
    return GM.setValue(key, value);
  }

  deleteValue(key: string): Promise<void> {
    return GM.deleteValue(key);
  }
}

const storage = new TampermonkeyStorage();

export const PRIMARY_ONLY_COMPATIBILITY_KEY = "perksReminder.amexBenefitReader.compat.primaryOnly.v1" as const;
export const PRIMARY_ONLY_COMPATIBILITY_VALUE = "primary-only/1" as const;
export const V3_SELECTION_COMPATIBILITY_KEY = "perksReminder.amexBenefitReader.compat.v3Selection.v1" as const;
export const V3_SELECTION_COMPATIBILITY_VALUE = "v3-selection/1" as const;

export class TampermonkeyResultStore extends BrowserResultStore {
  constructor() {
    super(storage);
  }
}

export class TampermonkeyMailboxStorage extends BrowserMailboxStorage {
  constructor() {
    super(storage);
  }
}

export class TampermonkeyCardIdentityService extends BrowserCardIdentityService {
  constructor() {
    super(storage);
  }
}
