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

// Sorting and searching done in the browser must give exactly the results
// DummyJSON would, so a list never changes order or contents depending on
// whether it came from the server or was worked out locally. These mirror
// DummyJSON's own implementation (src/utils/util.js sortArray and
// src/controllers/product.js searchProducts in github.com/Ovi/DummyJSON).

// Case-insensitive and number-aware: "iPhone 9" sorts before "iPhone 13".
const titleCollator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

function compareValues(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (typeof a === 'string' && typeof b === 'string')
    return titleCollator.compare(a, b);
  return (a as number) > (b as number) ? 1 : -1;
}

export function sortProducts(
  products: Product[],
  sortBy: SortField,
  order: SortOrder,
): Product[] {
  const direction = order === 'asc' ? 1 : -1;
  return [...products].sort((a, b) => {
    const av = a[sortBy];
    const bv = b[sortBy];
    // Items without the field always go last, as on the server.
    const aMissing = av === undefined || av === null;
    const bMissing = bv === undefined || bv === null;
    if (aMissing || bMissing) return Number(aMissing) - Number(bMissing);
    return compareValues(av, bv) * direction;
  });
}

/** Normalises a search term the way DummyJSON does before matching. */
export function normaliseSearchTerm(q: string): string {
  return q.trim().toLowerCase().split('-').join(' ');
}

/**
 * DummyJSON's search rule: the term appears in the title or the
 * description, ignoring case. Runs over a catalogue held in the browser.
 */
export function searchCatalogue(catalogue: Product[], q: string): Product[] {
  const term = normaliseSearchTerm(q);
  return catalogue.filter(
    (p) =>
      p.title.toLowerCase().includes(term) ||
      p.description.toLowerCase().includes(term),
  );
}

function pageOf(
  matches: Product[],
  params: StockListParams,
  source: StockListResult['source'],
): StockListResult {
  const sorted = sortProducts(matches, params.sortBy, params.order);
  return {
    products: paginate(sorted, params.page, PAGE_SIZE),
    total: sorted.length,
    page: params.page,
    pageCount: Math.max(1, Math.ceil(sorted.length / PAGE_SIZE)),
    source,
  };
}

/**
 * One page of search results worked out from the whole catalogue, exactly
 * as DummyJSON would return it (search, then category, sort and page).
 */
export function stockPageFromCatalogue(
  catalogue: Product[],
  params: StockListParams,
): StockListResult {
  const matches = searchCatalogue(catalogue, params.q);
  return params.category
    ? pageOf(
        matches.filter((p) => p.category === params.category),
        params,
        'search+category',
      )
    : pageOf(matches, params, 'search');
}

export interface StockListSources {
  /**
   * The whole catalogue if it is already held in the browser, or
   * undefined when it isn't. When present, searches are worked out locally
   * with no request at all.
   */
  catalogue?: () => Product[] | undefined;
  /**
   * Supplies the full search result set for the search+category path.
   * The query hook passes a cached version, so changing the page, sort or
   * category for the same search term doesn't refetch the whole set.
   */
  loadAllMatches?: (q: string) => Promise<Product[]>;
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
  sources: StockListSources = {},
): Promise<StockListResult> {
  const { q, category, sortBy, order, page } = params;
  const skip = (page - 1) * PAGE_SIZE;
  const loadAllMatches =
    sources.loadAllMatches ??
    ((term: string) => fetchAllSearchMatches(client, term, signal));

  // Fast path: the whole catalogue is already in the browser, so any
  // search (with or without a category) is answered locally, instantly.
  const catalogue = q ? sources.catalogue?.() : undefined;
  if (catalogue) return stockPageFromCatalogue(catalogue, params);

  if (q && category) {
    const all = await loadAllMatches(q);
    return pageOf(
      all.filter((p) => p.category === category),
      params,
      'search+category',
    );
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

/**
 * The whole catalogue (194 items) in one request, with only the fields the
 * app shows. Fetched once in the background so searches can run locally.
 */
export async function fetchCatalogue(
  client: ApiClient,
  signal?: AbortSignal,
): Promise<Product[]> {
  const res = await client.fetch<ProductListResponse>(
    `/products?limit=0&select=${SELECT_FIELDS}`,
    { signal },
  );
  return res.products;
}

/** Every product matching a search term, in one request (`limit=0`). */
export async function fetchAllSearchMatches(
  client: ApiClient,
  q: string,
  signal?: AbortSignal,
): Promise<Product[]> {
  const res = await client.fetch<ProductListResponse>(
    `/products/search?q=${encodeURIComponent(q)}&limit=0&select=${SELECT_FIELDS}`,
    { signal },
  );
  return res.products;
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
