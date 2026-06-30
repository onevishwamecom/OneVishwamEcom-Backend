# OneVishwam Backend API

RESTful backend for the OneVishwam marketplace platform. Built with Node.js, Express, and MongoDB.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js |
| Framework | Express.js |
| Database | MongoDB + Mongoose |
| Auth | JWT (jsonwebtoken + bcryptjs) |
| OTP | 6-digit SHA-256 hashed, 5 min expiry, 5 attempts, 60s cooldown |
| Email | Brevo SMTP (nodemailer) |
| File Upload | Multer (local disk or Cloudinary) |
| Validation | express-validator |
| Rate Limiting | express-rate-limit |

---

## Architecture

### Module-based product types
Each product type (properties, vehicles, groceries, garments, jewellery, finance) is a self-contained folder under `modules/` with its own model, controller, routes, and optionally a service layer for complex logic.

```
GET /api/product/properties       → modules/properties/routes.js
GET /api/product/vehicles         → modules/vehicles/routes.js
```

The `modules/index.js` registry auto-mounts all modules.

### v1 API prefix
Auth and user endpoints use `/api/v1/` prefix. The property module also provides dedicated endpoints under `/api/v1/properties/` with richer functionality (featured, latest, similar, toggle status, my listings).

### Services layer
Business logic lives in `services/` (auth, user, OTP, email) or inside individual modules (propertyService). Controllers are thin — they parse the request, call the service, and send the response.

---

## Folder Structure

```
backend/
├── server.js                       # Entry point
├── package.json
├── .env / .env.example
│
├── config/
│   ├── db.js                       # MongoDB connection
│   ├── constants.js                # App-wide constants
│   ├── authConfig.js               # Password/OTP policy
│   └── cloudinary.js               # Cloudinary SDK setup
│
├── models/
│   ├── User.js                     # User account (fullName, mobile, email)
│   ├── Enquiry.js                  # Contact/enquiry
│   ├── LoanProduct.js              # Loan products
│   ├── Otp.js                      # OTP for password reset
│   └── Review.js                   # User reviews
│
├── services/
│   ├── authService.js              # Register, login, forgot/reset password, OTP flow
│   ├── userService.js              # Profile update with allowed fields whitelist
│   ├── otpService.js               # OTP generation, hashing, verification
│   └── emailService.js             # Brevo SMTP transport + dev console fallback
│
├── controllers/
│   ├── authController.js           # Thin — delegates to authService
│   ├── userController.js           # Profile update handler
│   └── publicController.js         # Loans, enquiries, reviews
│
├── modules/
│   ├── index.js                    # Module registry: { id, model, routes }[]
│   ├── baseController.js           # CRUD factory for standard modules
│   │
│   ├── properties/                 # Full-featured (service, controller, routes, validator)
│   ├── vehicles/                   # Standard CRUD via baseController
│   ├── groceries/                  # Standard CRUD via baseController
│   ├── garments/                   # Standard CRUD via baseController
│   ├── jewellery/                  # Standard CRUD via baseController
│   └── finance/                    # Standard CRUD via baseController
│
├── routes/
│   ├── index.js                    # Mounts all route groups
│   ├── auth.js                     # v1 auth routes (with rate limiting)
│   ├── users.js                    # v1 user profile route
│   ├── product.js                  # Auto-mounts all modules
│   ├── search.js                   # Global search
│   ├── upload.js                   # Image upload
│   ├── mylistings.js               # User listings across services
│   └── public.js                   # Loans, enquiries, reviews
│
├── validators/
│   ├── authValidator.js            # Register/login/OTP/reset validation
│   └── userValidator.js            # Profile update validation
│
├── middleware/
│   ├── auth.js                     # JWT verification (protect, optionalAuth, adminOnly)
│   ├── errorHandler.js             # Global error handler
│   ├── validate.js                 # express-validator runner
│   └── upload.js                   # Multer (local or Cloudinary)
│
├── utils/
│   ├── ApiError.js                 # Custom error class
│   ├── ApiResponse.js              # Standard response wrapper
│   └── asyncHandler.js             # Async controller wrapper
│
└── scripts/
    ├── seedProperties.js           # Seed 15 properties
    └── test-api.sh                 # API test script
```

---

## API Endpoints

### v1 Prefix Endpoints

