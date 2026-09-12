# Clinic Stock Console

**Candidate:** Austine Namayi

This project is my submission for the Savannah Informatics Web Engineer Take-Home Assessment.

I built an internal clinic stock console that allows a staff member to sign in, view stock items, search and filter them, sort the results, move between pages, open an individual item, and correct its stock quantity.

**Live application:** https://clinic-stock-console-assignment.vercel.app

**GitHub repository:** https://github.com/AustineNamayi21/Clinic-stock-console-Assignment.git

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

- `AppShell`
- `StockTable`
- `StockControls`
- `SearchBox`
- `StockCorrectionForm`
- `StockFigure`
- `DataState`

I also have an `AuthGuard` route component that protects the authenticated application routes.

`StockFigure` is the exported component in `StockBadge.tsx`. The component was originally named around the stock-badge idea, but the exported component is now `StockFigure`.

The stock list is presented as a table on larger screens. At the small-screen breakpoint it changes to stacked cards instead of trying to squeeze all of the table columns into a narrow viewport.

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

I specifically checked this behaviour because the assessment calls out the delayed-search case as something that can expose race conditions.

---

# 9. Authentication and token expiry

The login request uses:

```text
expiresInMins: 1
```

I implemented token refresh in `src/api/client.ts`.

When an API request returns `401`, the client attempts to refresh the authentication session and retries the original request once.

I also use a shared refresh promise so that if multiple requests receive a `401` at approximately the same time, they can share the same refresh operation instead of all starting separate refresh requests.

If refreshing the session fails, the authentication state is cleared and the user is returned to the login flow.

The intention here was to prevent token expiry from producing a blank application or unnecessarily losing the user's current URL state.

---

# 10. Stock correction

Stock correction is handled on the individual item page.

The form validates the entered quantity before submitting the change.

When the mutation starts, the displayed item can be updated optimistically. If the request fails, the previous value is restored.

After the mutation settles, the relevant item and stock-list queries are invalidated.

There is an important DummyJSON limitation here.

The `PUT` request returns a successful response, but the updated stock value is **not persistently stored by DummyJSON**. I verified this by updating a product and then requesting it again.

Because of that, I added `src/lib/stockOverrides.ts` to keep successful stock corrections available during the current session.

This is a frontend workaround for the limitations of the assessment API. In a production application, I would replace this with a persistent backend and database.

---

# 11. Error, loading and empty states

I created reusable states in `DataState.tsx`.

These include:

- Loading state
- Empty state
- Error state with retry

The stock list and item detail screens use these states for their main API requests.

The category control is disabled while categories are loading.

The item detail page also handles an invalid or unavailable item rather than assuming that a valid product will always be returned.

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

`AppShell` contains the skip link and the main content target.

The `<main>` element uses `focus:outline-none` because it is being used as a programmatic focus target after route changes rather than as an interactive control. The visible focus treatment is intended for controls that the user can actually interact with.

I also designed the stock list to work at narrow widths. At smaller breakpoints, the table changes to a stacked layout so that the interface remains usable around the 360px requirement.

---

# 13. Visual design

I wanted the interface to feel like an internal clinic application rather than a generic dashboard.

The primary accent is **teal**, using `#0b6e63`, with:

- Clear contrast between content and background
- Stronger visual emphasis for important actions
- Consistent spacing and rounded surfaces
- Responsive layouts for the stock list and forms

I used Tailwind CSS for the styling and kept the visual design fairly restrained so that the stock information remains the main focus.

---

# 14. Project structure

The relevant project structure is:

```text
src/
├── api/
│   ├── client.ts
│   ├── config.ts
│   ├── products.test.ts
│   ├── products.ts
│   └── types.ts
├── auth/
│   └── AuthContext.tsx
├── components/
│   ├── AppShell.tsx
│   ├── DataState.tsx
│   ├── SearchBox.tsx
│   ├── StockBadge.tsx
│   ├── StockControls.tsx
│   ├── StockCorrectionForm.tsx
│   └── StockTable.tsx
├── hooks/
│   ├── useSearchParamsState.test.tsx
│   ├── useSearchParamsState.ts
│   └── useStock.ts
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
│   └── setup.ts
├── App.tsx
├── index.css
└── main.tsx
```

The main project configuration files are:

```text
.editorconfig
.eslintrc / eslint.config.js
.prettierrc.json
commitlint.config.js
package.json
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

This means an item can be opened directly using its URL rather than requiring navigation from the stock list.

I also added the Vercel SPA rewrite configuration so that client-side routes can be loaded directly without Vercel treating them as missing server-side files.

---

# 16. Testing

I used Vitest for the automated tests.

I focused the tests on areas where a small change could easily introduce a behavioural regression.

## API tests

`src/api/products.test.ts` covers the product-listing behaviour, including the combined search/category handling and the normal unfiltered request.

## URL-state tests

`src/hooks/useSearchParamsState.test.tsx` covers:

- Default URL values
- Reading state from a copied URL
- Resetting the page when a filter changes
- Keeping the active filters while changing pages

## Stock override tests

`src/lib/stockOverrides.test.ts` checks that stock overrides are returned correctly and remain available on repeated reads.

I chose these areas because they contain actual application logic rather than simply checking whether a component renders.

---

# 17. Formatting, linting and commits

I use Prettier for formatting.

The formatting check is:

```powershell
npm run format:check
```

ESLint uses the recommended configurations for JavaScript, TypeScript, React Hooks and React Refresh used by the project.

There is also a local ESLint exception in `AuthContext.tsx` for the React Refresh rule, with an explanatory comment.

I use Husky and lint-staged for pre-commit checks.

The commit message hook runs commitlint and checks Conventional Commit-style messages.

Examples include:

```text
feat: add stock correction form
fix: handle expired access token
test: cover search parameter state
docs: update assessment README
```

The project also contains `.editorconfig` to keep basic editor settings consistent.

---

# 18. CI/CD

The GitHub Actions workflow runs on pull requests targeting `main` and on pushes to `main`.

The workflow runs:

1. `npm ci`
2. Prettier formatting check
3. ESLint
4. commitlint on pull requests
5. Vitest tests
6. Production build

The application is deployed using Vercel.

The deployment branch is `main`.

The GitHub Actions workflow performs the verification checks, while Vercel handles the application deployment.

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

Thinking through that case led to the shared refresh promise in `client.ts`. This means concurrent requests can wait for the same refresh operation instead of each starting another one.

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

# 27. Further development

I completed and tested the implementation against the requirements of the assessment, including the main application flows, error handling, authentication behaviour, URL state, responsive behaviour, keyboard interaction, API edge cases and the required development checks.

If this were being developed into a production inventory system rather than a take-home assessment, the next stage would be to extend the system beyond the current frontend-focused scope. In particular, I would:

- Replace DummyJSON with a persistent backend and database.
- Move stock corrections to server-side persistence and validation.
- Introduce a more complete inventory model covering areas such as stock movements, audit history and user permissions.
- Expand the automated test suite as the application grows to cover additional business workflows.
- Introduce end-to-end testing as the number of user workflows increases.

These are extensions to the current system rather than gaps in the assessment implementation. I kept the submitted solution focused on the requirements and constraints of the take-home assessment.

# 28. Time spent

I spent approximately 5 hours cumulatively working on this project across different days.
