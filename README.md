# Clinic Stock Console

**Candidate:** Austine Namayi

This project is my submission for the Savannah Informatics Web Engineer Take-Home Assessment.

I built an internal clinic stock console that allows a staff member to sign in, view stock items, search and filter them, sort the results, move between pages, open an individual item, and correct its stock quantity.

**Live application:** https://clinic-stock-console-assignment.vercel.app

**GitHub repository:** https://github.com/AustineNamayi21/Clinic-stock-console-Assignment.git

## Running locally

Requires Node 20 or later (CI uses Node 22).

```bash
npm install
npm run dev
```

The app runs at `http://localhost:5173`. Sign in with any DummyJSON user, for example `emilys` / `emilyspass`.

| Script                 | What it does                           |
| ---------------------- | -------------------------------------- |
| `npm run dev`          | Vite dev server                        |
| `npm run build`        | Type-check, then production build      |
| `npm run preview`      | Serve the production build locally     |
| `npm run lint`         | ESLint                                 |
| `npm run format`       | Prettier, writing changes              |
| `npm run format:check` | Prettier, failing on unformatted files |
| `npm test`             | Vitest, single run                     |
| `npm run test:watch`   | Vitest in watch mode                   |

---

# 1. Project overview

The application is a React and TypeScript frontend using DummyJSON as the API.

The main user flow is:

1. Sign in.
2. View the stock list.
3. Search for an item.
4. Filter by category.
5. Sort the results.
6. Move between pages.
7. Open an individual item.
8. Correct the stock quantity.
9. Continue using the application without losing the current URL state.

I kept the scope close to the requirements of the assessment instead of adding unrelated inventory-management features.

---

# 2. Technology stack

I used:

- React 19
- TypeScript 6
- Vite 8
- React Router 7
- TanStack Query 5
- Tailwind CSS 4
- Manrope (self-hosted variable font via Fontsource)
- Vitest 5
- ESLint 10
- Prettier 3
- Husky 9
- lint-staged
- commitlint
- GitHub Actions
- Vercel
- DummyJSON API

I used React and TypeScript for the application itself, React Router for navigation, and TanStack Query for server-state fetching, caching and invalidation.

---

# 3. Design and component structure

I split the application into pages, reusable components, API functions, hooks and supporting utilities.

The main pages are:

- `LoginPage`
- `StockListPage`
- `ItemDetailPage`

The main reusable UI components are:

- `AppShell` — the persistent layout for signed-in pages: header, sign-out, skip link, activity line and the `<main>` focus target
- `StockTable` — table on wider screens, stacked cards on narrow ones, plus `StockTableSkeleton` for the first load
- `CategoryFilter`, `SortControl` and `Pagination` (in `StockControls.tsx`)
- `SearchBox`
- `StockCorrectionForm`
- `StockFigure` and `StockVial` (in `StockBadge.tsx`)
- Small inline icons (in `Icons.tsx`), all decorative and hidden from screen readers
- `LoadingState`, `EmptyState` and `ErrorState` (in `DataState.tsx`)

I also have an `AuthGuard` route component that protects the authenticated application routes. The signed-in pages are nested routes under one layout route (`AuthGuard` + `AppShell` + `<Outlet />`), so the header stays mounted while the user moves between the list and an item instead of being rebuilt on every navigation.

`StockFigure` is the exported component in `StockBadge.tsx`. The component was originally named around the stock-badge idea, but the exported component is now `StockFigure`.

The stock list is presented as a table on larger screens. At the small-screen breakpoint it changes to stacked cards instead of trying to squeeze all of the table columns into a narrow viewport.

Each item's stock level is shown with a status word as well as a colour: a count of 0 is **Out of stock**, 1–10 is **Low**, and anything above that is **In stock**. The thresholds live in `src/lib/stockLevel.ts`, separate from the component, so they can be reused and tested without React.

---

# 4. State management

I separated state according to where it needs to live.

## URL state

I keep these values in the URL:

- Search query
- Category
- Sort option
- Page number

This is handled by `useSearchParamsState`.

I chose this because these values describe the current stock-list view. Keeping them in the URL means that refreshing the page or copying the URL does not lose the current search, filter, sort or page.

I also reset the page when a search or filter changes. For example, if I am on page 8 and then apply a filter that only has two pages, the application should not leave me looking at an empty page 8.

URL values are validated when they are read, because a shared link can contain anything:

- An unrecognised `sortBy` or `order` falls back to the default (name, A–Z).
- A page that isn't a positive whole number falls back to page 1.
- A valid page that is past the end of the results — for example from an old shared link — is moved to the last page once the real total is known.

Typing a search replaces the current history entry instead of adding one, so the Back button isn't filled with every search term. Changing the category, sort or page does add an entry, so Back returns to the previous view.