| # | Method | Endpoint | Auth | Description |
|---|--------|----------|------|-------------|
| 1 | POST | `/api/v1/auth/register` | - | Register |
| 2 | POST | `/api/v1/auth/login` | - | Login (10 req/15min) |
| 3 | POST | `/api/v1/auth/logout` | Yes | Logout |
| 4 | POST | `/api/v1/auth/forgot-password` | - | Request OTP (20 req/15min) |
| 5 | POST | `/api/v1/auth/verify-otp` | - | Verify OTP (20 req/15min) |
| 6 | POST | `/api/v1/auth/resend-otp` | - | Resend OTP (20 req/15min) |
| 7 | POST | `/api/v1/auth/reset-password` | - | Reset password |
| 8 | GET | `/api/v1/auth/me` | Yes | Get profile |
| 9 | PUT | `/api/v1/users/profile` | Yes | Update profile (multipart) |
| 10 | GET | `/api/v1/properties` | - | List properties |
| 11 | GET | `/api/v1/properties/featured` | - | Featured properties |
| 12 | GET | `/api/v1/properties/latest` | - | Latest properties |
| 13 | GET | `/api/v1/properties/similar/:id` | - | Similar properties |
| 14 | GET | `/api/v1/properties/:id` | Opt | Single property |
| 15 | GET | `/api/v1/properties/my` | Yes | My properties |
| 16 | POST | `/api/v1/properties` | Yes | Create property |
| 17 | PUT | `/api/v1/properties/:id` | Yes | Update property |
| 18 | DELETE | `/api/v1/properties/:id` | Yes | Soft-delete property |
| 19 | PATCH | `/api/v1/properties/:id/status` | Yes | Toggle status |
| 20 | POST | `/api/v1/property-requirements` | Opt | Submit requirement |
| 21 | GET | `/api/v1/property-requirements/me` | Yes | My requirements |

### Product CRUD — `/api/product/:service`

All 6 services (`properties`, `vehicles`, `groceries`, `garments`, `jewellery`, `finance`):

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/product/:service` | - | List (paginated, filterable, sortable) |
| GET | `/api/product/:service/:id` | - | Single item |
| POST | `/api/product/:service` | Yes | Create |
| PUT | `/api/product/:service/:id` | Yes | Update (owner/admin) |
| DELETE | `/api/product/:service/:id` | Yes | Delete |

### Cross-Cutting

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/search?q=` | - | Global search |
| POST | `/api/upload/images` | Yes | Upload images |
| GET | `/api/wishlist` | Yes | Get wishlist |
| POST | `/api/wishlist` | Yes | Add to wishlist |
| DELETE | `/api/wishlist/:id` | Yes | Remove from wishlist |
| POST | `/api/requirements` | Opt | Submit requirement |
| GET | `/api/requirements` | Admin | List requirements |
| GET | `/api/mylistings` | Yes | My listings |

### Public

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/loans` | Get loan products |
| POST | `/api/enquiries` | Submit enquiry |
| POST | `/api/reviews` | Submit review |
| GET | `/api/users/:userId/reviews` | Get user reviews |

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Server health check |

---

## Property Model

60+ fields matching the frontend spec. Key auto-computed fields:

| Field | Source | Logic |
|-------|--------|-------|
| `numericPrice` | `price` | Parses `₹ 3.75 L` → `375000`, `₹ 1.5 Cr` → `15000000` |
| `numericArea` | `area` | Parses `1500 Sq.Ft.`, `5 Acre` → numeric value |

Full field list: `modules/properties/model.js`

### Property Filtering — `GET /api/v1/properties`

| Param | Type | Example |
|-------|------|---------|
| `q` | String | Keyword search |
| `sort` | String | `latest`, `oldest`, `price-low`, `price-high`, `area-low`, `area-high`, `viewed` |
| `city`, `area`, `propertyType`, `purpose`, `category` | String | Direct match |
| `priceMin` / `priceMax` | Number | Price range |
| `areaMin` / `areaMax` | Number | Area range |
| `bedrooms` | Number | Bedroom count |
| `amenities` | CSV | All must match |
| `listedWithin` | String | `Today`, `Last 3 Days`, `Last 7 Days`, `Last 30 Days` |
| `page` / `limit` | Number | Pagination |

---

## Setup

```bash
# 1. Install
npm install

# 2. Configure
cp .env.example .env
# Edit .env with MongoDB URI, JWT secrets, Brevo SMTP, etc.

# 3. Seed property data
node scripts/seedProperties.js

# 4. Start
npm run dev     # Development (nodemon, port 5001)
npm start       # Production
```

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 5000 |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/onevishwam` |
| `NODE_ENV` | Environment mode | `development` |
| `JWT_SECRET` | JWT signing secret | — |
| `JWT_ACCESS_EXPIRE` | Access token expiry | `15m` |
| `CORS_ORIGIN` | Allowed CORS origins | Allow all in dev |
| `MAX_FILE_SIZE` | Max upload size (bytes) | 5MB |
| `UPLOAD_PATH` | Local upload directory | `uploads` |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name | — |
| `CLOUDINARY_API_KEY` | Cloudinary API key | — |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | — |
| `BREVO_SMTP_HOST` | Brevo SMTP host | `smtp-relay.brevo.com` |
| `BREVO_SMTP_PORT` | Brevo SMTP port | `587` |
| `BREVO_SMTP_USER` | Brevo SMTP login | — |
| `BREVO_SMTP_PASS` | Brevo SMTP password | — |
| `BREVO_FROM_EMAIL` | Sender email address | — |
| `BREVO_FROM_NAME` | Sender name | `OneVishwam` |

---

## Error Handling

Centralized via `middleware/errorHandler.js`:

| Error Type | Status |
|-----------|--------|
| ApiError (known) | Custom status |
| Mongoose ValidationError | 400 |
| Mongoose CastError (bad ObjectId) | 400 |
| Duplicate key (code 11000) | 409 |
| JsonWebTokenError | 401 |
| TokenExpiredError | 401 |
| Multer (file too large) | 400 |
| Unknown | 500 |
