# OneVishwam Backend Architecture & File Structure Audit

**Project Path:** `d:\onevishwam\OneVishwamEcom-Backend`  
**Audit Date:** November 14, 2026  
**Status:** ✅ Fully Modularized, Schema-Driven, Production-Ready  
**Branch:** `fix/post-deployment`

---

## 1. Executive Architectural Overview

The **OneVishwam Backend** implements a production-grade, **Schema-Driven Hybrid Modular Architecture** that combines **Zero-Boilerplate for Simple Sectors** with **Extensible Lifecycle Hooks for Complex Sectors**.

* **Philosophy**: Adding a simple marketplace sector (e.g., groceries, furniture, apparel) requires only defining a Mongoose `model.js` and a metadata `config.js`. Complex sectors (e.g., real estate, finance) extend standard behavior using `service.js` (lifecycle hooks, custom business logic) and `routes.js` (custom endpoints like floorplans and map resolvers).
* **Runtime & Framework:** Node.js (v22+) + Express.js
* **Database Layer:** MongoDB Atlas (Mongoose ORM) with connection-pooling safeguards (`minPoolSize: 0`, `maxIdleTimeMS: 30000`) and offline local fallback
* **Authentication:** Firebase Admin SDK (`RS256` ID token verification) + legacy JWT fallback
* **API Documentation:** OpenAPI 3.0 (Swagger UI at `/api-docs` and JSON spec at `/api-docs.json`) with 80 documented paths across 7 unified tags

```mermaid
flowchart TD
    Client["Client (Web / Mobile / Lister / Admin)"] --> Gateway["Dynamic Sector Gateway (routes/product.js & routes/index.js)"]

    subgraph CrossCutting["Cross-Cutting Infrastructure (routes/)"]
        Auth["/auth, /v1/auth (authController.js)"]
        Upload["/upload (upload.js / Multer MemoryStorage)"]
        Search["/search (search.js)"]
        Homepage["/homepage (homepage.js + LRU Cache)"]
        Admin["/admin (adminController.js)"]
        Visitors["/visitors (visitorController.js)"]
        Bulk["/bulk-listing (bulkListingController.js)"]
    end

    subgraph MasterRegistry["Master Sector Registry (modules/index.js)"]
        Loader["Auto-Discovery Loader (reads model.js, config.js, service.js, routes.js)"]
    end

    subgraph DomainModules["Domain Modules (modules/)"]
        direction TB
        SimpleSectors["Simple Sectors (100% Config-Driven)<br/>• groceries (model.js + config.js)<br/>• garments (model.js + config.js)"]
        ComplexSectors["Complex Sectors (Config + Service + Custom Routes)<br/>• properties (model + config + service + routes + requirements)<br/>• vehicles (model + config + service + routes)<br/>• finance & finance-offerings (model + config + service + routes)<br/>• electronics & bedding (model + config + service + routes)<br/>• jewellery (model + config + service + routes)"]
    end

    Gateway --> CrossCutting
    Gateway --> MasterRegistry
    MasterRegistry --> DomainModules
    DomainModules --> BaseEngine["Universal BaseController Engine (CRUD + Hooks + Edge Cache)"]
    BaseEngine --> Database[("MongoDB Atlas")]
```

---

## 2. Directory Structure & Implementation Details

```text
OneVishwamEcom-Backend/
├── config/                  # Core system adapters (db, swagger, firebase, constants)
├── middleware/              # Global Express middleware (auth, errorHandler, validate)
├── modules/                 # Self-Contained Domain Modules (DDD)
│   ├── baseController.js    # Universal generic CRUD engine with lifecycle hooks
│   ├── index.js             # Master registry auto-loading all sector directories
│   ├── groceries/           # Simple Sector (100% Config-Driven)
│   │   ├── model.js         # Mongoose schema
│   │   └── config.js        # Metadata, search fields, validation rules
│   ├── garments/            # Simple Sector (100% Config-Driven)
│   │   ├── model.js         # Mongoose schema
│   │   └── config.js        # Metadata, search fields, validation rules
│   └── properties/          # Complex Sector (Config-Driven + Custom Extensions)
│       ├── model.js         # Mongoose schema
│       ├── config.js        # Metadata & rules
│       ├── service.js       # Business logic (maps resolver, brochures) + lifecycle hooks
│       ├── routes.js        # Dedicated custom endpoints (/floorplans, /map-resolver)
│       └── requirements.js  # Dedicated buyer lead intake
├── routes/                  # Cross-Cutting Infrastructure Only (Auth, Admin, Search, Homepage, Uploads, Product Gateway)
├── utils/                   # ApiError, ApiResponse, asyncHandler, lruCache
├── app.js                   # Express application setup
└── server.js                # HTTP server entry point
```

