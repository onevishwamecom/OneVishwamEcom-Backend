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

## Unified Product Services — `/api/product/:service`

All services share the **same API shape**. Only the `:service` segment changes:

| Service | Endpoint Prefix |
|---------|----------------|
| Properties | `/api/product/properties` |
| Vehicles / Automobiles | `/api/product/vehicles` |
| Garments | `/api/product/garments` |
| Groceries | `/api/product/groceries` |
| Jewellery | `/api/product/jewellery` |
| Finance | `/api/product/finance` |

### Public Endpoints

| # | Method | Endpoint | Description |
|---|--------|----------|-------------|
| 22 | GET | `/api/product/:service` | List items (paginated, filterable, sortable, searchable) |
| 23 | GET | `/api/product/:service/featured` | Featured items (properties only) |
| 24 | GET | `/api/product/:service/latest` | Latest items (properties only) |
| 25 | GET | `/api/product/:service/similar/:id` | Similar items (properties & vehicles) |
| 26 | GET | `/api/product/:service/:id` | Single item (increments view count) |

### Protected Endpoints

| # | Method | Endpoint | Description |
|---|--------|----------|-------------|
| 27 | GET | `/api/product/:service/my` | My listings for this service |
| 28 | POST | `/api/product/:service` | Create listing (owner) |
| 29 | PUT | `/api/product/:service/:id` | Update listing (owner or admin) |
| 30 | DELETE | `/api/product/:service/:id` | Delete listing (owner or admin) |
| 31 | PATCH | `/api/product/:service/:id/status` | Toggle active/inactive (owner or admin) |

---

## Cross-Cutting Modules

### Global Search

| # | Method | Endpoint | Auth | Description |
|---|--------|----------|------|-------------|
| 32 | GET | `/api/search?q=` | - | Search across all 6 services |

### Image Upload

| # | Method | Endpoint | Auth | Description |
|---|--------|----------|------|-------------|
| 33 | POST | `/api/upload/images` | Yes | Upload up to 10 images (multipart, field: `images`) |

### Wishlist

| # | Method | Endpoint | Auth | Description |
|---|--------|----------|------|-------------|
| 34 | GET | `/api/wishlist` | Yes | Get user's wishlist (grouped by service) |
| 35 | POST | `/api/wishlist` | Yes | Add item to wishlist (body: `{ item, serviceType }`) |
| 36 | DELETE | `/api/wishlist/:id` | Yes | Remove item from wishlist |

### Requirements

| # | Method | Endpoint | Auth | Description |
|---|--------|----------|------|-------------|
| 37 | POST | `/api/requirements` | Opt | Submit a requirement (serviceType + details) |
| 38 | GET | `/api/requirements` | Admin | List all requirements (filterable by `serviceType`) |

### My Listings

| # | Method | Endpoint | Auth | Description |
|---|--------|----------|------|-------------|
| 39 | GET | `/api/mylistings` | Yes | Get user's listings across all services |
| 39b | GET | `/api/mylistings?serviceType=` | Yes | Get user's listings for a specific service |

---

## Public — `/api/`

| # | Method | Endpoint | Auth | Description |
|---|--------|----------|------|-------------|
| 40 | GET | `/api/loans` | - | Get loan products |
| 41 | GET | `/api/users/:userId/reviews` | - | Get user reviews |
| 42 | POST | `/api/enquiries` | Yes | Submit an enquiry |
| 43 | POST | `/api/reviews` | Yes | Submit a review |

---

## Health Check

| # | Method | Endpoint | Auth | Description |
|---|--------|----------|------|-------------|
| 44 | GET | `/health` | - | Server health check |

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

Every service supports the **same filtering pattern**. Pass any model field directly as a query parameter.

