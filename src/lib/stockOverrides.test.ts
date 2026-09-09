import { beforeEach, describe, expect, it } from 'vitest';
import {
  applyStockOverride,
  getStockOverride,
  setStockOverride,
} from './stockOverrides';

describe('stockOverrides', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('returns undefined for a product with no override', () => {
    expect(getStockOverride(1)).toBeUndefined();
  });

  it('applies a stored override onto a product, leaving other fields untouched', () => {
    setStockOverride(42, 7);
    const product = { id: 42, stock: 3, title: 'Gauze' };

    expect(applyStockOverride(product)).toEqual({
      id: 42,
      stock: 7,
      title: 'Gauze',
    });
  });

  it('does not affect products without a matching override', () => {
    setStockOverride(42, 7);
    const product = { id: 99, stock: 3, title: 'Tape' };

    expect(applyStockOverride(product)).toEqual(product);
  });

  it('survives repeated reads, simulating a background refetch overwriting cached data', () => {
    setStockOverride(1, 10);
    expect(getStockOverride(1)).toBe(10);

    setStockOverride(1, 12);
    expect(getStockOverride(1)).toBe(12);
  });
});