## Server state

I use TanStack Query for:

- Stock-list data
- Individual stock items
- Categories

This gives me query caching, loading and error state, and query invalidation without having to build those mechanisms manually.

## Local component state

Short-lived UI state stays inside the component that needs it.

For example, `SearchBox` keeps the current input value locally before committing it to the URL. The stock correction form similarly keeps its current input locally.

## Authentication state

Authentication is handled by `AuthContext`.

The access token, refresh token and user information are stored in `sessionStorage`. This allows the session to survive a browser refresh without making the authentication state permanent across browser sessions.

This is a trade-off rather than an ideal. Anything in `sessionStorage` can be read by a script running on the page, so it is not protected against XSS. I chose it over `localStorage` because it is cleared when the tab closes, and over memory-only storage because ward staff refresh and background tablets constantly, and being signed out on every refresh would be worse for them. DummyJSON returns the refresh token in the response body, so a properly protected option isn't available here. With a real backend, the refresh token would be an `httpOnly`, `SameSite` cookie and the frontend would not hold it at all.

Signing out clears the tokens, the stored user and any stock corrections made in that session.

---

# 5. API design and fetching

I keep the API implementation under `src/api/`.

The main functions in `src/api/products.ts` are:

- `fetchStockList`
- `fetchProduct`
- `fetchCategories`
- `updateStock`

The HTTP client itself is in `src/api/client.ts`.

The React Query integration is in `src/hooks/useStock.ts`.

The stock list uses a page size of 20. DummyJSON provides 194 products, so the normal list is paginated rather than loading all products into the interface at once.

Query keys are built from the exact URL values that produce each response, so going back to a search, filter, sort or page I have already seen is an instant cache hit. Caching is tuned per kind of data:

