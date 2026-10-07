// DummyJSON's PUT /products/:id returns 200 with the updated object but
// does not actually persist the change server-side - a later refetch
// returns the original value. This store holds session-scoped corrections
// so a saved correction doesn't visually revert when the list or detail
// query refetches in the background. It is explicitly not a substitute
// for real persistence and is cleared on sign-out (see AuthContext).
//
// Components subscribe to it (useSyncExternalStore via useStockOverrides),
// so a correction shows everywhere it applies as soon as it is made,
// without waiting for a refetch.

const STORAGE_KEY = 'csc:stockOverrides';

type Overrides = Record<number, number>;

const listeners = new Set<() => void>();

// Parsing is cached against the raw string, so reading overrides for every
// row on every render costs a sessionStorage lookup, not a JSON.parse.
let cachedRaw: string | null = null;
let cachedValue: Overrides = {};

function readRaw(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function readAll(): Overrides {
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      cachedValue = raw ? JSON.parse(raw) : {};
    } catch {
      cachedValue = {};
    }
  }
  return cachedValue;
}

function writeAll(overrides: Overrides): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  } catch {
    // Storage full or unavailable: the correction still applies for this
    // render cycle via the cache below, it just won't survive a reload.
  }
  cachedRaw = readRaw();
  cachedValue = overrides;
  listeners.forEach((notify) => notify());
}

export function getStockOverride(productId: number): number | undefined {
  return readAll()[productId];
}

export function setStockOverride(productId: number, stock: number): void {
  writeAll({ ...readAll(), [productId]: stock });
}

export function clearStockOverride(productId: number): void {
  const next = { ...readAll() };
  delete next[productId];
  writeAll(next);
}

/** Applies an override from `overrides` onto a product, if there is one. */
export function withStockOverride<T extends { id: number; stock: number }>(
  product: T,
  overrides: Readonly<Overrides>,
): T {
  const override = overrides[product.id];
  return override === undefined ? product : { ...product, stock: override };
}

/** Applies any known override onto a product before it reaches the UI. */
export function applyStockOverride<T extends { id: number; stock: number }>(
  product: T,
): T {
  return withStockOverride(product, readAll());
}

/** For useSyncExternalStore: notified whenever an override changes. */
export function subscribeToStockOverrides(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * For useSyncExternalStore: the current overrides. The same object is
 * returned until an override actually changes, as the hook requires.
 */
export function getStockOverridesSnapshot(): Readonly<Overrides> {
  return readAll();
}
