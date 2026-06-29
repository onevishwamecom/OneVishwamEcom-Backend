# OneVishwam Backend Infrastructure Blueprint

## Tech Stack
- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** MongoDB with Mongoose ODM
- **Auth:** JWT (jsonwebtoken + bcryptjs)
- **File Upload:** Multer
- **Validation:** express-validator
- **Security:** Helmet, CORS, rate-limit

---

## 1. Directory Structure

```
backend/
├── server.js                      # Entry point
├── package.json
├── .env                           # Environment variables (gitignored)
├── .env.example                   # Template for env vars
│
├── config/
│   ├── db.js                      # MongoDB connection logic
│   └── constants.js               # App-wide constants (categories, statuses, enums)
│
├── models/
│   ├── User.js                    # User account model
│   ├── Listing.js                 # Generic listing model (polymorphic via category)
│   ├── Enquiry.js                 # Contact/enquiry messages
│   ├── LoanProduct.js             # Loan/financial product model
│   └── Review.js                  # User reviews on listings
│
├── routes/
│   ├── index.js                   # Route aggregator — mounts all sub-routers
│   ├── auth.js                    # POST /register, /login, /forgot-password
│   ├── users.js                   # GET/PUT /profile, /listings
│   ├── listings.js                # CRUD for all listing categories
│   ├── enquiries.js               # POST /enquiries
│   ├── loans.js                   # GET loan products, POST loan requests
│   ├── upload.js                  # POST /upload (single & multiple)
│   ├── reviews.js                 # CR for reviews
│   └── public.js                  # GET categories, locations (no auth)
│
├── controllers/
│   ├── authController.js
│   ├── userController.js
│   ├── listingController.js
│   ├── enquiryController.js
│   ├── loanController.js
│   ├── uploadController.js
│   ├── reviewController.js
│   └── publicController.js
│
├── middleware/
│   ├── auth.js                    # JWT verification middleware
│   ├── errorHandler.js            # Global error handler
│   ├── validate.js                # express-validator runner
│   └── upload.js                  # Multer configuration
│
├── validators/
│   ├── authValidator.js           # Register/login validation rules
│   ├── listingValidator.js        # Listing create/update rules
│   └── enquiryValidator.js        # Enquiry form rules
│
└── utils/
    ├── ApiError.js                # Custom error class (statusCode, message)
    ├── ApiResponse.js             # Standardized response wrapper
    └── asyncHandler.js            # try/catch wrapper for controllers
```

---

## 2. Database Schema Design

### 2.1 Users

```javascript
// models/User.js
{
  name:          { type: String, required: true, trim: true },
  email:         { type: String, required: true, unique: true, lowercase: true },
  mobile:        { type: String, required: true, unique: true },
  password:      { type: String, required: true, select: false },
  role:          { type: String, enum: ['user', 'admin'], default: 'user' },
  avatar:        { type: String, default: '' },
  savedListings: [{ type: mongoose.Types.ObjectId, ref: 'Listing' }],
  createdAt:     { type: Date, default: Date.now },
  updatedAt:     { type: Date, default: Date.now }
}
// Indexes: email (unique), mobile (unique)
// Pre-save hook: bcrypt hash password
// Instance method: comparePassword(candidate)
```

### 2.2 Listings (Polymorphic — single collection for all categories)

```javascript
// models/Listing.js
{
  // --- Core fields ---
  title:        { type: String, required: true, trim: true },
  description:  { type: String, required: true },
  category:     { type: String, enum: ['real-estate', 'vehicle', 'garment', 'grocery', 'jewellery', 'service'], required: true },
  price:        { type: Number, required: true, min: 0 },
  currency:     { type: String, default: 'INR' },
  images:       [{ type: String }],                    // Array of URLs
  status:       { type: String, enum: ['active', 'pending', 'sold', 'inactive'], default: 'active' },

  // --- Owner ---
  user:         { type: mongoose.Types.ObjectId, ref: 'User', required: true },
  contact:      { type: String, required: true },

  // --- Location ---
  city:         { type: String, required: true },
  area:         { type: String, required: true },

  // --- Category-specific details (embedded) ---
  details: {
    // real-estate:
    propertyType: { type: String, enum: ['Apartment', 'House', 'Villa', 'Plot', 'Commercial'] },
    bedrooms:     { type: String },                     // "1 BHK", "2 BHK", etc.
    area_sqft:    { type: Number },

    // vehicle:
    brand:        { type: String },
    model:        { type: String },
    year:         { type: Number },
    fuelType:     { type: String },
    mileage:      { type: Number },

    // garment:
    size:         { type: String, enum: ['XS','S','M','L','XL','XXL','Free Size'] },
    color:        { type: String },
    fabric:       { type: String },

    // grocery:
    quantity:     { type: Number },
    unit:         { type: String, enum: ['Kg','Liter','Piece','Pack','Dozen'] },

    // jewellery:
    material:     { type: String },
    weight:       { type: Number },

    // service:
    serviceType:  { type: String },
    experience:   { type: Number },
  },

  // --- Listing meta ---
  views:        { type: Number, default: 0 },
  isFeatured:   { type: Boolean, default: false },
  loanApproved: { type: Boolean, default: false },
  expiresAt:    { type: Date },

  createdAt:    { type: Date, default: Date.now },
  updatedAt:    { type: Date, default: Date.now }
}
// Indexes: category + status (compound), city + category, user, price, createdAt
// Text index: title + description
```

