# OneVishwam Backend — Full API List

**Base URL:** `http://localhost:5001/api`

---

## Authentication — `/api/v1/auth`

| # | Method | Endpoint | Auth | Rate Limit | Description |
|---|--------|----------|------|------------|-------------|
| 1 | POST | `/api/v1/auth/register` | - | — | Register new user |
| 2 | POST | `/api/v1/auth/login` | - | 10 req/15min | Login (returns JWT) |
| 3 | POST | `/api/v1/auth/logout` | Yes | — | Logout |
| 4 | POST | `/api/v1/auth/forgot-password` | - | 20 req/15min | Request password reset OTP |
| 5 | POST | `/api/v1/auth/verify-otp` | - | 20 req/15min | Verify OTP |
| 6 | POST | `/api/v1/auth/resend-otp` | - | 20 req/15min | Resend OTP |
| 7 | POST | `/api/v1/auth/reset-password` | - | — | Reset password with OTP |
| 8 | GET | `/api/v1/auth/me` | Yes | — | Get current user profile |

**Backward-compatible alias:** `/api/auth/*` maps to the same routes.

---

## User Profile — `/api/v1/users`

| # | Method | Endpoint | Auth | Description |
|---|--------|----------|------|-------------|
| 9 | PUT | `/api/v1/users/profile` | Yes | Update profile (multipart with optional image) |

---

## v1 Property Endpoints — `/api/v1/properties`

### Public

| # | Method | Endpoint | Auth | Description |
|---|--------|----------|------|-------------|
| 10 | GET | `/api/v1/properties` | - | List (paginated, filterable, sortable, searchable) |
| 11 | GET | `/api/v1/properties/featured` | - | Featured properties (max 6) |
| 12 | GET | `/api/v1/properties/latest?limit=` | - | Latest properties (default 6, max 20) |
| 13 | GET | `/api/v1/properties/similar/:id` | - | Similar properties (max 4, by city/area/type) |
| 14 | GET | `/api/v1/properties/:id` | Opt | Single property (increments view count) |

### Protected

| # | Method | Endpoint | Auth | Description |
|---|--------|----------|------|-------------|
| 15 | GET | `/api/v1/properties/my` | Yes | My property listings |
| 16 | POST | `/api/v1/properties` | Yes | Create property (multipart, field `images`) |
| 17 | PUT | `/api/v1/properties/:id` | Yes | Update property (owner or admin) |
| 18 | DELETE | `/api/v1/properties/:id` | Yes | Soft-delete property (owner or admin) |
| 19 | PATCH | `/api/v1/properties/:id/status` | Yes | Toggle active/inactive (owner or admin) |

**Backward-compatible alias:** `/api/product/properties/*` maps to the same routes.

---

## Property Requirements — `/api/v1/property-requirements`

| # | Method | Endpoint | Auth | Description |
|---|--------|----------|------|-------------|
| 20 | POST | `/api/v1/property-requirements` | Opt | Submit a property requirement |
| 21 | GET | `/api/v1/property-requirements/me` | Yes | My submitted requirements |

---

## Product Services (CRUD) — `/api/product/:service`

All 6 services expose identical CRUD endpoints. Replace `:service` with one of:
`properties`, `vehicles`, `groceries`, `garments`, `jewellery`, `finance`

| # | Method | Endpoint | Auth | Description |
|---|--------|----------|------|-------------|
| 22 | GET | `/api/product/:service` | - | List items (filterable, sortable, paginated) |
| 23 | GET | `/api/product/:service/:id` | - | Get single item by ID |
| 25 | PUT | `/api/product/:service/:id` | Yes | Update item (owner or admin) |
| 26 | DELETE | `/api/product/:service/:id` | Yes | Delete item (owner or admin) |

---

## Cross-Cutting Modules

### Global Search

| # | Method | Endpoint | Auth | Description |
|---|--------|----------|------|-------------|
| 27 | GET | `/api/search?q=` | - | Search across all 6 services |

### Image Upload

| # | Method | Endpoint | Auth | Description |
|---|--------|----------|------|-------------|
| 28 | POST | `/api/upload/images` | Yes | Upload up to 10 images (multipart, field: `images`) |

### Wishlist

| # | Method | Endpoint | Auth | Description |
|---|--------|----------|------|-------------|
| 29 | GET | `/api/wishlist` | Yes | Get user's wishlist (grouped by service) |
| 30 | POST | `/api/wishlist` | Yes | Add item to wishlist (body: `{ item, serviceType }`) |
| 31 | DELETE | `/api/wishlist/:id` | Yes | Remove item from wishlist |

