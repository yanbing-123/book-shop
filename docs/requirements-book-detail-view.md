# Requirements Document: Book Detail View with Reviews & Ratings

## 1. Overview

**Feature Name:** Book Detail View with Reviews & Ratings

**Purpose:** Currently, clicking a book card does nothing — users see only the name, author, price, and stock tag. This feature adds a rich book detail modal with full metadata (description, publisher, publication year, ISBN) and a community review/rating system. It transforms the book shop from a simple price list into an informed shopping experience.

**Priority:** High — directly impacts user engagement and purchase confidence.

---

## 2. User Flow

### Flow A: View Book Detail

1. User browses the product grid and clicks a book card (emoji cover, name, or any non-button area)
2. A full-screen overlay + centered modal opens with a slide-up animation
3. Modal displays: large emoji, book name, author, category tag, price, stock status, description, publisher, publication year, ISBN
4. Below the metadata: a star rating summary (average rating + count) and a list of user reviews
5. User clicks "Close" button, taps overlay, or presses Escape to dismiss

### Flow B: Rate & Review a Book

1. From the detail modal, user clicks the "Write a Review" button
2. A inline section expands: star selector (clickable 1–5 stars) + text area for written review + submit button
3. User selects star rating and optionally writes a text review
4. User clicks "Submit Review"
5. System validates: rating is required (1–5), review text is optional (max 500 chars)
6. On success: review is saved to localStorage, the review list updates in real time, average rating recalculates, a toast confirms "评价提交成功！"
7. If not in the mood, user can collapse the review form

### Flow C: View Rating while Browsing

1. On each product card in the grid, show a small star rating display (e.g., "★★★★☆ 4.2 (12)")
2. This gives users immediate visibility into community ratings without opening the detail modal
3. Books with no reviews show "暂无评价"

---

## 3. Data Requirements

### 3.1 Enriched Book Metadata

Extend the `PRODUCTS` array with new fields:

| Field | Type | Example | Required |
|-------|------|---------|----------|
| `description` | string | "《红楼梦》是中国古典四大名著之一..." | Yes |
| `publisher` | string | "人民文学出版社" | Yes |
| `year` | number | 1996 | Yes |
| `isbn` | string | "9787020002207" | Yes |
| `pages` | number | 1606 | No |

Metadata is hardcoded in JS (no backend change needed).

### 3.2 localStorage Schema

**Key:** `book_reviews` — stores all reviews for all books.

```json
{
  "1": [
    {
      "id": "rev_1712345678",
      "bookId": 1,
      "rating": 5,
      "text": "经典中的经典，值得反复阅读。",
      "author": "匿名用户",
      "createdAt": "2026-05-19T10:30:00.000Z"
    }
  ]
}
```

**Review object fields:**

| Field | Type | Constraints |
|-------|------|------------|
| `id` | string | Generated: `rev_` + timestamp |
| `bookId` | number | 1–10 (matches PRODUCTS) |
| `rating` | number | 1–5 (integer) |
| `text` | string | Optional, max 500 chars |
| `author` | string | "匿名用户" (hardcoded for v1) |
| `createdAt` | string | ISO 8601 timestamp |

**Key:** `book_ratings_summary` — cached averages for grid display (optional optimization).

### 3.3 Computed Data (no storage needed)

| Data | Computation |
|------|------------|
| Average rating | `sum of all ratings for book / count` |
| Rating count | `reviews[bookId].length` |
| Star distribution | `count of each rating value (1–5)` |

---

## 4. UI / Component Specifications

### 4.1 Product Card Updates

Add a rating line below the price on each card:

```html
<div class="card-rating">
  <span class="stars-display">★★★★☆</span>
  <span class="rating-text">4.2 (12评价)</span>
</div>
```

- No-rating state: `暂无评价` in light gray
- Clicking the card (anywhere except the "加入购物车" button) opens the detail modal
- Product card must use `cursor: pointer` on the clickable area

