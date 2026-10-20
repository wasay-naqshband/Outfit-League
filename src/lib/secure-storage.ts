type SecureStore = {
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string) => Promise<void>;
  deleteItemAsync: (key: string) => Promise<void>;
};
// Keep each Keychain/Keystore entry below the small-payload limits on older iOS.
// Write the manifest last so an interrupted write never exposes partial tokens.
export function createSecureStorage(store: SecureStore) {
  const chunkSize = 500;
  const manifest = (
    value: string | null,
  ): { version: string; count: number } | null => {
    const match = value?.match(/^OL1:([a-z0-9-]+):(\d+)$/);
    if (!match) return null;
    const count = Number(match[2]);
    return count > 0 && count <= 64 ? { version: match[1]!, count } : null;
  };
  const removeChunks = async (name: string, value: string | null) => {
    const info = manifest(value);
    if (info)
      await Promise.all(
        Array.from({ length: info.count }, (_, i) =>
          store.deleteItemAsync(name + "." + info.version + "." + i),
        ),
      );
  };
  return {
    async getItem(name: string) {
      const value = await store.getItemAsync(name),
        info = manifest(value);
      if (!info) return value?.startsWith("OL1:") ? null : value;
      const parts = await Promise.all(
        Array.from({ length: info.count }, (_, i) =>
          store.getItemAsync(name + "." + info.version + "." + i),
        ),
      );
      return parts.some((part) => part === null) ? null : parts.join("");
    },
    async setItem(name: string, value: string) {
      if (value.length > chunkSize * 64)
        throw new Error("Session is too large for secure storage");
      const previous = await store.getItemAsync(name);
      const version =
        Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
      const count = Math.max(1, Math.ceil(value.length / chunkSize));
      for (let i = 0; i < count; i++)
        await store.setItemAsync(
          name + "." + version + "." + i,
          value.slice(i * chunkSize, (i + 1) * chunkSize),
        );
      await store.setItemAsync(name, "OL1:" + version + ":" + count);
      await removeChunks(name, previous).catch(() => {});
    },
    async removeItem(name: string) {
      const previous = await store.getItemAsync(name);
      await store.deleteItemAsync(name);
      await removeChunks(name, previous);
    },
  };
}
