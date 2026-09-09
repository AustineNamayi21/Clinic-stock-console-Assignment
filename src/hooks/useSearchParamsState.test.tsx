import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useSearchParamsState } from './useSearchParamsState';

function renderWithRouter(initialEntries: string[]) {
  return renderHook(() => useSearchParamsState(), {
    wrapper: ({ children }) => (
      <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
    ),
  });
}

describe('useSearchParamsState', () => {
  it('falls back to documented defaults for invalid or missing URL params', () => {
    const { result } = renderWithRouter(['/?sortBy=nonsense&order=sideways&page=-3']);

    expect(result.current.state).toEqual({
      q: '',
      category: '',
      sortBy: 'title',
      order: 'asc',
      page: 1,
    });
  });

  it('reads valid params from a shared or copied URL correctly', () => {
    const { result } = renderWithRouter([
      '/?q=bandage&category=wound-care&sortBy=stock&order=desc&page=3',
    ]);

    expect(result.current.state).toEqual({
      q: 'bandage',
      category: 'wound-care',
      sortBy: 'stock',
      order: 'desc',
      page: 3,
    });
  });

  it('resets page to 1 when committing a new search', () => {
    const { result } = renderWithRouter(['/?page=5']);

    act(() => result.current.setSearch('gauze'));

    expect(result.current.state.page).toBe(1);
    expect(result.current.state.q).toBe('gauze');
  });

  it('changing only the page does not reset other committed state', () => {
    const { result } = renderWithRouter(['/?q=gauze&category=wound-care']);

    act(() => result.current.setPage(4));

    expect(result.current.state).toMatchObject({
      q: 'gauze',
      category: 'wound-care',
      page: 4,
    });
  });
});