### 2.3 Enquiries

```javascript
// models/Enquiry.js
{
  listing:    { type: mongoose.Types.ObjectId, ref: 'Listing', default: null },
  loanType:   { type: String, default: null },         // For loan enquiries
  name:       { type: String, required: true },
  email:      { type: String, required: true },
  mobile:     { type: String, required: true },
  message:    { type: String, required: true },
  isRead:     { type: Boolean, default: false },
  createdAt:  { type: Date, default: Date.now }
}
```

### 2.4 Loan Products

```javascript
// models/LoanProduct.js
{
  name:           { type: String, required: true },
  icon:           { type: String, default: '' },
  subtitle:       { type: String },
  description:    { type: String },
  interestRate:   { type: String },
  processingFee:  { type: String },
  maxAmount:      { type: String },
  tenure:         { type: String },
  isActive:       { type: Boolean, default: true },
  createdAt:      { type: Date, default: Date.now }
}
```

### 2.5 Reviews

```javascript
// models/Review.js
{
  listing:   { type: mongoose.Types.ObjectId, ref: 'Listing', required: true },
  user:      { type: mongoose.Types.ObjectId, ref: 'User', required: true },
  rating:    { type: Number, min: 1, max: 5, required: true },
  comment:   { type: String, trim: true },
  createdAt: { type: Date, default: Date.now }
}
// Index: listing + user (unique compound) — one review per user per listing
```

---

## 3. API Endpoints

### 3.1 Authentication (`/api/auth`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/register` | No | Register new user |
| POST | `/login` | No | Login, returns JWT |
| GET  | `/me` | Yes | Get current user profile |
| PUT  | `/me` | Yes | Update profile |

**POST /register**
```json
// Request
{ "name": "Tejas", "email": "tejas@example.com", "mobile": "9876543210", "password": "secret123" }

// Response
{ "success": true, "data": { "token": "jwt...", "user": { "id": "...", "name": "Tejas", "email": "..." } } }
```

**POST /login**
```json
// Request
{ "email": "tejas@example.com", "password": "secret123" }

// Response (same as register)
{ "success": true, "data": { "token": "jwt...", "user": { ... } } }
```

### 3.2 Listings (`/api/listings`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | No | List all public listings (paginated, filterable) |
| GET | `/:id` | No | Get single listing details |
| POST | `/` | Yes | Create a new listing |
| PUT | `/:id` | Yes | Update own listing |
| DELETE | `/:id` | Yes | Delete own listing |
| GET | `/user/me` | Yes | Get current user's listings |
| PUT | `/:id/status` | Yes | Update listing status (sold/inactive) |

**GET /api/listings?category=vehicle&city=bengaluru&minPrice=100000&maxPrice=500000&page=1&limit=20&sort=-createdAt**
- Query params: `category`, `city`, `area`, `minPrice`, `maxPrice`, `status`, `q` (search), `page`, `limit`, `sort`
- Returns paginated results with `total`, `page`, `pages`

**POST /api/listings**
```json
// Request (multipart/form-data or JSON with image URLs)
{
  "title": "3 BHK Apartment for Sale",
  "description": "Spacious 3 BHK in Koramangala",
  "category": "real-estate",
  "price": 8500000,
  "city": "bengaluru",
  "area": "Koramangala",
  "contact": "9876543210",
  "images": ["url1.jpg", "url2.jpg"],
  "details": {
    "propertyType": "Apartment",
    "bedrooms": "3 BHK",
    "area_sqft": 1500
  }
}

// Response
{ "success": true, "data": { "listing": { ... } } }
```

