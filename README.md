# OneVishwam E-Commerce — Backend

## Project Overview
Node.js + Express + MongoDB (Mongoose) backend for the OneVishwam multi-service platform.

## Tech Stack
- Node.js 18+, Express
- MongoDB + Mongoose
- JWT authentication (access + refresh tokens)
- Express-validator, Multer (uploads)
- Custom async handler + API response/error classes

## Development
```bash
npm install
npm run dev        # Start with nodemon (port 5001)
npm start          # Production start
```

## Environment (.env)
```
PORT=5001
MONGODB_URI=mongodb://localhost:27017/onevishwam
JWT_SECRET=...
JWT_REFRESH_SECRET=...
JWT_EXPIRE=15m
JWT_REFRESH_EXPIRE=7d
```

## 🔒 Operational Constraints (Mandatory)
- **No user creation/deletion** without explicit user permission
- **No code pushes** (git push, PR creation, deployments) without explicit user permission
- All changes require review and approval before any remote operations

## Project Structure
```
├── server.js              # Entry point
├── routes/
│   ├── index.js           # Mounts /api -> route modules
│   ├── auth.js            # /auth (login, register, refresh, etc.)
│   ├── product.js         # /api/product/:module (dynamic)
│   └── ...
├── modules/               # Feature modules (each: model, controller, routes, validator)
│   ├── properties/
│   ├── vehicles/
│   ├── jewellery/
│   ├── finance/
│   ├── groceries/
│   └── garments/
├── models/                # Cross-module models (User, LoanProduct, Enquiry, Review, Otp)
├── middleware/
│   ├── auth.js            # protect, authorize
│   ├── validate.js        # express-validator wrapper
│   └── upload.js          # multer config
├── utils/
│   ├── ApiResponse.js
│   ├── ApiError.js
│   └── asyncHandler.js
├── scripts/               # Seed scripts
│   ├── seedFinance.js     # 14 finance services
│   ├── seedProperties.js  # 9 properties
│   ├── seedVehicles.js    # 8 vehicles
│   ├── seedJewellery.js   # 8 jewellery items
│   └── seedLoans.js       # 5 loan products
└── config/                # DB, cloudinary, etc.
```

## API Endpoints (Base: `/api`)

### Auth (`/auth`)
| Method | Endpoint | Auth |
|--------|----------|------|
| POST | `/login` | No |
| POST | `/register` | No |
| POST | `/refresh` | No |
| GET | `/me` | Yes |
| PUT | `/profile` | Yes |
| PUT | `/password` | Yes |

### Products (`/product/:module`)
Each module exposes identical CRUD:
| Method | Endpoint | Auth |
|--------|----------|------|
| GET | `/` | No |
| GET | `/my` | Yes |
| GET | `/:id` | No |
| GET | `/:id/similar` | No |
| POST | `/` | Yes |
| PUT | `/:id` | Yes |
| DELETE | `/:id` | Yes |
| PATCH | `/:id/status` | Yes |

Modules: `properties`, `vehicles`, `jewellery`, `finance`, `groceries`, `garments`

### Loans (`/loans`)
| Method | Endpoint | Auth |
|--------|----------|------|
| GET | `/` | No |

### Public (`/`)
| Method | Endpoint | Auth |
|--------|----------|------|
| POST | `/enquiries` | No |
| POST | `/reviews` | No |

## Response Envelope
```json
// Success (list)
{ "success": true, "message": "...", "data": { "items": [...], "pagination": {...} } }

// Success (single)
{ "success": true, "message": "...", "data": { "item": {...} } }

// Error
{ "success": false, "message": "...", "errors": { "field": "..." } }
```

## Filtering & Sorting (Query Params)
All product modules support:
- `category`, `search` (maps to `q`)
- `budgetMin`, `budgetMax` (or `priceMin`/`priceMax`)
- `sortBy` / `sort` — `latest`, `price-low`, `price-high`
- `page`, `limit` (max 100)
- Module-specific filters (metals, occasions, weight, genders, availability, etc.)

## Seed Data
```bash
node scripts/seedFinance.js
node scripts/seedProperties.js
node scripts/seedVehicles.js
node scripts/seedJewellery.js
node scripts/seedLoans.js
```

All seeded records use unified contact:
- **Phone:** `9364862542`
- **Email:** `ceo@onevishwam.com`

## Branch
- Main development: `feature/products`