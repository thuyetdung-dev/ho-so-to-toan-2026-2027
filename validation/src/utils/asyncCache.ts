/** Bounded promise cache: share in-flight reads; failed reads may be retried. */
export function asyncCache<T>(capacity = 5, ttlMs = 120000) {
  const items = new Map<string, { at: number; value: Promise<T> }>();
  let epoch = 0;
  return {
    clear() {
      epoch++;
      items.clear();
    },
    get(key: string, load: () => Promise<T>): Promise<T> {
      const existing = items.get(key);
      if (existing && Date.now() - existing.at < ttlMs) {
        items.delete(key);
        items.set(key, existing);
        return existing.value;
      }
      items.delete(key);
      const ownEpoch = epoch;
      const value = Promise.resolve().then(load);
      items.set(key, { at: Date.now(), value });
      while (items.size > capacity) items.delete(items.keys().next().value!);
      value.catch(() => {
        if (ownEpoch === epoch && items.get(key)?.value === value)
          items.delete(key);
      });
      return value;
    },
    get size() {
      return items.size;
    },
  };
}
