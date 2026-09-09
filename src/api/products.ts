import type { ApiClient } from './client';
import type { Product, ProductListResponse } from './types';

export const PAGE_SIZE = 20;

export type SortField = 'title' | 'price' | 'stock';
export type SortOrder = 'asc' | 'desc';

export interface StockListParams {
  q: string;
  category: string; // '' means all categories
  sortBy: SortField;
  order: SortOrder;
  page: number; // 1-indexed
}

export interface StockListResult {
  products: Product[];
  total: number;
  page: number;
  pageCount: number;
  /** Which server strategy produced this page - useful for tests/debugging. */
  source: 'all' | 'search' | 'category' | 'search+category';
}

const SELECT_FIELDS =
  'id,title,description,category,price,stock,brand,thumbnail,images';

function paginate<T>(items: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

function sortProducts(
  products: Product[],
  sortBy: SortField,
  order: SortOrder,
): Product[] {
  const sorted = [...products].sort((a, b) => {
    const av = a[sortBy];
    const bv = b[sortBy];
    if (typeof av === 'string' && typeof bv === 'string') {
      return av.localeCompare(bv);
    }
    return (av as number) - (bv as number);
  });
  return order === 'desc' ? sorted.reverse() : sorted;
}

/**
 * Fetches one page of the stock list, using the most efficient DummyJSON
 * route available for the active filters.
 *
 * DummyJSON's /products/search and /products/category/:slug routes do not
 * support combining a text query with a category filter server-side. When
 * both are active, we fetch the full matching search result set (the
 * catalogue is only 194 items, so this is cheap) and apply the category
 * filter, sort, and pagination client-side - rather than filtering a page
 * the server already truncated, which would silently drop matches and
 * desync the pagination count from what's actually shown.
 */
export async function fetchStockList(
  client: ApiClient,
  params: StockListParams,
  signal?: AbortSignal,
): Promise<StockListResult> {
  const { q, category, sortBy, order, page } = params;
  const skip = (page - 1) * PAGE_SIZE;

  if (q && category) {
    const res = await client.fetch<ProductListResponse>(
      `/products/search?q=${encodeURIComponent(q)}&limit=0&select=${SELECT_FIELDS}`,
      { signal },
    );
    const matching = res.products.filter((p) => p.category === category);
    const sorted = sortProducts(matching, sortBy, order);
    return {
      products: paginate(sorted, page, PAGE_SIZE),
      total: sorted.length,
      page,
      pageCount: Math.max(1, Math.ceil(sorted.length / PAGE_SIZE)),
      source: 'search+category',
    };
  }

  if (q) {
    const res = await client.fetch<ProductListResponse>(
      `/products/search?q=${encodeURIComponent(q)}&limit=${PAGE_SIZE}&skip=${skip}&sortBy=${sortBy}&order=${order}&select=${SELECT_FIELDS}`,
      { signal },
    );
    return {
      products: res.products,
      total: res.total,
      page,
      pageCount: Math.max(1, Math.ceil(res.total / PAGE_SIZE)),
      source: 'search',
    };
  }

  if (category) {
    const res = await client.fetch<ProductListResponse>(
      `/products/category/${encodeURIComponent(category)}?limit=${PAGE_SIZE}&skip=${skip}&sortBy=${sortBy}&order=${order}&select=${SELECT_FIELDS}`,
      { signal },
    );
    return {
      products: res.products,
      total: res.total,
      page,
      pageCount: Math.max(1, Math.ceil(res.total / PAGE_SIZE)),
      source: 'category',
    };
  }

  const res = await client.fetch<ProductListResponse>(
    `/products?limit=${PAGE_SIZE}&skip=${skip}&sortBy=${sortBy}&order=${order}&select=${SELECT_FIELDS}`,
    { signal },
  );
  return {
    products: res.products,
    total: res.total,
    page,
    pageCount: Math.max(1, Math.ceil(res.total / PAGE_SIZE)),
    source: 'all',
  };
}

export async function fetchProduct(
  client: ApiClient,
  id: number,
  signal?: AbortSignal,
): Promise<Product> {
  return client.fetch<Product>(`/products/${id}`, { signal });
}

export async function fetchCategories(
  client: ApiClient,
  signal?: AbortSignal,
): Promise<string[]> {
  // DummyJSON's /products/categories returns objects; we only need the slug.
  const res = await client.fetch<Array<{ slug: string; name: string }>>(
    '/products/categories',
    { signal },
  );
  return res.map((c) => c.slug);
}

export async function updateStock(
  client: ApiClient,
  id: number,
  stock: number,
): Promise<Product> {
  return client.fetch<Product>(`/products/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ stock }),
  });
}