import type { Page } from "./apiClient";

export type CatalogSnapshot<T> = { rows: T[]; loading: boolean; error: Error | null; complete: boolean };

export function createProgressiveCatalog<T>(loadPage: (page: number) => Promise<Page<T>>, maxAgeMs = 60_000, now = Date.now) {
  let snapshot: CatalogSnapshot<T> = { rows: [], loading: false, error: null, complete: false };
  let first: Promise<T[]> | null = null;
  let all: Promise<T[]> | null = null;
  let expiresAt = 0;
  let generation = 0;
  let nextPage = 1;
  let lastPage = 1;
  const listeners = new Set<(value: CatalogSnapshot<T>) => void>();
  function publish(value: CatalogSnapshot<T>) {
    snapshot = value;
    listeners.forEach((listener) => listener(value));
  }
  function start() {
    if (first && (snapshot.loading || now() < expiresAt)) return;
    if (snapshot.complete) { nextPage = 1; lastPage = 1; }
    const current = ++generation;
    publish({ ...snapshot, loading: true, error: null });
    first = nextPage > 1 ? Promise.resolve(snapshot.rows) : loadPage(1).then((result) => {
      if (current === generation) {
        nextPage = 2;
        lastPage = result.meta.last_page;
        publish({ rows: result.data, loading: lastPage > 1, error: null, complete: lastPage <= 1 });
      }
      return result;
    }).then((result) => result.data);
    all = (async () => {
      try {
        const rows = [...await first!];
        // Fetch pages in order and publish each batch without blocking the first screen.
        for (let page = nextPage; current === generation && page <= lastPage; page++) {
          const result = await loadPage(page);
          if (current !== generation) return rows;
          rows.push(...result.data);
          nextPage = page + 1;
          lastPage = result.meta.last_page;
          publish({ rows: [...rows], loading: page < result.meta.last_page, error: null, complete: page >= result.meta.last_page });
        }
        if (current === generation) expiresAt = now() + maxAgeMs;
        return rows;
      } catch (reason) {
        if (current === generation) {
          expiresAt = 0;
          publish({ ...snapshot, loading: false, complete: false, error: reason instanceof Error ? reason : new Error("Could not load products.") });
        }
        throw reason;
      }
    })();
    void all.catch(() => undefined);
  }
  return {
    first() { start(); return first!.then(() => snapshot.rows); },
    all() { start(); return all!; },
    snapshot() { return snapshot; },
    subscribe(listener: (value: CatalogSnapshot<T>) => void) { listeners.add(listener); listener(snapshot); return () => { listeners.delete(listener); }; },
    invalidate() { generation++; first = null; all = null; expiresAt = 0; nextPage = 1; lastPage = 1; publish({ ...snapshot, loading: false, complete: false }); },
  };
}