### 4.2 Book Detail Modal

New HTML structure (in `index.html`):

```
#detailOverlay (modal overlay, z-index: 300)
#detailModal (centered modal)
  ├── .detail-close-btn (✕ button top-right)
  ├── .detail-header
  │   ├── .detail-emoji (large emoji, ~4rem)
  │   ├── .detail-title (book name)
  │   ├── .detail-author (author name)
  │   └── .detail-category (category tag)
  ├── .detail-meta
  │   ├── .detail-price (¥ price)
  │   ├── .detail-stock (stock info)
  │   ├── .detail-publisher (出版社)
  │   ├── .detail-year (出版年份)
  │   └── .detail-isbn (ISBN)
  ├── .detail-description (book description paragraph)
  ├── .detail-actions
  │   └── button "加入购物车" (adds to cart + closes modal)
  ├── .detail-reviews-section
  │   ├── .reviews-header (评价 / 共N条评价)
  │   ├── .reviews-summary
  │   │   ├── .avg-rating (large number, e.g. "4.2")
  │   │   └── .star-bars (distribution bars for 1–5 stars)
  │   ├── .reviews-list (list of individual reviews)
  │   │   └── .review-item
  │   │       ├── .review-header (stars + date)
  │   │       └── .review-text (review content)
  │   ├── .review-form (collapsible)
  │   │   ├── .star-selector (5 clickable stars)
  │   │   ├── textarea (review text, max 500)
  │   │   └── button "提交评价"
  │   └── .dismiss-review-form (collapse button)
```

### 4.3 Responsive Behavior

- Desktop (>768px): Modal width 580px, max-height 85vh, scrollable
- Mobile (≤768px): Modal width 94vw, max-height 90vh
- Reviews list scrolls independently above a certain height

### 4.4 CSS Additions

New styles needed in `style.css`:

| Rule | Details |
|------|---------|
| `.card-rating` | Small rating display on product cards |
| `.stars-display` | Gold-colored star characters |
| `.detail-modal` | Large modal for book details |
| `.detail-section` | Layout for modal content sections |
| `.reviews-section` | Scrollable review area |
| `.star-selector` | Interactive stars for rating input |
| `.star-bar` | Horizontal distribution bars |
| `.review-item` | Individual review card |
| `.rating-text` | Rating numeric display |

---

## 5. JavaScript Functions

### 5.1 New Internal Functions

| Function | Purpose |
|----------|---------|
| `loadReviews()` | Load all reviews from localStorage |
| `saveReviews()` | Persist reviews to localStorage |
| `getReviews(bookId)` | Get reviews for a specific book |
| `getAvgRating(bookId)` | Calculate average rating for a book |
| `getRatingDistribution(bookId)` | Get count of each star level (1–5) |
| `openDetail(bookId)` | Open the detail modal for a specific book |
| `closeDetail()` | Close the detail modal |
| `submitReview(bookId)` | Save a new review + refresh UI |
| `renderReviews(bookId)` | Render review list for a book |
| `renderRatingSummary(bookId)` | Render star distribution + average |
| `renderCardRating(bookId)` | Render small rating on product card |

### 5.2 Exports (add to `window._book`)

| Export | Description |
|--------|-------------|
| `openDetail` | Opens book detail modal |
| `closeDetail` | Closes book detail modal |
| `submitReview` | Submits a new review |

### 5.3 `init()` Updates

- Add `loadReviews()` call
- Update `renderProducts()` to call `renderCardRating()` for each card
- Add click event delegation on `#productGrid` for card clicks

---

## 6. Edge Cases & States