### Requirements

| # | Method | Endpoint | Auth | Description |
|---|--------|----------|------|-------------|
| 32 | POST | `/api/requirements` | Opt | Submit a requirement (serviceType + details) |
| 33 | GET | `/api/requirements` | Admin | List all requirements (filterable by `serviceType`) |

### My Listings

| # | Method | Endpoint | Auth | Description |
|---|--------|----------|------|-------------|
| 34 | GET | `/api/mylistings` | Yes | Get user's listings across all services |
| 34b | GET | `/api/mylistings?serviceType=` | Yes | Get user's listings for a specific service |

---

## Public — `/api/`

| # | Method | Endpoint | Auth | Description |
|---|--------|----------|------|-------------|
| 35 | GET | `/api/loans` | - | Get loan products |
| 36 | GET | `/api/users/:userId/reviews` | - | Get user reviews |
| 37 | POST | `/api/enquiries` | Yes | Submit an enquiry |
| 38 | POST | `/api/reviews` | Yes | Submit a review |

---

## Health Check

| # | Method | Endpoint | Auth | Description |
|---|--------|----------|------|-------------|
| 39 | GET | `/health` | - | Server health check |

---

## Query Parameters — `GET /api/v1/properties`

| Param | Type | Example | Description |
|-------|------|---------|-------------|
| `q` | String | `whitefield` | Search keyword (title, description, city, area, location, propertyType, subtitle) |
| `sort` | String | `price-low` | Sort: `latest`, `oldest`, `price-low`, `price-high`, `area-low`, `area-high`, `viewed` |
| `page` | Number | `1` | Page number |
| `limit` | Number | `20` | Items per page (max 100) |
| `city` | String | `bengaluru` | Filter by city |
| `area` | String | `whitefield` | Filter by area |
| `propertyType` | String | `Flats` | Filter by property type |
| `purpose` | String | `Rent` | Filter by purpose (`Sell`, `Rent`, `Lease`) |
| `category` | String | `apartment` | Filter by category |
| `priceMin` | Number | `500000` | Minimum price |
| `priceMax` | Number | `10000000` | Maximum price |
| `areaMin` | Number | `1000` | Minimum area (sq.ft) |
| `areaMax` | Number | `2000` | Maximum area (sq.ft) |
| `bedrooms` | Number | `3` | Filter by bedrooms |
| `bhk` | String | `3 BHK` | Filter by BHK label |
| `furnishing` | String | `Furnished` | Filter by furnishing status |
| `amenities` | CSV | `Lift,Pool` | Filter by amenities (all must match) |
| `zone` | String | `Whitefield` | Filter by zone |
| `listedWithin` | String | `Last 7 Days` | `Today`, `Last 3 Days`, `Last 7 Days`, `Last 30 Days` |
| Any field | String | — | Direct field match (e.g. `facing=East`, `postedBy=Owner`) |

---

## Query Parameters — `GET /api/product/:service`

Every service supports the same filtering pattern. Service-specific field names can be passed directly as query params.

| Param | Type | Example |
|-------|------|---------|
| `q` | String | Search keyword (searches title, description, etc.) |
| `sort` | String | `latest`, `oldest`, `price-low`, `price-high`, `area-low`, `area-high` |
| `page` | Number | `1` (default) |
| `limit` | Number | `20` (default, max 100) |
| `*Min` | Number | Range min (e.g., `priceMin=500000`, `yearMin=2020`) |
| `*Max` | Number | Range max (e.g., `priceMax=10000000`, `yearMax=2025`) |
| Any field | String | Direct field match (e.g., `city=Bengaluru`, `make=Toyota`) |

---

## Response Format

**Success:**
```json
{
  "success": true,
  "message": "Properties fetched successfully",
  "data": {
    "items": [],
    "pagination": { "page": 1, "limit": 20, "totalItems": 100, "totalPages": 5, "hasNextPage": true, "hasPreviousPage": false }
  }
}
```

**Error:**
```json
{
  "success": false,
  "message": "Error description"
}
```

---

## Auth Header

```
Authorization: Bearer <jwt_token>
```

## Legend

| Symbol | Meaning |
|--------|---------|
| - | No authentication required |
| Yes | JWT token required (`protect` middleware) |
| Admin | Admin role required |
| Opt | Optional auth (attaches user if token present) |
