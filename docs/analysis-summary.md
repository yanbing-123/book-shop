# PET-10 Requirements Analysis — Summary

## Codebase Analysis

**Actual architecture:** Pure frontend vanilla HTML/CSS/JS single-page application (book shop). No backend, no database, no build tools.

**Files:** `index.html`, `css/style.css`, `js/app.js`, `README.md`

**Current features:** Product grid (10 books, 7 categories), category filtering, text search + price range + sorting, shopping cart, checkout with form validation, order success modal, localStorage persistence (cart + stock).

## Key Finding: Unimplemented Features in Code

The `app.js` file defines local storage keys and calls functions in `init()` that **do not have implementations**:

| Referenced in Code | Status |
|---|---|
| `authInit()` / `updateAuthUI()` | Not defined |
| `loadFavorites()` | Not defined (LS key: `book_fav_`) |
| `loadOrders()` | Not defined (LS key: `book_orders_`) |
| `loadStaffSession()` / `renderStaffDashboard()` | Not defined (LS key: `book_staff_session`) |
| `loadOrderQueue()` | Not defined (LS key: `book_order_queue`) |
| `loadSpecials()` / `renderSpecialsBanner()` | Not defined (LS key: `book_specials`) |

These indicate planned features (user auth, favorites/wishlist, order history, staff dashboard, special offers) that were scoped but never built.

## Proposed Feature: Book Detail View with Reviews & Ratings

**Rationale:** The biggest UX gap is that clicking a book card does nothing — users see only name/author/price. This feature adds rich detail and community feedback.

**Document:** `docs/requirements-book-detail-view.md`

**Summary of what's proposed:**
1. Click a book card → detail modal with full metadata (description, publisher, year, ISBN)
2. Star rating summary (average + distribution) per book
3. User reviews (star rating + optional text, persisted to localStorage)
4. Rating display on product cards in grid view
5. All implemented in vanilla JS, no backend changes needed

## Disposition

✅ **Done** — requirements document delivered at `docs/requirements-book-detail-view.md`. Ready for development kickoff or further review.
