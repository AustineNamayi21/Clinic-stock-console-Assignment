import { vi } from 'vitest';

/**
 * A minimal stand-in for the DummyJSON endpoints the auth flow touches.
 * Exactly one access token is valid at a time; refreshing rotates it.
 * Every request is recorded so tests can assert what was actually sent.
 */
export interface FakeApi {
  calls: Array<{ path: string; method: string; auth?: string }>;
  /** The access token the API currently accepts. */
  validToken: string;
  /** When false, /auth/refresh rejects (expired or revoked refresh token). */
  refreshAllowed: boolean;
  /** When true, every request fails as if the network dropped. */
  offline: boolean;
  /** Optional hook to delay or fail PUTs. */
  onPut?: () => Promise<Response>;
  /** Optional hook to delay GET /products/7. */
  onItem?: () => Promise<Response>;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

export const TEST_USER = { id: 1, username: 'emilys' };

/** The single item the fake /products list returns. */
export const LISTED_ITEM = {
  id: 7,
  title: 'Sterile gauze',
  description: '',
  category: 'wound-care',
  price: 4,
  stock: 42,
  thumbnail: '',
  images: [],
};

/** 25 wound-care matches and 5 from another category, for search + category. */
export const SEARCH_MATCHES = [
  ...Array.from({ length: 25 }, (_, i) => ({
    ...LISTED_ITEM,
    id: 100 + i,
    title: `Bandage ${i}`,
  })),
  ...Array.from({ length: 5 }, (_, i) => ({
    ...LISTED_ITEM,
    id: 200 + i,
    title: `Bandage scissors ${i}`,
    category: 'tools',
  })),
];

export function installFakeApi(initialValidToken: string): FakeApi {
  const api: FakeApi = {
    calls: [],
    validToken: initialValidToken,
    refreshAllowed: true,
    offline: false,
  };
  let rotation = 0;

  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const headers = (init.headers ?? {}) as Record<string, string>;
      const auth = headers.Authorization;
      const method = init.method ?? 'GET';
      const path = url.replace(/^https:\/\/dummyjson\.com/, '');
      api.calls.push({ path, method, auth });

      if (api.offline) throw new TypeError('Failed to fetch');

      if (path === '/auth/refresh') {
        if (!api.refreshAllowed) return json({ message: 'Invalid refresh token' }, 403);
        rotation += 1;
        api.validToken = `access-${rotation}`;
        return json({
          accessToken: api.validToken,
          refreshToken: `refresh-${rotation}`,
        });
      }

      if (auth !== `Bearer ${api.validToken}`) {
        return json({ message: 'Token Expired!' }, 401);
      }

      if (path === '/auth/me') return json(TEST_USER);
      if (method === 'PUT') {
        if (api.onPut) return api.onPut();
        return json({ id: 1, stock: JSON.parse(String(init.body)).stock });
      }
      if (path.startsWith('/products/search')) {
        return json({
          products: SEARCH_MATCHES,
          total: SEARCH_MATCHES.length,
          skip: 0,
          limit: 0,
        });
      }
      if (path.startsWith('/products?')) {
        return json({ products: [LISTED_ITEM], total: 1, skip: 0, limit: 20 });
      }
      if (path === '/products/7') {
        if (api.onItem) return api.onItem();
        return json(LISTED_ITEM);
      }
      if (path.startsWith('/products/1')) {
        return json({ id: 1, title: 'Gauze', category: 'x', stock: 3 });
      }
      return json({ message: 'Not found' }, 404);
    }),
  );

  return api;
}

export function seedSession(accessToken: string, refreshToken = 'refresh-0') {
  sessionStorage.setItem('csc:accessToken', accessToken);
  sessionStorage.setItem('csc:refreshToken', refreshToken);
  sessionStorage.setItem('csc:user', JSON.stringify(TEST_USER));
}
