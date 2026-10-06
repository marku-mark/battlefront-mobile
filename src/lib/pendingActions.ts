export function createPendingActions<T>() {
  const pending = new Map<string, Promise<T>>();
  return {
    run(key: string, action: () => Promise<T>): Promise<T> {
      const existing = pending.get(key);
      if (existing) return existing;
      const result = Promise.resolve().then(action).finally(() => {
        if (pending.get(key) === result) pending.delete(key);
      });
      pending.set(key, result);
      return result;
    },
  };
}
