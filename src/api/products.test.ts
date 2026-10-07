import { describe, expect, it } from 'vitest';
import {
  fetchStockList,
  normaliseSearchTerm,
  PAGE_SIZE,
  searchCatalogue,
  sortProducts,
  stockPageFromCatalogue,
} from './products';
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

describe('searching and sorting in the browser match DummyJSON', () => {
  const items = [
    makeProduct({ id: 1, title: 'iPhone 13', description: 'A phone' }),
    makeProduct({ id: 2, title: 'iPhone 9', description: 'An older phone' }),
    makeProduct({ id: 3, title: 'apple juice', description: 'Fresh-pressed' }),
    makeProduct({ id: 4, title: 'Bandage', description: 'Sterile wound dressing' }),
  ];

  it('matches the title or description, ignoring case and trimming the term', () => {
    expect(searchCatalogue(items, '  PHONE ').map((p) => p.id)).toEqual([1, 2]);
    expect(searchCatalogue(items, 'wound').map((p) => p.id)).toEqual([4]);
  });

  it('treats hyphens in the term as spaces, as the server does', () => {
    expect(normaliseSearchTerm('fresh-pressed')).toBe('fresh pressed');
    expect(searchCatalogue(items, 'fresh-pressed')).toEqual([]);
  });

  it('sorts names case-insensitively with numbers in natural order', () => {
    const titles = sortProducts(items, 'title', 'asc').map((p) => p.title);
    expect(titles).toEqual(['apple juice', 'Bandage', 'iPhone 9', 'iPhone 13']);
  });

  it('pages a search + category result from the catalogue', () => {
    const many = Array.from({ length: 25 }, (_, i) =>
      makeProduct({ id: i + 1, title: `Gauze ${i + 1}`, category: 'wound-care' }),
    );
    const page2 = stockPageFromCatalogue(many, {
      q: 'gauze',
      category: 'wound-care',
      sortBy: 'title',
      order: 'asc',
      page: 2,
    });
    expect(page2.total).toBe(25);
    expect(page2.products.map((p) => p.title)).toEqual([
      'Gauze 21',
      'Gauze 22',
      'Gauze 23',
      'Gauze 24',
      'Gauze 25',
    ]);
  });
});
