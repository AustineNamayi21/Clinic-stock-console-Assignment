import { vi } from 'vitest';

/**
 * A fake DummyJSON product catalogue for whole-app tests. It follows the
 * real API's behaviour for the parts the app relies on:
 *
 * - `/products`, `/products/search`, `/products/category/:slug` with
 *   `limit`, `skip`, `sortBy` and `order` (search ignores `category`, as
 *   the real API does)
 * - `/products/:id`, `/products/categories`, `/auth/me`
 * - `?delay=<ms>` holds the response for that long, like DummyJSON's
 *   delay parameter, and is cancelled by the request's AbortSignal
 * - `/http/500` answers with a 500, like DummyJSON's status endpoint
 *
 * `serverDown` sends every product request to `/http/500`, which is how the
 * tests exercise the error path. `delays` adds the delay parameter to
 * searches for particular terms, to stage a slow-then-fast race.
 */
export interface FakeCatalogue {
  requests: string[];
  aborted: string[];
  serverDown: boolean;
  categoriesDown: boolean;
  /** Makes the whole-catalogue download fail, so searches use the server. */
  catalogueDown: boolean;
  delays: Record<string, number>;
}

export interface FakeProduct {
  id: number;
  title: string;
  category: string;
  stock: number;
  price: number;
  brand?: string;
  description: string;
  thumbnail: string;
  images: string[];
}

const CATEGORIES = ['laptops', 'smartphones', 'groceries'];

function makeCatalogue(): FakeProduct[] {
  const items: FakeProduct[] = [];
  // 25 laptops, 25 phones and 25 groceries: more than one page of each.
  const kinds: Array<[string, string]> = [
    ['laptops', 'Laptop'],
    ['smartphones', 'Phone'],
    ['groceries', 'Apple'],
  ];
  kinds.forEach(([category, word], k) => {
    for (let i = 1; i <= 25; i++) {
      items.push({
        id: k * 100 + i,
        title: `${word} ${String(i).padStart(2, '0')}`,
        category,
        stock: (i * 7) % 60,
        price: i * 10,
        description: `${word} number ${i}`,
        thumbnail: '',
        images: [],
      });
    }
  });
  return items;
}

export const CATALOGUE = makeCatalogue();

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

function wait(ms: number, signal?: AbortSignal | null) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });
}

function listResponse(items: FakeProduct[], params: URLSearchParams) {
  const sortBy = params.get('sortBy') as keyof FakeProduct | null;
  const order = params.get('order');
  let sorted = [...items];
  if (sortBy) {
    sorted.sort((a, b) => {
      const av = a[sortBy] ?? '';
      const bv = b[sortBy] ?? '';
      return av < bv ? -1 : av > bv ? 1 : 0;
    });
    if (order === 'desc') sorted.reverse();
  }
  const limit = Number(params.get('limit') ?? 30);
  const skip = Number(params.get('skip') ?? 0);
  const total = sorted.length;
  if (limit > 0) sorted = sorted.slice(skip, skip + limit);
  return json({ products: sorted, total, skip, limit });
}

export function installFakeCatalogue(): FakeCatalogue {
  const api: FakeCatalogue = {
    requests: [],
    aborted: [],
    serverDown: false,
    categoriesDown: false,
    catalogueDown: false,
    delays: {},
  };

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, init: RequestInit = {}) => {
      let url = new URL(input);
      const signal = init.signal;
      const isProducts = url.pathname.startsWith('/products');

      // The app never adds `delay` itself; the test adds it to chosen searches.
      const q = url.searchParams.get('q');
      if (q !== null && api.delays[q] !== undefined) {
        url.searchParams.set('delay', String(api.delays[q]));
      }
      if (
        isProducts &&
        !url.pathname.startsWith('/products/categories') &&
        api.serverDown
      ) {
        url = new URL('https://dummyjson.com/http/500');
      }
      if (url.pathname === '/products/categories' && api.categoriesDown) {
        url = new URL('https://dummyjson.com/http/500');
      }
      if (
        url.pathname === '/products' &&
        url.searchParams.get('limit') === '0' &&
        api.catalogueDown
      ) {
        url = new URL('https://dummyjson.com/http/500');
      }

      const label = url.pathname + url.search;
      api.requests.push(label);

      const delay = Number(url.searchParams.get('delay') ?? 0);
      if (delay > 0) {
        try {
          await wait(delay, signal);
        } catch (err) {
          api.aborted.push(label);
          throw err;
        }
      }
      if (signal?.aborted) {
        api.aborted.push(label);
        throw new DOMException('Aborted', 'AbortError');
      }

      const path = url.pathname;
      const params = url.searchParams;
      if (path === '/http/500') {
        return json({ status: '500', message: 'Internal Server Error' }, 500);
      }
      if (path === '/auth/me') return json({ id: 1, username: 'emilys' });
      if (path === '/auth/login') {
        return json({
          id: 1,
          username: 'emilys',
          accessToken: 'token',
          refreshToken: 'refresh',
        });
      }
      if (path === '/products/categories') {
        return json(CATEGORIES.map((slug) => ({ slug, name: slug })));
      }
      if (path === '/products/search') {
        // DummyJSON's rule: trimmed, lower-cased, hyphens as spaces, and
        // matched against the title or the description.
        const term = (params.get('q') ?? '').trim().toLowerCase().split('-').join(' ');
        return listResponse(
          CATALOGUE.filter(
            (p) =>
              p.title.toLowerCase().includes(term) ||
              p.description.toLowerCase().includes(term),
          ),
          params,
        );
      }
      const category = path.match(/^\/products\/category\/(.+)$/);
      if (category) {
        return listResponse(
          CATALOGUE.filter((p) => p.category === category[1]),
          params,
        );
      }
      const item = path.match(/^\/products\/(\d+)$/);
      if (item) {
        const product = CATALOGUE.find((p) => p.id === Number(item[1]));
        if (init.method === 'PUT') {
          return json({ ...product, ...JSON.parse(String(init.body)) });
        }
        return product
          ? json(product)
          : json({ message: `Product with id '${item[1]}' not found` }, 404);
      }
      if (path === '/products') return listResponse(CATALOGUE, params);
      return json({ message: 'Not found' }, 404);
    }),
  );

  return api;
}
