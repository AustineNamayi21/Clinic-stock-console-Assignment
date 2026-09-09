import { describe, expect, it } from 'vitest';
import { fetchStockList, PAGE_SIZE } from './products';
import type { ApiClient } from './client';
import type { Product, ProductListResponse } from './types';

function makeProduct(overrides: Partial<Product>): Product {
  return {
    id: 1,
    title: 'Item',
    description: '',
    category: 'a',
    price: 10,
    stock: 5,
    thumbnail: '',
    images: [],
    ...overrides,
  };
}

describe('fetchStockList', () => {
  it('fetches the full search-matched set and filters/paginates client-side when both q and category are active, rather than filtering an already-truncated server page', async () => {
    // More matches for the target category than fit on one page, mixed
    // in with matches from another category.
    const allMatches: Product[] = [
      ...Array.from({ length: 25 }, (_, i) =>
        makeProduct({
          id: i + 1,
          title: `Bandage ${i}`,
          category: 'wound-care',
        }),
      ),
      makeProduct({ id: 100, title: 'Bandage scissors', category: 'tools' }),
    ];

    const calledPaths: string[] = [];
    const client: ApiClient = {
      fetch: async <T>(path: string) => {
        calledPaths.push(path);
        expect(path).toContain('/products/search');
        expect(path).toContain('limit=0');
        return {
          products: allMatches,
          total: allMatches.length,
          skip: 0,
          limit: 0,
        } as ProductListResponse as T;
      },
    };

    const page1 = await fetchStockList(client, {
      q: 'bandage',
      category: 'wound-care',
      sortBy: 'title',
      order: 'asc',
      page: 1,
    });

    // Only wound-care matches count - the 'tools' item is excluded.
    expect(page1.total).toBe(25);
    expect(page1.pageCount).toBe(Math.ceil(25 / PAGE_SIZE));
    expect(page1.products).toHaveLength(PAGE_SIZE);
    expect(page1.products.every((p) => p.category === 'wound-care')).toBe(true);

    const page2 = await fetchStockList(client, {
      q: 'bandage',
      category: 'wound-care',
      sortBy: 'title',
      order: 'asc',
      page: 2,
    });

    // The remaining 5 matches appear on page 2 rather than being lost.
    expect(page2.products).toHaveLength(25 - PAGE_SIZE);
    expect(calledPaths).toHaveLength(2);
  });

  it('uses the plain /products route when no query and no category are active', async () => {
    const client: ApiClient = {
      fetch: async <T>(path: string) => {
        expect(path).toContain('/products?');
        expect(path).not.toContain('/search');
        expect(path).not.toContain('/category');
        return {
          products: [],
          total: 0,
          skip: 0,
          limit: PAGE_SIZE,
        } as ProductListResponse as T;
      },
    };

    const result = await fetchStockList(client, {
      q: '',
      category: '',
      sortBy: 'title',
      order: 'asc',
      page: 1,
    });

    expect(result.source).toBe('all');
  });
});