| Scenario | Behavior |
|----------|----------|
| No reviews for a book | Show "暂无评价，来写下第一条评价吧" message |
| Empty review text submitted | Accept review with rating only (text is optional) |
| Rating 0 submitted | Block submission, show tooltip "请选择星级" |
| localStorage full | Show toast warning "存储空间不足，无法保存评价" |
| Multiple rapid submissions | Debounce submit button (1s cooldown) |
| Book stock is 0 | Show "缺货" in detail modal, disable "加入购物车" |
| ISBN not available | Show "暂无" or omit the field |
| Very long review text (500+ chars) | Truncate at 500, show char counter as user types |
| Swipe-to-close on mobile | Detect swipe-down gesture to close modal |
| Escape key | Close modal on Escape press |
| Cart open + detail open | Detail modal closes if cart is opened (and vice versa) |

---

## 7. Performance Considerations

| Concern | Mitigation |
|---------|-----------|
| Reviews loaded all at once | Reviews data is small (<50KB for thousands of reviews); no pagination needed for v1 |
| Star rendering on every card | `renderCardRating()` runs inside the existing product render loop; negligible overhead |
| Debounced search + filter | Already implemented; card ratings don't add filter computation |
| localStorage reads | Reviews loaded once at init, cached in memory variable |

---

## 8. API Endpoints

**Note on Architecture:** The Book Shop is a pure frontend application with no backend server. All data persistence uses the browser's `localStorage` API. Therefore, **no API endpoints are required** for this feature.

If the application were to gain a backend in the future, the following API contract would apply:

### Future API Contract

| Method | Endpoint | Purpose | Request Body | Response |
|--------|----------|---------|-------------|----------|
| `GET` | `/api/books` | List all books | — | `[{ id, name, author, category, price, stock, description, publisher, year, isbn, pages, avgRating, reviewCount }]` |
| `GET` | `/api/books/:id` | Get book details | — | Single book object with full metadata |
| `GET` | `/api/books/:id/reviews` | Get reviews for a book | — | `[{ id, rating, text, author, createdAt }]` |
| `POST` | `/api/books/:id/reviews` | Submit a review | `{ rating: number, text?: string }` | Created review object |
| `GET` | `/api/books/:id/rating` | Get rating summary | — | `{ avgRating, reviewCount, distribution: { 1: N, 2: N, 3: N, 4: N, 5: N } }` |

### Database Model Changes (Future)

If a backend were added:

```prisma
model Book {
  id          Int      @id @default(autoincrement())
  name        String
  author      String
  category    String
  price       Float
  stock       Int
  emoji       String
  description String?
  publisher   String?
  year        Int?
  isbn        String   @unique
  pages       Int?
  reviews     Review[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Review {
  id        String   @id
  bookId    Int
  book      Book     @relation(fields: [bookId], references: [id])
  rating    Int      // 1–5
  text      String?
  author    String   @default("匿名用户")
  createdAt DateTime @default(now())
}
```

---

## 9. Acceptance Criteria

- [ ] Clicking a book card opens the detail modal with correct book data
- [ ] Detail modal displays all metadata fields (name, author, category, price, stock, description, publisher, year, ISBN)
- [ ] Star rating summary (average + distribution) displays correctly for books with reviews
- [ ] "暂无评价" displays for books without reviews
- [ ] User can submit a star rating (1–5 required) with optional text review (max 500 chars)
- [ ] After review submission: modal updates in real time, toast confirms success
- [ ] Product cards show small rating on grid view
- [ ] "加入购物车" button in detail modal works correctly
- [ ] Modal closes on: ✕ button, overlay click, Escape key
- [ ] Reviews persist across page refreshes (localStorage)
- [ ] Responsive layout works on mobile (≤768px) and desktop
- [ ] Edge cases handled: no reviews, rating 0 blocked, stock 0, char limit

---

## 10. Out of Scope (Future Considerations)

- User auth for named reviews (v2)
- Edit/delete reviews
- Review sorting (newest / highest / lowest)
- Review upvoting / helpfulness marking
- Photo attachments in reviews
- Server-side persistence (API + database)
- Admin review moderation
- Book recommendation based on browsing/review history
