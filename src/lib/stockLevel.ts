/**
 * Stock status thresholds. Kept separate from the presentational
 * component so the file exporting UI exports only UI - and so the
 * thresholds can be tested and reused without importing React.
 */
export type StockLevel = 'out' | 'low' | 'ok';

export function stockLevel(stock: number): StockLevel {
  if (stock === 0) return 'out';
  if (stock <= 10) return 'low';
  return 'ok';
}

export const STOCK_LABELS: Record<StockLevel, string> = {
  out: 'Out of stock',
  low: 'Low',
  ok: 'In stock',
};
