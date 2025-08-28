export type KvStore = {
  getAllKeys: () => string[];
  getItem: (key: string) => string | undefined;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

export const LOCALSTORAGE_AS_KVSTORE: KvStore = {
  getAllKeys: function (): string[] {
    const lsKeys: string[] = [];
    for (const key in localStorage) {
      if (!localStorage.hasOwnProperty(key)) continue;
      lsKeys.push(key);
    }
    return lsKeys;
  },
  getItem: function (key: string): string | undefined {
    return localStorage.getItem(key) || undefined;
  },
  setItem: function (key: string, value: string): void {
    localStorage.setItem(key, value);
  },
  removeItem: function (key: string): void {
    localStorage.removeItem(key);
  },
};