### 3.3 Uploads (`/api/upload`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/` | Yes | Upload single image (max 5MB) |
| POST | `/multiple` | Yes | Upload up to 6 images |
| DELETE | `/:filename` | Yes | Delete uploaded file |

### 3.4 Enquiries (`/api/enquiries`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/` | No | Submit enquiry about a listing or loan |

```json
// Request
{
  "listing": "60f7...",        // optional, for listing enquiries
  "loanType": "home-loan",     // optional, for loan enquiries
  "name": "Rajesh",
  "email": "rajesh@example.com",
  "mobile": "9876543210",
  "message": "I am interested in this property"
}
```

### 3.5 Loans (`/api/loans`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | No | Get all active loan products |
| GET | `/:id` | No | Get single loan product |
| POST | `/request` | No | Submit loan request (creates enquiry) |

### 3.6 Reviews (`/api/reviews`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/listing/:listingId` | No | Get reviews for a listing |
| POST | `/` | Yes | Add review to a listing (one per user per listing) |

### 3.7 Public Data (`/api/public`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/categories` | No | Get all categories and their fields |
| GET | `/locations` | No | Get all cities and areas |
| GET | `/stats` | No | Get site-wide counters (listings count per category) |

---

## 4. Middleware Pipeline

```javascript
// server.js — middleware order
1. helmet()                          // Security headers
2. cors({ origin: process.env.CORS_ORIGIN })
3. express.json({ limit: '10mb' })   // Body parser
4. morgan('dev')                     // Request logging
5. rateLimit({ windowMs: 15*60*1000, max: 100 })  // Rate limiting
6. Routes                            // /api/*
7. 404 handler                        // Unknown routes
8. errorHandler                       // Global error handler
```

### Auth Middleware (`middleware/auth.js`)
```javascript
// Extracts JWT from Authorization: Bearer <token>
// Verifies token, attaches req.user = { id, role }
// Two variants: protect (required) and optionalAuth (attaches if token present)
```

### Error Handler (`middleware/errorHandler.js`)
```javascript
// Handles:
// - ApiError instances → known status codes
// - Mongoose ValidationError → 400
// - Mongoose CastError (invalid ObjectId) → 400
// - Duplicate key error (code 11000) → 409
// - JWT errors → 401
// - Unknown errors → 500
// Returns: { success: false, message, stack (development only) }
```

---

## 5. Response Format

All API responses follow a consistent structure:

**Success:**
```json
{
  "success": true,
  "data": { ... },               // Single object or array
  "total": 100,                  // Only for paginated lists
  "page": 1,
  "pages": 5
}
```

**Error:**
```json
{
  "success": false,
  "message": "Listing not found",
  "stack": "Error: ..."          // Only in development
}
```

---

## 6. Authentication Flow

```
Register/Login
    │
    ▼
Validate input (express-validator)
    │
    ▼
Mongoose operation (create/find user)
    │
    ▼
Generate JWT (jsonwebtoken.sign)
  payload: { id: user._id, role: user.role }
  secret: process.env.JWT_SECRET
  expiresIn: process.env.JWT_EXPIRE
    │
    ▼
Return { token, user }
    │
    ▼
Frontend stores token in localStorage
Sends in Authorization: Bearer <token> header
```

**Password Flow:**
- Registration: bcrypt hash with salt rounds 12
- Login: bcrypt.compare
- Never return password in any response (`select: false` on schema)

---

## 7. File Upload Strategy

- **Library:** Multer
- **Storage:** Local disk (`uploads/` directory in development)
- **Allowed types:** image/jpeg, image/png, image/webp
- **Max file size:** 5MB per file
- **Naming:** `{timestamp}-{random}.{ext}` to avoid collisions
- **Serving:** Express static middleware on `/uploads`
- **Production:** Replace with Cloudinary/S3 upload (change only the storage engine)

---

## 8. Error Handling Strategy

| Layer | Mechanism |
|-------|-----------|
| Controller | `asyncHandler` wraps every controller function |
| Validation | `express-validator` rules + `validate` middleware |
| Mongoose | Schema validation, unique indexes, pre-save hooks |
| Business Logic | Throw `ApiError(statusCode, message)` for known failures |
| Unhandled | Global `errorHandler` middleware catches everything |
| Uncaught Promise | `process.on('unhandledRejection')` — graceful shutdown |

