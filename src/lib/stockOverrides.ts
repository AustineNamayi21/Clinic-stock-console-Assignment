// DummyJSON's PUT /products/:id returns 200 with the updated object but
// does not actually persist the change server-side - a later refetch
// returns the original value. This store holds session-scoped corrections
// so a saved correction doesn't visually revert when the list or detail
// query refetches in the background. It is explicitly not a substitute
// for real persistence and is cleared on sign-out (see AuthContext).

const STORAGE_KEY = 'csc:stockOverrides';

function readAll(): Record<number, number> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeAll(overrides: Record<number, number>): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
}

export function getStockOverride(productId: number): number | undefined {
  return readAll()[productId];
}

export function setStockOverride(productId: number, stock: number): void {
  const all = readAll();
  all[productId] = stock;
  writeAll(all);
}

/** Applies any known override onto a product before it reaches the UI. */
export function applyStockOverride<T extends { id: number; stock: number }>(
  product: T,
): T {
  const override = getStockOverride(product.id);
  return override === undefined ? product : { ...product, stock: override };
}
