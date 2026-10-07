/**
 * Whole-app acceptance tests for the five behaviours the assessment brief
 * requires. Each renders the real App (routes, guard, pages, hooks, API
 * client) against a fake DummyJSON that honours the `delay` parameter and
 * the `/http/500` endpoint the same way the real API does.
 */
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './auth/AuthContext';
import { App } from './App';
import { shouldRetryQuery } from './api/retry';
import { installFakeCatalogue, type FakeCatalogue } from './test/fakeCatalogue';

let currentUrl = '';

/** Records the router's current URL so tests can assert on it. */
function LocationProbe() {
  const location = useLocation();
  useEffect(() => {
    currentUrl = location.pathname + location.search;
  }, [location]);
  return null;
}

function signIn() {
  sessionStorage.setItem('csc:accessToken', 'token');
  sessionStorage.setItem('csc:refreshToken', 'refresh');
  sessionStorage.setItem('csc:user', JSON.stringify({ id: 1, username: 'emilys' }));
}

function renderApp(url: string) {
  const queryClient = new QueryClient({
    // The app's own retry policy, with no wait between attempts.
    defaultOptions: { queries: { retry: shouldRetryQuery, retryDelay: 0 } },
  });
  return render(
    <MemoryRouter initialEntries={[url]}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <App />
          <LocationProbe />
        </AuthProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

/** The visible item titles in the stock table, in order. */
function visibleTitles(): string[] {
  const table = document.querySelector('table');
  if (!table) return [];
  return within(table)
    .queryAllByRole('link')
    .map((a) => a.textContent ?? '');
}

function param(name: string) {
  return new URLSearchParams(currentUrl.split('?')[1] ?? '').get(name);
}

let api: FakeCatalogue;

beforeEach(() => {
  sessionStorage.clear();
  api = installFakeCatalogue();
});

afterEach(() => vi.unstubAllGlobals());

describe('1. Search never shows results for a replaced query', () => {
  // These two run with the background catalogue download failing, so every
  // search goes over the network: the slow-connection case the brief means.
  it('ignores a slow response for an earlier term, even when it arrives last', async () => {
    const user = userEvent.setup();
    signIn();
    api.catalogueDown = true;
    // DummyJSON's delay parameter on the first term: its response takes
    // 800ms, while the replacement term answers immediately.
    api.delays = { laptop: 800 };
    renderApp('/');
    await screen.findByText(/Showing 1–20 of 75 items/);

    const search = screen.getByRole('searchbox', { name: 'Search stock by name' });
    await user.type(search, 'laptop');
    // Let the debounce commit "laptop" so its slow request is in flight.
    await waitFor(() => expect(param('q')).toBe('laptop'));

    // Watch the table on every DOM change from here on: once the user has
    // replaced the term, no Laptop row may ever be shown.
    let staleRowsSeen = false;
    const observer = new MutationObserver(() => {
      if (
        param('q') === 'phone' &&
        visibleTitles().some((t) => t.startsWith('Laptop'))
      ) {
        staleRowsSeen = true;
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    await user.clear(search);
    await user.type(search, 'phone');
    await waitFor(() => expect(visibleTitles()[0]).toBe('Phone 01'));

    // Wait past the moment the slow "laptop" response would have landed.
    await act(() => new Promise((r) => setTimeout(r, 1000)));
    observer.disconnect();

    expect(staleRowsSeen).toBe(false);
    expect(visibleTitles().every((t) => t.startsWith('Phone'))).toBe(true);
    // The superseded request was cancelled, not just ignored.
    expect(api.aborted.some((r) => r.includes('q=laptop'))).toBe(true);
  });

  it('does not show the previous term’s results while the new term loads', async () => {
    const user = userEvent.setup();
    signIn();
    api.catalogueDown = true;
    api.delays = { phone: 600 };
    renderApp('/?q=laptop');
    await waitFor(() => expect(visibleTitles()[0]).toBe('Laptop 01'));

    const search = screen.getByRole('searchbox', { name: 'Search stock by name' });
    await user.clear(search);
    await user.type(search, 'phone');
    await waitFor(() => expect(param('q')).toBe('phone'));

    // The slow "phone" request is in flight: the Laptop results are gone
    // and the loading state is shown instead.
    expect(visibleTitles()).toEqual([]);
    expect(screen.getByText('Loading stock…')).toBeInTheDocument();
    await waitFor(() => expect(visibleTitles()[0]).toBe('Phone 01'));
  });
});

describe('Searching once the catalogue is in the browser', () => {
  it('answers searches instantly with no request, matching the server', async () => {
    const user = userEvent.setup();
    signIn();
    renderApp('/');
    await screen.findByText(/Showing 1–20 of 75 items/);
    // Wait for the background catalogue download.
    await waitFor(() =>
      expect(api.requests.some((r) => r.startsWith('/products?limit=0'))).toBe(true),
    );
    await act(() => new Promise((r) => setTimeout(r, 50)));
    const before = api.requests.length;

    const search = screen.getByRole('searchbox', { name: 'Search stock by name' });
    await user.type(search, 'phone');
    await waitFor(() => expect(param('q')).toBe('phone'));

    // Results are on screen as soon as the term commits - no loading state.
    expect(screen.queryByText('Loading stock…')).not.toBeInTheDocument();
    expect(visibleTitles()[0]).toBe('Phone 01');
    expect(screen.getByText(/Showing 1–20 of 25 items/)).toBeInTheDocument();
    expect(api.requests.slice(before).some((r) => r.includes('/search'))).toBe(false);

    // Matches the server's rule: "number 7" only appears in descriptions.
    await user.clear(search);
    await user.type(search, 'number 7');
    await waitFor(() => expect(param('q')).toBe('number 7'));
    expect(visibleTitles()).toEqual(['Apple 07', 'Laptop 07', 'Phone 07']);
  });
});

describe('2. Changing the category or sort never strands the user on an empty page', () => {
  it('returns to page 1 with results when the category changes on a later page', async () => {
    const user = userEvent.setup();
    signIn();
    renderApp('/?page=4');
    await screen.findByText(/Showing 61–75 of 75 items/);

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Filter by category' }),
      'smartphones',
    );

    await waitFor(() => expect(visibleTitles()[0]).toBe('Phone 01'));
    expect(param('page')).toBe('1');
    expect(screen.getByText(/Showing 1–20 of 25 items/)).toBeInTheDocument();
  });

  it('returns to page 1 with results when the sort order changes on a later page', async () => {
    const user = userEvent.setup();
    signIn();
    renderApp('/?category=groceries&page=2');
    await screen.findByText(/Showing 21–25 of 25 items/);

    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort stock' }), [
      'Highest stock',
    ]);

    await waitFor(() => expect(param('page')).toBe('1'));
    await waitFor(() => expect(visibleTitles()).toHaveLength(20));
  });

  it('moves a link to a page past the end onto the last page that has results', async () => {
    signIn();
    renderApp('/?category=laptops&page=9');

    await waitFor(() => expect(param('page')).toBe('2'));
    await waitFor(() => expect(visibleTitles()).toHaveLength(5));
    expect(screen.queryByText(/No items/)).not.toBeInTheDocument();
  });
});

describe('3. Reloading or opening a copied URL restores the same view', () => {
  const url = '/?q=apple&category=groceries&sortBy=stock&order=desc&page=2';

  it('restores search, filter, sort and page from the URL', async () => {
    signIn();
    renderApp(url);

    await screen.findByText(/Showing 21–25 of 25 items/);
    expect(screen.getByRole('searchbox', { name: 'Search stock by name' })).toHaveValue(
      'apple',
    );
    expect(screen.getByRole('combobox', { name: 'Filter by category' })).toHaveValue(
      'groceries',
    );
    expect(screen.getByRole('combobox', { name: 'Sort stock' })).toHaveValue(
      'stock-desc',
    );
    expect(screen.getByText(/Page/).textContent).toMatch(/Page 2 of 2/);
    expect(visibleTitles().every((t) => t.startsWith('Apple'))).toBe(true);
  });

  it('brings someone opening the link signed out back to the same view after signing in', async () => {
    const user = userEvent.setup();
    renderApp(url);

    await screen.findByRole('heading', { name: 'Sign in' });
    await user.type(screen.getByLabelText('Username'), 'emilys');
    await user.type(screen.getByLabelText('Password'), 'emilyspass');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await screen.findByText(/Showing 21–25 of 25 items/);
    expect(currentUrl).toBe(url);
  });
});

describe('3b. Opening an item and coming back keeps the list view', () => {
  it('returns from an item to the same search, filter, sort and page', async () => {
    const user = userEvent.setup();
    signIn();
    const listUrl = '/?q=e&category=smartphones&sortBy=stock&order=desc&page=1';
    renderApp(listUrl);
    await waitFor(() => expect(visibleTitles().length).toBeGreaterThan(0));

    await user.click(within(document.querySelector('table')!).getAllByRole('link')[0]);
    await screen.findByRole('button', { name: 'Save count' });
    await user.click(screen.getByRole('link', { name: 'Stock list' }));

    await waitFor(() => expect(currentUrl).toBe(listUrl));
    expect(screen.getByRole('combobox', { name: 'Sort stock' })).toHaveValue(
      'stock-desc',
    );
  });
});

describe('4. Loading, empty and error states, with recovery from /http/500', () => {
  it('stock list: loading, then an error with a working Try again', async () => {
    const user = userEvent.setup();
    signIn();
    api.serverDown = true;
    renderApp('/');

    expect(await screen.findByText('Loading stock…')).toBeInTheDocument();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('returned an error (500)');
    expect(api.requests.filter((r) => r === '/http/500').length).toBeGreaterThan(0);

    api.serverDown = false;
    await user.click(within(alert).getByRole('button', { name: 'Try again' }));
    await screen.findByText(/Showing 1–20 of 75 items/);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('stock list: an empty result offers a way back', async () => {
    const user = userEvent.setup();
    signIn();
    renderApp('/?q=zzzz');

    await screen.findByText('No items match "zzzz"');
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    await screen.findByText(/Showing 1–20 of 75 items/);
  });

  it('item page: loading, then an error with a working Try again', async () => {
    const user = userEvent.setup();
    signIn();
    api.serverDown = true;
    renderApp('/items/101');

    expect(await screen.findByText('Loading item…')).toBeInTheDocument();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('returned an error (500)');

    api.serverDown = false;
    await user.click(within(alert).getByRole('button', { name: 'Try again' }));
    await screen.findByRole('heading', { name: 'Phone 01' });
  });

  it('item page: a missing item says so and links back to the list', async () => {
    signIn();
    renderApp('/items/9999');

    await screen.findByText('Item not found');
    expect(screen.getByRole('link', { name: 'Stock list' })).toHaveAttribute(
      'href',
      '/',
    );
  });

  it('category list: an error offers a reload without blocking the stock list', async () => {
    const user = userEvent.setup();
    signIn();
    api.categoriesDown = true;
    renderApp('/');

    const reload = await screen.findByRole('button', { name: 'Reload categories' });
    expect(screen.getByText(/Showing 1–20 of 75 items/)).toBeInTheDocument();

    api.categoriesDown = false;
    await user.click(reload);
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Reload categories' })).toBeNull(),
    );
    expect(screen.getByRole('option', { name: 'Smartphones' })).toBeInTheDocument();
  });
});

describe('5. The whole app works from the keyboard alone', () => {
  it('offers a skip link as the first stop on a freshly loaded page', async () => {
    const user = userEvent.setup();
    signIn();
    renderApp('/');
    await screen.findByText(/Showing 1–20 of 75 items/);
    (document.activeElement as HTMLElement | null)?.blur();

    await user.tab();
    const skip = screen.getByRole('link', { name: 'Skip to content' });
    expect(skip).toHaveFocus();
    expect(skip).toHaveAttribute('href', '#main-content');
  });

  it('signs in, searches, filters, sorts, pages, opens an item and saves a count', async () => {
    const user = userEvent.setup();
    renderApp('/');

    // Sign in
    await screen.findByRole('heading', { name: 'Sign in' });
    await user.tab();
    expect(screen.getByLabelText('Username')).toHaveFocus();
    await user.keyboard('emilys');
    await user.tab();
    expect(screen.getByLabelText('Password')).toHaveFocus();
    await user.keyboard('emilyspass{Enter}');
    await screen.findByText(/Showing 1–20 of 75 items/);

    // After signing in, focus moves to the start of the page content, so
    // the next Tab goes straight to the search box.
    expect(document.getElementById('main-content')).toHaveFocus();

    // Search
    await user.tab();
    expect(
      screen.getByRole('searchbox', { name: 'Search stock by name' }),
    ).toHaveFocus();
    await user.keyboard('phone');
    await waitFor(() => expect(visibleTitles()[0]).toBe('Phone 01'));

    // Category and sort are native selects: keyboard selection works.
    await user.tab();
    expect(screen.getByRole('combobox', { name: 'Filter by category' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('combobox', { name: 'Sort stock' })).toHaveFocus();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort stock' }), [
      'Name Z–A',
    ]);
    await waitFor(() => expect(visibleTitles()[0]).toBe('Phone 25'));

    // Paging. Page 2 is the last page, so Next becomes disabled and focus
    // moves to Previous rather than staying on a dead button.
    const next = screen.getByRole('button', { name: 'Next' });
    next.focus();
    await user.keyboard('{Enter}');
    await waitFor(() => expect(param('page')).toBe('2'));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Previous' })).toHaveFocus(),
    );

    // Open an item from the list
    await waitFor(() => expect(visibleTitles()).toHaveLength(5));
    const firstLink = within(document.querySelector('table')!).getAllByRole('link')[0];
    firstLink.focus();
    await user.keyboard('{Enter}');
    await screen.findByRole('heading', { name: 'Phone 05' });

    // Correct the count with the + button and save, all from the keyboard
    const plus = screen.getByRole('button', { name: 'Increase count by 1' });
    plus.focus();
    await user.keyboard('{Enter}');
    await user.tab();
    expect(screen.getByRole('button', { name: 'Save count' })).toHaveFocus();
    await user.keyboard('{Enter}');
    await screen.findByText(/Count saved/);
  });
});