---

## 9. Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `5000` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/onevishwam` |
| `NODE_ENV` | Environment mode | `development` |
| `JWT_SECRET` | JWT signing secret | (required) |
| `JWT_EXPIRE` | Token expiry duration | `7d` |
| `MAX_FILE_SIZE` | Max upload size in bytes | `5242880` (5MB) |
| `UPLOAD_PATH` | Upload directory | `uploads` |
| `CORS_ORIGIN` | Allowed CORS origin | `http://localhost:5173` |

---

## 10. Deployment Ready Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Use strong `JWT_SECRET` (64+ chars)
- [ ] Replace local file upload with Cloudinary/S3
- [ ] Set up MongoDB Atlas (or production DB)
- [ ] Enable compression middleware
- [ ] Set up PM2 or Docker for process management
- [ ] Configure proper CORS origin
- [ ] Add request logging to file (not console)
- [ ] Set up database backups
- [ ] Add health check endpoint (`GET /api/health`)

---

## 11. NPM Dependencies

```json
{
  "express":       "^4.21.x",   // Web framework
  "mongoose":      "^8.9.x",    // MongoDB ODM
  "jsonwebtoken":  "^9.0.x",    // JWT auth
  "bcryptjs":      "^2.4.x",    // Password hashing
  "cors":          "^2.8.x",    // CORS headers
  "helmet":        "^8.0.x",    // Security headers
  "morgan":        "^1.10.x",   // Request logging
  "multer":        "^1.4.x",    // File uploads
  "dotenv":        "^16.4.x",   // Environment variables
  "express-rate-limit": "^7.5.x",  // Rate limiting
  "express-validator": "^7.2.x",   // Input validation
  "nodemon":       "^3.1.x"     // Dev auto-restart
}
```

---

## 12. Frontend Integration Points

The existing React frontend needs to replace these mock/data layers:

| Frontend File | Backend Endpoint |
|---------------|------------------|
| `store/authSlice.js` | `POST /api/auth/login`, `POST /api/auth/register` |
| `pages/add-listing/index.jsx` (submit) | `POST /api/listings` + `POST /api/upload` |
| `data/dummyProperties.js` | `GET /api/listings?category=real-estate` |
| `data/dummyAutomobiles.js` | `GET /api/listings?category=vehicle` |
| `data/dummyGarments.js` | `GET /api/listings?category=garment` |
| `data/dummyGrocery.js` | `GET /api/listings?category=grocery` |
| `data/dummyJewellery.js` | `GET /api/listings?category=jewellery` |
| `data/dummyLoans.js` | `GET /api/loans` |
| `pages/contact/EnquiryForm.jsx` | `POST /api/enquiries` |
| Hero location dropdown | `GET /api/public/locations` |

Migration strategy:
1. Add an `api.js` service layer (`src/services/api.js`) with Axios instance
2. Create React Query hooks or thunks for each data type
3. Replace direct data imports with API calls
4. Keep dummy data as fallback when API is unreachable

---

## 13. Controller Logic Patterns

### Listing Controller Pattern
```javascript
// getListings — Public, paginated, filtered
// 1. Build MongoDB query from query params
// 2. Apply text search if 'q' param present
// 3. Paginate with .skip().limit()
// 4. Return { success, data, total, page, pages }

// createListing — Protected
// 1. Validate input (express-validator)
// 2. Attach req.user._id as listing.user
// 3. listing.save()
// 4. Return 201 { success, data }

// updateListing — Protected, Owner only
// 1. Find listing by id
// 2. Check listing.user === req.user.id (or admin)
// 3. Update allowed fields
// 4. listing.save()
// 5. Return { success, data }
```

---

## 14. Seed Script

A `scripts/seed.js` file for populating development database:

```javascript
// 1. Connect to MongoDB
// 2. Drop existing collections
// 3. Create admin user (admin@onevishwam.com / admin123)
// 4. Create sample listings from dummy data (transform to Listing schema)
// 5. Create sample loan products
// 6. Disconnect
```

Run: `node scripts/seed.js`

---

*This blueprint serves as the complete architecture document for building the OneVishwam backend. Each section maps to a specific file or module in the `backend/` directory structure.*