- **Stock list and item detail:** treated as fresh for 30 seconds. Stock counts can change after a physical count at any time, so I would rather refetch slightly too often than show a stale count.
- **Categories:** treated as fresh for 10 minutes, because they rarely change and refetching them on every visit would waste requests on a patchy connection.
- **Failed list, item and category requests:** network and server failures are retried once automatically before an error state is shown. Requests the server rejected (4xx, such as an item that doesn't exist) are not retried, because the answer won't change; that policy is `src/api/retry.ts`. Saves are never retried automatically, so a correction is never sent twice without the user knowing.

## Performance on a slow connection

Several choices reduce how often the user waits, and how much is downloaded:

- **The current page stays on screen while the next page or sort loads.** Paging or re-sorting keeps the previous results visible (dimmed) until the new ones arrive, instead of flashing to a loading state. A new search term or category deliberately does _not_ do this: results for a query the user has replaced must never be shown, so those show the loading state until the right results arrive (see the acceptance checks below). The first load shows skeleton rows shaped like the table.
- **Items open instantly from the list.** The list already downloads every field the item page shows, so opening an item renders straight away from that data while a fresh copy loads in the background.
- **The next page is fetched in advance.** Once a page has loaded, the following page is fetched when the browser is idle, so **Next** is usually instant.
- **Search plus category downloads the match set once.** In that combined mode, the full result set for a search term is cached on its own, so changing the page, sort or category within the same search is worked out locally rather than downloaded again.
- **Corrections show everywhere immediately.** Pages subscribe to the correction store, so a saved count appears in the list as soon as it is made, without waiting for a refetch.
- **The font is self-hosted.** Manrope is bundled with the app and split by character set, so only the Latin file (about 25 KB) is downloaded, with no request to an external font service. The browser also opens its connection to DummyJSON while the app is still loading.

---

# 6. What I found when testing DummyJSON

I tested the actual API behaviour rather than assuming that all combinations of query parameters would work together.

One specific issue I found was with the search endpoint.

When I sent a search request with a category parameter, DummyJSON returned 23 results across mixed categories. This was effectively the same result count as the corresponding search without the category filter, so the category parameter could not be relied on to perform the combined filtering required by the application.

Because of this, when both a search term and category are active, I retrieve the search result set and apply the category filter on the client.

I also tested `limit=0`. I use this in the combined search/category case so that I can work with the complete matching result set before applying the remaining client-side operations.

I use the `select` parameter where appropriate to request only the product fields needed by the stock interface instead of returning unnecessary fields.

These findings affected the implementation directly.

---

# 7. Search, filtering, sorting and pagination

For normal requests, I use the API's pagination, search and category functionality.

When both a search term and category are active, I:

1. Retrieve the relevant search results.
2. Apply the category filter.
3. Apply the selected sort.
4. Paginate the resulting collection on the client.

This is necessary because the API does not provide the exact combined query behaviour required by the interface.

This combined path loads every search match, which is fine for a 194-item catalogue but would not scale to a real one. With a real backend, the server would apply the search and category together and paginate the result.

The current search input is debounced by 300ms. This means I do not send a request for every individual keystroke.

The URL remains the source of truth for the committed search value, so the current search state is also preserved when the page is refreshed or the URL is copied.

---

# 8. Slow-search and race-condition handling

I tested the slow-search case using DummyJSON's delayed response option:

```text
/products/search?q=...&delay=2000
```

This represents the situation where an older search request takes longer to return than a newer request.

The search input is debounced, and the resulting query state is managed through TanStack Query. Different search terms produce different query keys, so an older response is not treated as the current search simply because it happens to return later.

The older request is also cancelled, not just ignored. Each query passes TanStack Query's `AbortSignal` through to `fetch`, so when a newer search replaces an older one, the older request is aborted rather than left to finish in the background.

I specifically checked this behaviour because the assessment calls out the delayed-search case as something that can expose race conditions.

Two further rules make sure the user never looks at results for a term they have already replaced:

- When the search term (or category) changes, the previous results are removed and the loading state is shown until the new results arrive. Only paging and re-sorting keep the previous page visible while loading.
- While the search box holds text that hasn't been committed yet (the 300ms debounce), the list below is dimmed and marked busy, so it isn't presented as results for what is being typed.

The full verification against the real API is in the acceptance checks section below.

---

# 9. Authentication and token expiry

The login request uses:

```text
expiresInMins: 1
```

The work is split across two files:

- `src/api/client.ts` catches a `401`, asks for a refresh and retries the original request once.
- `src/auth/AuthContext.tsx` makes the refresh request, stores the new tokens and owns the shared refresh promise.

I use a shared refresh promise so that if multiple requests receive a `401` at approximately the same time, they can share the same refresh operation instead of all starting separate refresh requests.

The retry uses the token that the refresh returned. The client reads the current token at request time rather than capturing it when the client is created, because a refresh can complete while a request is still in flight.

If DummyJSON rejects the refresh, the authentication state is cleared and `AuthGuard` returns the user to the login page with a `returnTo` parameter, so they land back on the same URL after signing in again. If the refresh fails because the network dropped, the session is kept and the request fails as a connection error with a retry button, so losing signal on a ward does not sign anyone out.

The same logic applies when the page is reloaded. Access tokens only last a minute, so on reload the stored token has usually expired. The app refreshes it before deciding the session is over, instead of treating an expired access token as a signed-out user.

The intention here was to prevent token expiry from producing a blank application or unnecessarily losing the user's current URL state.

The `returnTo` value is only honoured if it is a path inside the app (it must start with `/` and not `//`). Without that check, a crafted link could send someone to another site straight after they sign in.

---

# 10. Stock correction

Stock correction is handled on the individual item page.

The form validates the entered quantity before submitting the change: it must be a whole number of 0 or more. The validation message is linked to the input with `aria-describedby`, and **Save count** is disabled while the number is unchanged or a save is in progress.

Large **−** and **+** buttons either side of the count make small corrections easy on a tablet without opening the keyboard. If the item is refetched in the background while someone is typing, the form does not overwrite the number they are entering. When a save succeeds, a tick draws itself next to the confirmation and the new count settles into place at the top of the page.

When the mutation starts, the displayed item is updated optimistically and the correction is written to the session override store straight away. If the request fails, both the displayed value and the previous override are restored.

After the mutation settles, the relevant item and stock-list queries are invalidated.

There is an important DummyJSON limitation here.

The `PUT` request returns a successful response, but the updated stock value is **not persistently stored by DummyJSON**. I verified this by updating a product and then requesting it again.

Because of that, I added `src/lib/stockOverrides.ts` to keep successful stock corrections available during the current session.

This is a frontend workaround for the limitations of the assessment API. In a production application, I would replace this with a persistent backend and database.

One known limitation follows from this: sorting by stock is done by DummyJSON using its original values, so a corrected item can appear out of order in a list sorted by stock. A real backend that stored the correction would sort it correctly.

---

# 11. Error, loading and empty states

I created reusable states in `DataState.tsx`.

These include:

- Loading state, and skeleton placeholders shaped like the table and the item page
- Empty state
- Error state with retry, signalled by an icon and text as well as colour

The stock list and item detail screens use these states for their main API requests. If counts are already on screen and only a background refresh fails, the list stays visible with a short notice and a **Try again** button above it, instead of being replaced by an error.

The category control is disabled while categories are loading.

The item detail page also handles an invalid or unavailable item rather than assuming that a valid product will always be returned. A malformed link such as `/items/abc` shows an "Invalid item link" message. An ID that doesn't exist, such as `/items/99999`, shows "Item not found" without a retry button, because retrying cannot help.

Unknown routes show a "Page not found" message instead of a blank screen.

---

# 12. Accessibility and responsive behaviour

I considered keyboard use as part of the implementation rather than treating accessibility as a visual-only requirement.

The application includes:

- Semantic buttons and form controls
- Labels for inputs
- Native select controls
- Keyboard-accessible actions
- Visible focus states
- A skip link
- Status messages using appropriate ARIA roles
- An alert state for request errors
- A predictable main-content focus target during route navigation
- A screen-reader announcement while a search is pending ("Searching for …")
- A live region on the pagination summary, so the new page number is announced
- Validation errors linked to their input with `aria-describedby` and `aria-invalid`
- Stock status shown as a word as well as a colour, never colour alone
- Animations reduced to near zero when the operating system asks for reduced motion
- Touch targets of at least 44px: inputs, selects and pagination buttons are 48px tall, and the count buttons are 56px

`AppShell` contains the skip link and the main content target.

The `<main>` element uses `focus:outline-none` because it is being used as a programmatic focus target after route changes rather than as an interactive control. The visible focus treatment is intended for controls that the user can actually interact with. The global focus style is defined in Tailwind's base layer so that this utility can override it; when it sat outside the layers, it overrode the utility and drew a focus box around the whole page after a direct page load.

I also designed the stock list to work at narrow widths. At smaller breakpoints, the table changes to a stacked layout so that the interface remains usable around the 360px requirement.

---

# 13. Visual design

The interface is built for ward staff glancing at a tablet, so the stock count is always the most prominent thing on screen. The palette is black, white and blue-green:

- **Black** for the header and the sign-in panel, so the app's frame is unmistakable.
- **White** surfaces on a very light cool-grey page, so content cards stand out.
- **Lagoon** (`#00707a`), a blue-green, for every action: buttons, links, focus rings and category tags.
- **A blue-to-green gradient**, used in only two places: the stock vial and the activity line under the header.
- **Amber, red and green** only for stock and save status.

These are named colours in `src/index.css` (`ink`, `slate`, `paper`, `surface`, `line`, `lagoon`, `aqua` and the status colours), each with one job, rather than Tailwind's numbered scale. Every text colour meets the WCAG AA contrast ratio of 4.5:1 against the backgrounds it is used on; the lowest is the status green on the page background at 4.9:1.

The typeface is **Manrope**, a geometric sans-serif that stays legible at small sizes and has tabular figures. Stock counts use those tabular figures, so digits keep the same width and a number doesn't shift when a count changes.

## The stock vial

Next to each count is a small vial filled to that count (capped at 100), with a tick marking the "low" threshold. It is blue-green when stock is fine, amber when low, and an empty dashed red outline when out of stock. It is decorative and hidden from screen readers, because the number and status word already carry the information; it makes low and empty items easy to spot when scanning a list.

## Motion

Every animation answers something that happened, and only `transform` and `opacity` are animated so they stay smooth on low-powered tablets:

- The line under the header flows while any request is in flight, so loading is visible from every screen without a spinner taking over the content.
- Vials fill when a page of results first appears, and rows arrive in a quick stagger, only when the set of items changes, not on every background refresh.
- A corrected count settles into place, and the save confirmation draws a tick.
- Buttons respond to a press, and skeleton placeholders shimmer while the first load is in progress.
- The sign-in panel has two soft blue-green lights drifting slowly behind the heading: the app's one purely ambient animation.

All of it is switched off when the operating system asks for reduced motion.

## Layout

The list is a table from tablet width up and stacked cards below it, with the search box full width and the category and sort controls side by side on a phone. Each table row is one large link target, while still having only one focusable element per item. The item page puts the count beside the title, with the image and details on one side and the correction form on the other, collapsing to a single column on a phone. I checked every screen at 360px wide and on desktop in a browser, including keyboard focus.

---

# 14. Project structure

The relevant project structure is:

```text
src/
├── api/
│   ├── client.test.ts
│   ├── client.ts
│   ├── config.ts
│   ├── errors.ts
│   ├── products.test.ts
│   ├── products.ts
│   ├── retry.ts
│   └── types.ts
├── auth/
│   ├── AuthContext.test.tsx
│   └── AuthContext.tsx
├── components/
│   ├── AppShell.tsx
│   ├── DataState.tsx
│   ├── Icons.tsx
│   ├── SearchBox.tsx
│   ├── StockBadge.tsx
│   ├── StockControls.tsx
│   ├── StockCorrectionForm.tsx
│   └── StockTable.tsx
├── hooks/
│   ├── useApiClient.ts
│   ├── useSearchParamsState.test.tsx
│   ├── useSearchParamsState.ts
│   ├── useStock.test.tsx
│   ├── useStock.ts
│   └── useStockPerformance.test.tsx
├── lib/
│   ├── stockLevel.ts
│   ├── stockOverrides.test.ts
│   └── stockOverrides.ts
├── pages/
│   ├── ItemDetailPage.tsx
│   ├── LoginPage.tsx
│   └── StockListPage.tsx
├── routes/
│   └── AuthGuard.tsx
├── test/
│   ├── fakeApi.ts
│   ├── fakeCatalogue.ts
│   └── setup.ts
├── App.acceptance.test.tsx
├── App.tsx
├── index.css
└── main.tsx
```

The main project configuration files are:

```text
.editorconfig
.gitattributes
.husky/ (pre-commit and commit-msg hooks)
.prettierrc.json
.prettierignore
commitlint.config.js
eslint.config.js
package.json
tsconfig.json, tsconfig.app.json, tsconfig.node.json
vercel.json
vite.config.ts
```

The GitHub Actions workflow is:

```text
.github/workflows/ci.yml
```

---

# 15. Deep linking

Individual items are available through:

```text
/items/:id
```

This means an item can be opened directly using its URL rather than requiring navigation from the stock list. If someone opens a shared link while signed out, they are sent to the login page and then taken back to that item after signing in.

I also added the Vercel SPA rewrite configuration so that client-side routes can be loaded directly without Vercel treating them as missing server-side files.

---

# 16. Testing

I used Vitest for the automated tests.

I focused the tests on areas where a small change could easily introduce a behavioural regression.

## Acceptance tests

`src/App.acceptance.test.tsx` renders the whole app (routes, guard, pages, hooks and API client) against `src/test/fakeCatalogue.ts`, a fake DummyJSON that honours the `delay` parameter (including cancellation) and answers `/http/500` with a 500, the way the real API does. It has one group of tests for each of the five acceptance checks below, and the search test fails if the previous term's results are ever shown while a new term loads.

## API tests

`src/api/products.test.ts` covers the product-listing behaviour, including the combined search/category handling and the normal unfiltered request.

## URL-state tests

`src/hooks/useSearchParamsState.test.tsx` covers:

- Default URL values
- Reading state from a copied URL
- Resetting the page when a filter changes
- Keeping the active filters while changing pages
- "Clear filters" removing the search and category in a single URL update

## Stock override tests

`src/lib/stockOverrides.test.ts` checks that stock overrides are returned correctly and remain available on repeated reads.

## Token refresh tests

`src/api/client.test.ts` covers the 401 path in the HTTP client:

- The retry after a refresh sends the token the refresh returned, not the expired one
- A 401 for a token that another request has already replaced is retried without a second refresh
- A rejected refresh is reported as "Session expired"
- A network failure during refresh is reported as a network error, not a sign-out

## Session tests

`src/auth/AuthContext.test.tsx` runs the auth context against a small fake DummyJSON (`src/test/fakeApi.ts`) that only accepts the current access token. It covers:

- Reloading with an expired access token refreshes the session instead of signing out
- A rejected refresh token ends the session
- A network failure on reload keeps the stored session
- Concurrent refresh calls share one `/auth/refresh` request

## Stock correction tests

`src/hooks/useStock.test.tsx` covers:

- Saving a correction after the access token has expired mid-session
- A second correction of the same item showing immediately while it saves
- A failed save restoring the previous corrected value

## Performance tests

`src/hooks/useStockPerformance.test.tsx` covers:

- An item opened from the list rendering immediately from list data, before its own request returns
- Paging and re-sorting within a search + category downloading the search match set only once
- The current page staying on screen while the next one loads
- The retry policy: network and server failures are retried once, rejected requests (such as a missing item) are not

I chose these areas because they contain actual application logic rather than simply checking whether a component renders.

---

# 17. Formatting, linting and commits

I use Prettier for formatting.

The formatting check is:

```powershell
npm run format:check
```

ESLint uses the recommended configurations for JavaScript, TypeScript, React Hooks and React Refresh used by the project, with two adjustments: `no-explicit-any` is a warning rather than an error, so an explicit `any` stays visible in review without blocking a PR, and unused variables and arguments prefixed with `_` are allowed, which is the usual way to mark a deliberately unused callback argument.

There is also a local ESLint exception in `AuthContext.tsx` for the React Refresh rule, with an explanatory comment.

I use Husky and lint-staged for pre-commit checks. lint-staged runs ESLint and Prettier on staged TypeScript files, and Prettier on staged JSON, Markdown, CSS and YAML files, so the CI workflow file is formatted before it is committed.

The commit message hook runs commitlint and checks Conventional Commit-style messages.

Examples from this repository's history:

```text
feat: add products API with search and category handling
test: add tests for list fetching, URL state and stock overrides
ci: add GitHub Actions workflow
fix: send refreshed token on retry, restore expired sessions, fix clear filters
```

The project also contains `.editorconfig` to keep basic editor settings consistent, and `.gitattributes`, which stores line endings as LF in the repository so a Windows working copy doesn't produce changes that a Linux CI runner rejects.

---

# 18. CI/CD

The GitHub Actions workflow runs on pull requests targeting `main` and on pushes to `main`.

On a clean Ubuntu runner with Node 22, the workflow runs:

1. Checkout with full history (`fetch-depth: 0`), which commitlint needs to compare a pull request's commits with `main`
2. `npm ci`, which installs the exact versions in the lockfile
3. Prettier formatting check
4. ESLint
5. commitlint over the pull request's commits (pull requests only)
6. Vitest tests
7. Production build, which also type-checks the project

All of these run in a single `verify` job, so any failing step fails the job.

The application is deployed using Vercel, and the deployment branch is `main`. `vercel.json` rewrites every route to `index.html`, so a deep link such as `/items/42` works on a fresh page load in production.

**Which checks can block a merge:** at the moment, none of them do. Branch protection is not enabled on `main`, so a failing `verify` job marks the pull request or commit as failed but does not stop a merge or a direct push. Vercel also deploys `main` independently of GitHub Actions, so a commit that fails CI would still be deployed. The next step would be a branch protection rule on `main` that requires pull requests and a passing `verify` check, which would make every check above a merge gate.

---

# 19. Decision log

## Decision 1 — Store list controls in the URL

**Decision:** I put search, category, sort and page in the URL.

**Alternative I rejected:** Keeping all of these values only in React component state.

**Why:** The assessment requires the current view to survive refreshes and copied URLs. URL state also makes the current list view easier to reproduce and share.

---

## Decision 2 — Use TanStack Query for server state

**Decision:** I used TanStack Query for stock lists, individual products and categories.

**Alternative I rejected:** Managing each API request manually with React `useState` and `useEffect`.

**Why:** TanStack Query already provides caching, query status and invalidation. Using it also keeps server state separate from short-lived UI state.

---

## Decision 3 — Handle combined search and category filtering on the client

**Decision:** When both search and category are active, I retrieve the search results and apply category filtering, sorting and pagination on the client.

**Alternative I rejected:** Assuming that DummyJSON's search endpoint would correctly combine the search and category parameters.

**Why:** I tested the API and found that the category parameter was not giving me the combined filtering behaviour required by the interface.

---

## Decision 4 — Use a responsive card layout on small screens

**Decision:** I switch the stock table to stacked cards at smaller widths.

**Alternative I rejected:** Keeping the complete desktop table on a 360px-wide screen and relying on horizontal scrolling.

**Why:** The card layout makes the important stock information easier to read and interact with on a narrow screen.

---

## Decision 5 — Use session-scoped stock overrides

**Decision:** I keep successful stock corrections in `sessionStorage` through `stockOverrides.ts`.

**Alternative I rejected:** Assuming that the DummyJSON `PUT` operation would permanently change the product.

**Why:** I tested the API and found that the successful `PUT` response does not persist when the product is fetched again. The override mechanism keeps the UI consistent for the current session while acknowledging that the underlying API is only a mock backend.

---

# 20. AI reflection

AI was used extensively during the implementation of this project. I want to be explicit about that rather than making the process sound as though every line was written manually.

I used AI to generate substantial parts of the implementation and then reviewed, modified, debugged and tested the resulting code against the assessment requirements.

## 20.1 How I used AI for each section

### Section 1 — Design

I did not delegate the initial design decisions to AI.

I first worked through the assessment requirements and decided what the application needed: the login flow, stock-list screen, detail screen, URL-based list state, stock correction flow and the main component structure.

After that, I used AI to discuss implementation options and edge cases.

### Section 2 — Build

This is where I used AI most heavily.

I used it to generate and modify implementation files for areas such as:

- React components
- API functions
- TanStack Query hooks
- Authentication
- Token refresh
- Search parameters
- Stock correction
- Tests
- Accessibility behaviour
- Error and loading states

The generated code was not treated as automatically correct. I ran the application, inspected errors, tested the API behaviour and made changes when the generated implementation did not match the requirements.

### Section 3 — CI/CD

I used AI to help create and review the development tooling and CI configuration, including:

- Prettier
- ESLint
- Husky
- lint-staged
- commitlint
- GitHub Actions
- Vercel configuration

I still checked the resulting configuration against the actual scripts and repository files.

### Section 4 — Reflection

For the reflection itself, I used AI to help organise my notes and make sure I addressed the questions in the assessment. The actual examples and limitations are based on what happened during development.

---

# 21. AI tools and workflow

The main AI tool I used during the development process was **Claude**.

I did not use a formal spec-driven development or agent framework such as Superpowers, GSD, Spec Kit, OpenSpec or BMAD.

My workflow was broadly:

1. Read the assessment requirements.
2. Decide what the application needed to do.
3. Give the relevant requirement or implementation problem to Claude.
4. Use the generated implementation as a starting point.
5. Run the application and tooling locally.
6. Check errors and unexpected behaviour.
7. Return the problem to Claude when I needed help diagnosing or changing it.
8. Test the resulting behaviour again.
9. Review the final implementation against the assessment requirements.

The implementation was therefore iterative. I did not simply generate the application once and submit the generated output.

---

# 22. Example of a prompt I used

One example of the type of prompt I used was to give Claude a concrete implementation problem together with the existing project context and ask it to modify the relevant files.

For example, for authentication I prompted around the requirement that access tokens expire quickly and that the application should refresh them without causing multiple simultaneous refresh requests.

A representative prompt was:

> I need the API client to handle a 401 caused by an expired access token, refresh the session, retry the original request once, and avoid multiple refresh requests when several API calls fail at the same time.

I then tested the resulting implementation rather than assuming the generated solution was correct.

---

# 23. An example where AI was wrong or incomplete

One specific issue was the route-focus implementation in `AppShell`.

An AI-generated version used an effect that moved focus during route changes. The code passed linting and the production build, and it appeared to work when navigating with a mouse.

However, when I tested the application using only the keyboard, the focus behaviour interfered with normal Tab navigation. The implementation was therefore technically working in one interaction mode but was wrong for the accessibility requirement.

I had to change the focus logic so that the main-content focus behaviour happened at the appropriate time without repeatedly stealing focus during normal keyboard interaction.

This was a good example of why I could not rely on the generated implementation simply because it compiled and passed static checks. I had to test the actual interaction that the assessment required.

---

# 24. An example where AI improved my implementation

The authentication refresh flow is another example.

The implementation problem was not simply refreshing a token after receiving a 401. There was also the possibility that several requests could fail at approximately the same time.

Thinking through that case led to the shared refresh promise in `AuthContext.tsx`, which `client.ts` calls when it receives a 401. This means concurrent requests can wait for the same refresh operation instead of each starting another one.

That made the implementation closer to the behaviour I wanted from the application.

---

# 25. Two decisions I made without AI

There were several decisions where I made the final call myself.

Two important ones were:

### URL-based list state

I decided that search, category, sort and page should live in the URL because these values describe the current view and the assessment requires refresh and copied-URL behaviour.

### Responsive stock layout

I decided to switch from a desktop table to stacked cards on small screens rather than trying to keep every table column visible at 360px.

Both decisions came from my interpretation of the requirements and how I wanted the application to behave.

---

# 26. The part of the code I would struggle to defend

The part I would be least confident defending in detail is the more subtle state-synchronisation logic around the search input and authentication refresh.

In particular, I understand what the render-time synchronisation in `SearchBox` is achieving and why it prevents the local draft from becoming inconsistent with the committed URL value, but I would not claim that I designed that pattern from first principles.

The same applies to some of the details of the shared refresh-promise implementation. I understand the intended concurrency behaviour, but if I were asked to redesign the mechanism from scratch without looking at the implementation, I would need more time to explain every edge case confidently.

I would rather identify that honestly than claim that I wrote and fully understood every part of the implementation equally well.

---

# 27. Acceptance checks

The brief sets five behaviours the app must meet. Each one is covered by automated tests that run in CI, and each was also checked by hand in a browser against the real DummyJSON API, at desktop width and at 360px.

## 1. Search never shows results for a query the user has replaced

**How:** the search box debounces for 300ms before writing the term to the URL; the query key comes from the URL, so each term is a separate query; a superseded request is aborted; and a new term clears the old results and shows the loading state instead of keeping them on screen. While uncommitted text is in the search box, the list is dimmed and marked busy.

**Checked against the real API:** I made every "laptop" search carry DummyJSON's `delay=3000`, typed "laptop", let it commit, then replaced it with "phone". A watcher on the page recorded what the table showed on every change. No laptop result was ever displayed once the search said "phone", the delayed laptop request was cancelled (it shows as aborted), and the phone results appeared as soon as they arrived. Searching "laptop" again showed the loading state, not the phone results, until the delayed response landed.

## 2. Changing the category or sort never strands the user on an empty page

**How:** changing the search, category or sort always returns to page 1. A page past the end (for example from an old shared link) is moved to the last page with results, and the loading state is shown for that moment rather than an empty page.

**Checked against the real API:** from page 8 of all items, choosing Smartphones went to page 1 of 16 items; from page 6, changing the sort to lowest stock went to page 1 of the new order; `/?category=laptops&page=7` opened on page 1 of 5 items. A watcher confirmed no empty state appeared at any point.

## 3. Reloading, or opening a copied URL elsewhere, restores the same view

**How:** search, category, sort and page live only in the URL. On reload the session is restored (refreshing an expired access token), and a signed-out visitor is sent to sign in with a `returnTo` that brings them back to the full URL.

**Checked against the real API:** I set up search "e", Groceries, highest price first, page 2 using the controls, then reloaded. The search box, both selects, the page and the exact seven rows were identical. With the session cleared to stand in for another machine, opening the same link went to sign-in and, after signing in, back to the identical view. Opening an item from that list and using the "Stock list" link also returns to the same view, not the default list.

## 4. Every data screen has loading, empty and error states, and errors can be recovered from

| Screen        | Loading                  | Empty                                         | Error and recovery                                                                                                                                           |
| ------------- | ------------------------ | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Stock list    | Skeleton rows            | "No items match …" with **Clear filters**     | Message naming the failure, with **Try again**. If counts are already on screen and only a refresh fails, they stay visible with a notice and **Try again**. |
| Item page     | Skeleton                 | "Item not found" with a link back to the list | Message naming the failure, with **Try again**                                                                                                               |
| Category list | Category picker disabled | —                                             | Notice with **Reload categories**; search and sorting keep working                                                                                           |
| Sign in       | "Signing in…"            | —                                             | Inline message; the form stays filled in to try again                                                                                                        |

**Checked against the real API:** I redirected every product request to DummyJSON's `/http/500`. The stock list and the item page each showed their loading state, retried once automatically, then showed "the stock service returned an error (500)" with **Try again**. With requests restored, **Try again** loaded the data on both screens. The automated tests also cover the category-list error and its reload.

## 5. The whole app works with a keyboard alone and is readable at 360px

**How:** every control is a native button, link, input or select with a visible focus ring; a skip link is the first stop on a freshly loaded page; on navigation, focus moves to the start of the new page's content; on the last or first page, focus moves from the disabled pagination button to the other one. Below tablet width the list becomes stacked cards, and every touch target is at least 44px.

**Checked in the browser at 360 × 780:** using only the keyboard I signed in, searched, changed the sort, opened an item, raised the count with **+** and saved it, returned to the same list with the "Stock list" link, and paged with **Next**. Focus was visible at every step and nothing on any screen scrolled sideways.

---

# 28. Fixes after review

After the build was finished, I asked Claude to review the whole project. It found four bugs that the original tests did not cover. Each was reproduced with a test first, fixed, and now has a regression test that fails against the old code.

- **The retry after a token refresh sent the expired token.** The API client captured the access token when it was created, so the retry after a successful refresh went out with the old token and failed. In practice, saving a correction more than a minute after the last request failed on the first attempt.
- **Reloading after the token expired signed the user out.** Session restore deleted the session as soon as `/auth/me` rejected the stored access token, even though the refresh token was still valid.
- **"Clear filters" did not clear the search.** It made two URL updates in a row, and the second one started from search params that still contained `q`, so the search came back.
- **A second correction of the same item did not show immediately.** The earlier session override was reapplied over the optimistic value until the save finished.

The review also found that a rejected refresh left the user on an error screen instead of returning them to the login page, and that a failed refresh logged an unhandled promise rejection. Both are fixed.

Working through the acceptance checks above found four more problems, each fixed with a regression test:

- **Quick successive changes could undo each other.** Each URL update started from the URL as of the last render, so changing the category and then the sort before the screen updated dropped the category. Updates now build on the most recent change.
- **The back link lost the list view.** "Stock list" on an item page went to the default list; it now returns to the search, filter, sort and page the item was opened from.
- **A failed category list had no error state.** It now shows a notice with **Reload categories**.
- **Focus could be left on a disabled button.** Reaching the last page disabled **Next** while it had focus; focus now moves to **Previous**.

While improving performance, I briefly made new search terms keep the previous term's results on screen while loading. The acceptance test for check 1 caught it, and that optimisation now applies only to paging and sorting.

---

# 29. Further development

I completed and tested the implementation against the requirements of the assessment, including the main application flows, error handling, authentication behaviour, URL state, responsive behaviour, keyboard interaction, API edge cases and the required development checks.

If this were being developed into a production inventory system rather than a take-home assessment, the next stage would be to extend the system beyond the current frontend-focused scope. In particular, I would:

- Replace DummyJSON with a persistent backend and database.
- Move stock corrections to server-side persistence and validation.
- Introduce a more complete inventory model covering areas such as stock movements, audit history and user permissions.
- Expand the automated test suite as the application grows to cover additional business workflows.
- Introduce end-to-end testing as the number of user workflows increases.

These are extensions to the current system rather than gaps in the assessment implementation. I kept the submitted solution focused on the requirements and constraints of the take-home assessment.

# 30. Time spent

I spent approximately 5 hours cumulatively working on this project across different days.