| Param | Type | Example | Description |
|-------|------|---------|-------------|
| `q` | String | `honda` | Full-text search across name/title/description fields |
| `search` | String | `sedan` | Alias for `q` |
| `sort` | String | `price-low` | `latest` (default), `price-low`, `price-high` |
| `page` | Number | `1` | Page number |
| `limit` | Number | `20` | Items per page (max 100) |
| `*Min` | Number | `priceMin=500000` | Range minimum (e.g., `priceMin`, `yearMin`, `minPrice`) |
| `*Max` | Number | `priceMax=2000000` | Range maximum (e.g., `priceMax`, `yearMax`, `maxPrice`) |
| Any field | String | — | Direct match filter (e.g. `city=bengaluru`, `fuelType=Petrol`) |

### Vehicle-specific query parameters

| Param | Type | Example | Description |
|-------|------|---------|-------------|
| `condition` | String | `new` | `new` or `old` |
| `category` | String | `2-wheeler` | `2-wheeler`, `3-wheeler`, `4-wheeler`, `commercial` |
| `fuelType` | String | `Petrol` | `Petrol`, `Diesel`, `Electric`, `CNG` |
| `brand` | String | `Honda` | Filter by brand |
| `minPrice` / `maxPrice` | Number | `50000` | Price range (numeric) |
| `minKm` / `maxKm` | Number | `10000` | KM driven range |
| `loanApproved` | Boolean | `true` | Only pre-approved loan vehicles |
| `featured` | Boolean | `true` | Only featured listings |
| `location` | String | `Bangalore` | Filter by city name |
| `city` | String | `bengaluru` | Filter by lowercase city key |

---

## Unified Response Format

All endpoints follow the **same response shape** across every service.

### List (GET /)
```json
{
  "success": true,
  "message": "Vehicles fetched successfully",
  "data": {
    "items": [],
    "pagination": {
      "page": 1,
      "limit": 20,
      "totalItems": 45,
      "totalPages": 3,
      "hasNextPage": true,
      "hasPreviousPage": false
    }
  }
}
```

### Single Item (GET /:id)
```json
{
  "success": true,
  "message": "Vehicle fetched successfully",
  "data": {
    "item": { ... }
  }
}
```

### Create / Update (POST /, PUT /:id)
```json
{
  "success": true,
  "message": "Vehicle listing created successfully",
  "data": {
    "item": { ... }
  }
}
```

### Status Toggle (PATCH /:id/status)
```json
{
  "success": true,
  "message": "Vehicle status updated",
  "data": {
    "item": { "status": "inactive", ... }
  }
}
```

### Delete (DELETE /:id)
```json
{
  "success": true,
  "message": "Vehicle listing deleted successfully",
  "data": null
}
```

### Error
```json
{
  "success": false,
  "message": "Human-readable error message",
  "errors": [
    { "field": "brand", "message": "Brand is required" }
  ]
}
```

---

## Vehicle / Automobile Module — Data Model

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `brand` | String | Yes | Also accepts `make` as alias |
| `model` | String | Yes | |
| `year` | Number | Yes | 1990 — current year+1 |
| `condition` | Enum | Yes | `"new"` or `"old"` |
| `category` | Enum | Yes | `"2-wheeler"`, `"3-wheeler"`, `"4-wheeler"`, `"commercial"` |
| `wheelerType` | String | Auto | Set to `category` if not provided |
| `fuelType` | Enum | Yes | `"Petrol"`, `"Diesel"`, `"Electric"`, `"CNG"` |
| `price` | String | Yes | Display price e.g. `"₹ 85,000"` |
| `priceValue` | Number | Yes | Numeric price for filtering/sorting |
| `kmDriven` | Number | Yes | 0 for new vehicles |
| `location` | String | Yes | City name e.g. `"Bangalore"` |
| `city` | String | Yes | Lowercase city key e.g. `"bengaluru"` |
| `pincode` | String | Yes | 6-digit |
| `images` | Array[String] | Yes | At least 1 URL |
| `showroom` | Object | No | `{ name, address, phone, mapsLink }` |
| `loanApproved` | Boolean | No | |
| `featured` | Boolean | No | |
| `variants` | Number | No | |
| `description` | String | No | |
| `transmission` | Enum | No | `"Manual"`, `"Automatic"`, `"CVT"`, `"DCT"`, `"AMT"` |
| `mileage` | String | No | |
| `registrationNumber` | String | No | For old vehicles |
| `insuranceValidTill` | Date | No | For old vehicles |
| `ownersCount` | Number | No | For old vehicles |
| `status` | Enum | No | `"active"`, `"inactive"`, `"sold"` |
| `listedBy` | Enum | No | `"Owner"`, `"Dealer"`, `"Showroom"` |
| `listedDate` | Date | Auto | |
| `views` | Number | Auto | Incremented on each GET /:id |