### 2.1 The Universal `BaseController` (`modules/baseController.js`)
Handles standard REST operations dynamically by inspecting the sector's Mongoose model and configuration manifest:
1. **`list` (also aliased as `getAll`)**: Supports pagination (`page`, `limit`), full-text search across `config.searchableFields` via regex, dynamic filtering against `config.filterableFields`, range filters (`minPrice`, `maxPrice`), sorting, and edge CDN cache headers (`setCache(30, 60, 120)`).
2. **`create`**: Attaches authenticated lister/user ID, validates payload against `config.validationRules`, handles file uploads (`req.files`), and executes lifecycle hooks `beforeCreate` and `afterCreate`.
3. **`getOne` (also aliased as `getById`)**: Fetches document by ID with population specified in `config.populate`.
4. **`update`**: Validates payload, verifies ownership or admin permissions, handles media file additions/replacements, and executes lifecycle hooks `beforeUpdate` and `afterUpdate`.
5. **`delete` (also aliased as `remove`)**: Checks ownership or admin rights, executes `beforeDelete` and `afterDelete` hooks, and performs soft delete (`isActive: false, status: 'deleted'`) or hard delete.
6. **`toggleStatus`**: Toggles active/inactive state.

### 2.2 Master Sector Registry (`modules/index.js`)
An auto-discovery loader that scans `modules/` at startup:
* Automatically loads each sector directory (`groceries`, `properties`, `vehicles`, `garments`, `jewellery`, `electronics`, `bedding`, `finance`, `finance-offerings`, `requirements`, `wishlist`).
* Reads `model.js`, `config.js`, optional `service.js`, and optional `routes.js`.
* If a sector doesn't provide a custom controller, automatically instantiates a `BaseController` using its configuration.
* Exports a unified map `{ groceries, properties, vehicles, ... }` with non-enumerable array methods (`.forEach`, `.map`, `.find`, `[Symbol.iterator]`) guaranteeing 100% zero-regression backward compatibility.

### 2.3 Dynamic Sector Gateway Router (`routes/product.js`)
Mounted at `/product/:sector`, `/products/:sector`, `/sectors/:sector`, and `/v1/sectors/:sector`:
1. **Lookup**: Resolves `:sector` (or aliases like `automobile` -> `vehicles`, `property` -> `properties`) against the master module registry. Returns `404` if invalid.
2. **Custom Route Precedence**: If the sector has its own `routes.js`, mounts and executes those custom endpoints *first*.
3. **Generic CRUD Fallback**: Standard REST operations (`GET`, `POST`, `PUT`, `DELETE`, `PATCH /status`) automatically handle any unhandled requests via `BaseController`.

---

## 3. Universal CRUD Operations Matrix Across All Categories

Every single marketplace category natively supports all 8 core operations:

| Category | List (`GET /`) | Get Single (`GET /:id`) | Create (`POST /`) | Update (`PUT & PATCH /:id`) | Delete (`DELETE /:id`) | Toggle Status (`PATCH /:id/status`) | My Listings (`GET /my`) | Similar Items (`GET /similar/:id`) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Properties** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Vehicles** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Groceries** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Garments** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Jewellery** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Electronics** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Bedding** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Finance** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Finance Offerings** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 4. Engineering Standards & Clean Architecture Verification

* **Zero Dead Code**: Removed proxy re-export files (`controllers/propertyController.js` and `models/Property.js`). All sector assets live 100% inside `modules/<sector>/`. All external imports updated to `modules/properties/model`.
* **Standardized Response Envelope**: Every successful response uses `ApiResponse`:
  ```json
  { "success": true, "message": "...", "data": { ... } }
  ```
* **Operational Error Handling**: Every controller is wrapped in `asyncHandler` and throws `ApiError` with structured status codes.
* **Database Resilience**: Configured in `config/db.js` with `minPoolSize: 0`, `maxIdleTimeMS: 30000`, and `serverSelectionTimeoutMS: 15000` to prevent cloud socket disconnects, with automatic local fallback (`127.0.0.1:27017`).
* **Authentication & RBAC**: `middleware/auth.js` enforces `protect`, `optionalAuth`, `adminOnly`, and `listerOnly` supporting both Firebase RS256 tokens and legacy JWTs.
