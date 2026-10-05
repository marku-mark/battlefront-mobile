export function createReadCache<T>(maxAgeMs: number, now = Date.now, maxEntries = 100) {
  type Entry = { value?: T; expiresAt: number; pending?: Promise<T> };
  const entries = new Map<string, Entry>();
  function trim(keep: string) {
    for (const [key, entry] of entries) {
      if (entries.size <= maxEntries) break;
      if (key !== keep && !entry.pending) entries.delete(key);
    }
  }
  return {
    peek(key: string): T | undefined { return entries.get(key)?.value; },
    seed(key: string, value: T) {
      if (!entries.get(key)?.pending) entries.set(key, { value, expiresAt: now() + maxAgeMs });
      trim(key);
    },
    read(key: string, load: () => Promise<T>): Promise<T> {
      let entry = entries.get(key);
      if (entry?.pending) return entry.pending;
      if (entry && entry.value !== undefined && now() < entry.expiresAt) return Promise.resolve(entry.value);
      if (!entry) {
        entry = { expiresAt: 0 };
        entries.set(key, entry);
      }
      const current = entry;
      const result = Promise.resolve().then(() => {
        if (entries.get(key) !== current) throw new Error("This information changed. Please reopen the screen.");
        return load();
      }).then((value) => {
        if (entries.get(key) !== current) throw new Error("This information changed. Please reopen the screen.");
        current.value = value;
        current.expiresAt = now() + maxAgeMs;
        return value;
      }).finally(() => {
        if (current.pending === result) current.pending = undefined;
        trim(key);
      });
      current.pending = result;
      return result;
    },
    clear() { entries.clear(); },
  };
}

export async function loadSelectedProducts<T>(ids: string[], load: (id: string) => Promise<T | null>, concurrency = 3): Promise<T[]> {
  const uniqueIds = [...new Set(ids)];
  const rows: (T | null)[] = new Array(uniqueIds.length).fill(null);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, uniqueIds.length) }, async () => {
    while (next < uniqueIds.length) {
      const index = next++;
      rows[index] = await load(uniqueIds[index]);
    }
  }));
  return rows.filter((row): row is T => row !== null);
}