---

## Frontend Integration Guide (LLM-Driven)

This project uses **LLM-assisted frontend development**. The backend is fully built; the frontend consumes these APIs directly. Below is how an LLM should interpret and generate frontend code against this API.

### Core Principle

**One API shape, any service.** The response format is identical for every module. The only thing that changes is the URL path segment (`properties`, `vehicles`, `garments`, etc.). An LLM generating frontend code can use a single reusable data layer.

### Base URL

```js
const BASE = 'http://localhost:5001/api';
```

### Standard API Client Pattern

```js
// api/client.js — Single generic client, works for every service
const apiClient = {
  baseURL: 'http://localhost:5001/api',

  async request(method, path, options = {}) {
    const { body, params, token } = options;
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    let url = `${this.baseURL}${path}`;
    if (params) url += '?' + new URLSearchParams(params);

    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    return res.json();
  },

  // Generic service factory — pass the service name, get all endpoints
  service(serviceName) {
    const prefix = `/product/${serviceName}`;
    const auth = () => localStorage.getItem('token'); // or your auth store

    return {
      list: (params) => this.request('GET', prefix, { params }),
      getById: (id) => this.request('GET', `${prefix}/${id}`),
      getMy: () => this.request('GET', `${prefix}/my`, { token: auth() }),
      getSimilar: (id) => this.request('GET', `${prefix}/similar/${id}`),
      create: (data) => this.request('POST', prefix, { body: data, token: auth() }),
      update: (id, data) => this.request('PUT', `${prefix}/${id}`, { body: data, token: auth() }),
      remove: (id) => this.request('DELETE', `${prefix}/${id}`, { token: auth() }),
      toggleStatus: (id) => this.request('PATCH', `${prefix}/${id}/status`, { token: auth() }),
    };
  },
};

// Usage
const vehicles = apiClient.service('vehicles');
const data = await vehicles.list({ condition: 'new', city: 'bengaluru' });
// data.data.items -> array, data.data.pagination -> meta
```

### What an LLM Should Know

| Rule | Detail |
|------|--------|
| **Service name = URL segment** | `'vehicles'` → `/api/product/vehicles`, `'properties'` → `/api/product/properties` |
| **Single item is always `data.item`** | Never `data.vehicle`, `data.property`, or `data.product` |
| **List is always `data.items`** | With `data.pagination` alongside |
| **Error is always `data.errors`** | Array of `{ field, message }` |
| **Auth token** | Stored as `accessToken` from login response, sent as `Bearer` header |
| **Image uploads (properties)** | Use `FormData` with `images` field, POST without `Content-Type` header (let browser set multipart) |
| **CRUD on any module** | Same 8 operations — only the `serviceName` changes |
| **Query filters** | Pass as flat `{ key: value }` — backend handles `*Min`/`*Max` for ranges |

### Tips for LLM Code Generation

1. **Never hardcode service-specific response keys.** Always destructure `data.item` or `data.items` — this works for vehicles, properties, garments, etc.
2. **Use a factory pattern** (like `apiClient.service(name)` above) so adding a new category requires only changing the string.
3. **For property image uploads**, the backend expects `multipart/form-data` with field name `images`. Other services accept image URLs as JSON strings in an `images` array.
4. **Vehicle `brand` field** also accepts `make` as an alias (the add-listing form sends `make`).
5. **Pagination** is always available on list endpoints — use `data.pagination.hasNextPage` to decide whether to show "Load More".
