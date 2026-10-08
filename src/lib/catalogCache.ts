import type { Page } from "./apiClient";

export type CatalogSnapshot<T> = { rows: T[]; loading: boolean; error: Error | null; complete: boolean };

export function createProgressiveCatalog<T>(loadPage: (page: number, shouldContinue: () => boolean) => Promise<Page<T>>, maxAgeMs = 60_000, now = Date.now) {
  let snapshot: CatalogSnapshot<T> = { rows: [], loading: false, error: null, complete: false };
  let pending: Promise<T[]> | null = null;
  let expiresAt = 0;
  let generation = 0;
  let nextPage = 1;
  const listeners = new Set<(value: CatalogSnapshot<T>) => void>();
  function publish(value: CatalogSnapshot<T>) {
    snapshot = value;
    listeners.forEach((listener) => listener(value));
  }
  function loadNext(): Promise<T[]> {
    if (pending) return pending;
    if (snapshot.complete && nextPage > 1) return Promise.resolve(snapshot.rows);
    const current = generation;
    const page = nextPage;
    publish({ ...snapshot, loading: true, error: null });
    const request = loadPage(page, () => current === generation).then((result) => {
      if (current !== generation) return snapshot.rows;
      nextPage = page + 1;
      expiresAt = now() + maxAgeMs;
      publish({ rows: page === 1 ? result.data : [...snapshot.rows, ...result.data], loading: false, error: null, complete: page >= result.meta.last_page });
      return snapshot.rows;
    }).catch((reason) => {
      if (current === generation) publish({ ...snapshot, loading: false, error: reason instanceof Error ? reason : new Error("Could not load products.") });
      throw reason;
    }).finally(() => { if (pending === request) pending = null; });
    pending = request;
    return request;
  }
  function first(): Promise<T[]> {
    if (pending) return nextPage > 1 ? Promise.resolve(snapshot.rows) : pending;
    if (nextPage > 1 && (snapshot.error || now() < expiresAt)) return Promise.resolve(snapshot.rows);
    nextPage = 1;
    return loadNext();
  }
  return {
    first,
    resume: first,
    next: loadNext,
    async all(shouldContinue: () => boolean = () => true) {
      const current = generation;
      await first();
      while (current === generation && shouldContinue() && !snapshot.complete) await loadNext();
      return snapshot.rows;
    },
    snapshot() { return snapshot; },
    subscribe(listener: (value: CatalogSnapshot<T>) => void) { listeners.add(listener); listener(snapshot); return () => { listeners.delete(listener); }; },
    invalidate(clearRows = false) { generation++; pending = null; expiresAt = 0; nextPage = 1; publish({ ...snapshot, rows: clearRows ? [] : snapshot.rows, loading: false, complete: false, error: null }); },
  };
}
