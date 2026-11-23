/**
 * OpenAPI 3 specification for the OneVishwam API.
 *
 * The base document (info, servers, shared schemas, security schemes, health
 * routes) lives here. Endpoint documentation is written as `@openapi` JSDoc
 * blocks directly above each Express route in `routes/` and `modules/`.
 *
 * Served by `app.js` at `/api-docs` (Swagger UI) and `/api-docs.json`.
 */
const path = require('path');
const swaggerJsdoc = require('swagger-jsdoc');

const toGlob = (...segments) => path.join(__dirname, ...segments).replace(/\\/g, '/');

// Sector modules sharing the generic Express route contract (`modules/<id>/routes.js`).
const PRODUCT_SERVICES = [
  'vehicles',
  'automobiles',
  'garments',
  'groceries',
  'jewellery',
  'electronics',
  'bedding',
  'finance',
];

// Everything the generic `/listings/:type` endpoints accept, including properties.
const LISTING_TYPES = [...PRODUCT_SERVICES, 'properties', 'finance-offerings'];

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'OneVishwam API',
      version: '1.0.0',
      description: [
        'REST API for the OneVishwam multi-sector marketplace (properties, vehicles,',
        'garments, groceries, jewellery, electronics, bedding, finance).',
        '',
        '**Response envelope:** every successful response is `{ success, message, data }`',
        '(`utils/ApiResponse.js`); every failure is `{ success, message, errors? }`',
        '(`middleware/errorHandler.js`).',
        '',
        '**Authentication:** send `Authorization: Bearer <token>` where a lock icon is shown.',
        'Protected routes accept either a Firebase ID token or a legacy JWT issued by `/auth/login`.',
      ].join('\n'),
    },
    servers: [
      { url: 'http://localhost:5001/api', description: 'Local development' },
      { url: 'https://asia-south1-onevishwam.cloudfunctions.net/api', description: 'Production (Cloud Functions)' },
    ],
    tags: [
      { name: 'Health', description: 'Service and database health checks' },
      { name: 'Auth', description: 'Registration, login, OTP password reset, profile and session management' },
      {
        name: 'Products',
        description:
          'Multi-sector marketplace products & listings (properties, vehicles, automobiles, garments, groceries, jewellery, electronics, bedding, finance)',
      },
      { name: 'Categories', description: 'Programmatic marketplace categories and ecosystem sectors registry' },
      { name: 'Listings', description: 'Seller listing CRUD' },
      { name: 'Wishlist', description: 'Saved listings' },
      { name: 'Uploads', description: 'Image uploads' },
      { name: 'Admin', description: 'Admin-only operations' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Legacy JWT returned by `POST /auth/login` or `POST /auth/refresh` (15m access token).',
        },
        firebaseAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'Firebase ID token',
          description: 'Firebase ID token obtained from the Firebase client SDK.',
        },
      },
      parameters: {
        ClientRole: {
          name: 'x-client-role',
          in: 'header',
          required: false,
          schema: { type: 'string', enum: ['user', 'lister'] },
          description: 'Selects which account collection is resolved. Defaults to `user`.',
        },
        SectorService: {
          name: 'service',
          in: 'path',
          required: true,
          schema: { type: 'string', enum: PRODUCT_SERVICES },
          description: 'Sector module id. Use the **Try it out** box to pick one.',
        },
        ListingType: {
          name: 'type',
          in: 'path',
          required: true,
          schema: { type: 'string', enum: LISTING_TYPES },
          description: 'Listing module id (properties included).',
        },
        ListingId: {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'MongoDB ObjectId of the listing.',
        },
      },
      schemas: {
        Success: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Success' },
            data: { nullable: true, description: 'Endpoint-specific payload.' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'Invalid email or password' },
            errors: {
              type: 'array',
              description: 'Present when the failure is a per-field validation error.',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string', example: 'email' },
                  message: { type: 'string', example: 'Valid email is required' },
                },
              },
            },
          },
        },
        Profile: {
          type: 'object',
          description: 'Normalized user or lister profile (`toProfileJSON` / `toListerJSON`).',
          properties: {
            id: { type: 'string', example: '65f1c2a9b3e4f5a6b7c8d9e0' },
            firebaseUid: { type: 'string', nullable: true },
            accountType: { type: 'string', enum: ['user', 'lister', 'admin'] },
            listerId: { type: 'string', nullable: true },
            name: { type: 'string', example: 'Asha Verma' },
            fullName: { type: 'string', example: 'Asha Verma' },
            email: { type: 'string', format: 'email' },
            phoneNumber: { type: 'string', example: '9876543210' },
            mobile: { type: 'string', example: '9876543210' },
            phone: { type: 'string', nullable: true },
            avatar: { type: 'string' },
            profileImage: { type: 'string' },
            role: { type: 'string', example: 'user' },
            city: { type: 'string' },
            area: { type: 'string' },
            pincode: { type: 'string' },
            isEmailVerified: { type: 'boolean' },
            phoneVerified: { type: 'boolean' },
            accountStatus: { type: 'string', example: 'active' },
            status: { type: 'string', example: 'active' },
            lastLogin: { type: 'string', format: 'date-time', nullable: true },
            lastActiveAt: { type: 'string', format: 'date-time', nullable: true },
            totalTimeSpent: { type: 'integer', description: 'Seconds.' },
            sessionDuration: { type: 'integer', description: 'Seconds.' },
            loginCount: { type: 'integer' },
            createdAt: { type: 'string', format: 'date-time' },
            notifications: {
              type: 'object',
              properties: {
                email: { type: 'boolean' },
                whatsapp: { type: 'boolean' },
              },
            },
          },
        },
        AuthSession: {
          type: 'object',
          properties: {
            accessToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIs...' },
            refreshToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIs...' },
            user: { $ref: '#/components/schemas/Profile' },
            lister: { $ref: '#/components/schemas/Profile' },
          },
        },
        Pagination: {
          type: 'object',
          properties: {
            page: { type: 'integer', example: 1 },
            limit: { type: 'integer', example: 20 },
            total: { type: 'integer', example: 137 },
            totalPages: { type: 'integer', example: 7 },
            hasNextPage: { type: 'boolean' },
            hasPreviousPage: { type: 'boolean' },
            currentPage: { type: 'integer', example: 1 },
          },
        },
        PropertyType: {
          type: 'string',
          enum: ['Residential', 'Flat', 'Independent House', 'Plot', 'Land', 'Agricultural', 'Commercial', 'Industrial'],
        },
        Property: {
          type: 'object',
          additionalProperties: true,
          description: 'A property document (`models/Property.js`). `details` is polymorphic and depends on `propertyType`.',
          properties: {
            _id: { type: 'string' },
            title: { type: 'string' },
            subtitle: { type: 'string' },
            description: { type: 'string' },
            propertyType: { $ref: '#/components/schemas/PropertyType' },
            purpose: { type: 'string', enum: ['Sell', 'Rent', 'Lease'] },
            category: { type: 'string', example: 'properties' },
            price: { type: 'string', example: '₹85,00,000' },
            numericPrice: { type: 'number', example: 8500000 },
            priceType: { type: 'string', example: 'fixed' },
            negotiable: { type: 'boolean' },
            city: { type: 'string', example: 'bengaluru' },
            area: { type: 'string', example: 'Whitefield' },
            pincode: { type: 'string', example: '560066' },
            address: { type: 'string' },
            landmark: { type: 'string' },
            mapUrl: { type: 'string' },
            contact: { type: 'string' },
            contactEmail: { type: 'string' },
            vendorName: { type: 'string' },
            channelPartnerName: { type: 'string' },
            bankLoanDetails: { type: 'string' },
            loanApproved: { type: 'boolean' },
            images: { type: 'array', items: { type: 'string', format: 'uri' } },
            videoUrl: { type: 'string' },
            pdfUrl: { type: 'string' },
            floorPlanImages: { type: 'array', items: { type: 'string', format: 'uri' } },
            documents: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  url: { type: 'string' },
                  filename: { type: 'string' },
                  fileType: { type: 'string' },
                },
              },
            },
            details: { type: 'object', additionalProperties: true, description: 'Category-specific fields (dimensions, bhk, amenities, surveyNumber, ...).' },
            status: {
              type: 'string',
              enum: ['pending', 'approved', 'rejected', 'active', 'changes-required', 'cancelled', 'inactive', 'sold', 'rented', 'deleted'],
              example: 'approved',
            },
            availabilityStatus: { type: 'string', enum: ['available', 'sold_out', 'inactive'] },
            featured: { type: 'boolean' },
            verified: { type: 'boolean' },
            priority: { type: 'integer' },
            viewsCount: { type: 'integer' },
            origin: { type: 'string', example: 'channel_partner_project' },
            listerId: { type: 'string' },
            contributor: { type: 'object', additionalProperties: true },
            createdBy: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        PropertyInput: {
          type: 'object',
          required: ['vendorName', 'channelPartnerName', 'propertyType', 'bankLoanDetails'],
          properties: {
            title: { type: 'string', maxLength: 200 },
            subtitle: { type: 'string' },
            description: { type: 'string' },
            propertyType: { $ref: '#/components/schemas/PropertyType' },
            purpose: { type: 'string', enum: ['Sell', 'Rent', 'Lease'] },
            price: { type: 'string' },
            numericPrice: { type: 'number' },
            priceType: { type: 'string' },
            negotiable: { type: 'boolean' },
            city: { type: 'string' },
            area: { type: 'string' },
            pincode: { type: 'string', pattern: '^\\d{6}$' },
            address: { type: 'string' },
            landmark: { type: 'string' },
            mapUrl: { type: 'string' },
            contact: { type: 'string' },
            contactEmail: { type: 'string', format: 'email' },
            vendorName: { type: 'string' },
            channelPartnerName: { type: 'string' },
            bankLoanDetails: { type: 'string' },
            loanApproved: { type: 'boolean' },
            images: {
              type: 'array',
              maxItems: 10,
              items: { type: 'string', description: 'Binary file in multipart requests, URL in JSON requests.' },
            },
            videoUrl: { type: 'string' },
            details: { type: 'object', additionalProperties: true, description: 'Category-specific fields required by the property type.' },
            documents: { type: 'array', items: { type: 'object', additionalProperties: true } },
          },
        },
        SectorListing: {
          type: 'object',
          additionalProperties: true,
          description: 'A vehicle / garment / grocery / jewellery / electronics / bedding / finance document. Field availability varies by sector.',
          properties: {
            _id: { type: 'string' },
            title: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            category: { type: 'string' },
            subcategory: { type: 'string' },
            brand: { type: 'string' },
            model: { type: 'string' },
            year: { type: 'integer' },
            condition: { type: 'string' },
            metalType: { type: 'string' },
            wheelerType: { type: 'string' },
            price: { type: 'string' },
            numericPrice: { type: 'number' },
            priceType: { type: 'string' },
            city: { type: 'string' },
            area: { type: 'string' },
            location: { type: 'string' },
            pincode: { type: 'string' },
            images: { type: 'array', items: { type: 'string', format: 'uri' } },
            videos: { type: 'array', items: { type: 'string', format: 'uri' } },
            videoUrl: { type: 'string' },
            documents: { type: 'array', items: { type: 'string' } },
            status: {
              type: 'string',
              enum: ['pending', 'approved', 'changes-required', 'cancelled', 'rejected', 'active', 'inactive', 'deleted'],
            },
            availabilityStatus: { type: 'string', enum: ['available', 'sold_out', 'inactive'] },
            featured: { type: 'boolean' },
            verified: { type: 'boolean' },
            viewsCount: { type: 'integer' },
            contributor: { type: 'object', additionalProperties: true },
            listerId: { type: 'string' },
            createdBy: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        WishlistEntry: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            user: { type: 'string' },
            item: { type: 'string', description: 'ObjectId of the saved listing.' },
            serviceType: { type: 'string', example: 'vehicles' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
      },
      responses: {
        BadRequest: {
          description: 'Validation failed or malformed request',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        Unauthorized: {
          description: 'Missing, invalid or expired token',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        Forbidden: {
          description: 'Authenticated but not allowed (e.g. suspended account)',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        NotFound: {
          description: 'Resource not found',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        Conflict: {
          description: 'Duplicate value (email / mobile already registered)',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        TooManyRequests: {
          description: 'Rate limit exceeded',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        ServiceUnavailable: {
          description: 'Database connection unavailable',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
      },
    },
    // Health endpoints are declared in app.js, so they are documented here.
    paths: {
      '/health': {
        get: {
          tags: ['Health'],
          summary: 'Liveness check',
          description: 'Returns 200 as soon as the Express app is serving. Does not touch the database.',
          responses: {
            200: {
              description: 'API process is up',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      message: { type: 'string', example: 'OneVishwam API is running' },
                      timestamp: { type: 'string', format: 'date-time' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/health/db': {
        get: {
          tags: ['Health'],
          summary: 'Database readiness check',
          description: 'Connects to MongoDB and pings it. Returns 503 when the database is unreachable.',
          responses: {
            200: {
              description: 'Database is connected',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      status: { type: 'string', example: 'active' },
                      database: { type: 'string', example: 'connected' },
                      host: { type: 'string' },
                      timestamp: { type: 'string', format: 'date-time' },
                    },
                  },
                },
              },
            },
            503: { $ref: '#/components/responses/ServiceUnavailable' },
          },
        },
      },
    },
  },
  apis: [toGlob('../routes/*.js'), toGlob('../modules/*/routes.js')],
};

// ─── Products: generated shared paths ──────────────────────────────────────────
// Every sector module exposes the same contract, so the paths are generated once
// instead of repeating seven near-identical `@openapi` blocks. `{service}` is a
// real OpenAPI path parameter, so Swagger UI renders a selector for it.
const successWith = (dataSchema) => ({
  allOf: [
    { $ref: '#/components/schemas/Success' },
    { type: 'object', properties: { data: dataSchema } },
  ],
});

const sectorRef = { $ref: '#/components/schemas/SectorListing' };
const sectorListData = {
  type: 'object',
  properties: {
    items: { type: 'array', items: sectorRef },
    pagination: { $ref: '#/components/schemas/Pagination' },
  },
};
const sectorItemData = { type: 'object', properties: { item: sectorRef } };

const sectorSecurity = [{ bearerAuth: [] }, { firebaseAuth: [] }];

const sectorPaths = {
  '/product/{service}': {
    get: {
      tags: ['Products'],
      summary: 'List sector listings',
      description: 'Public paginated listing for one sector. Extra query parameters are applied as exact-match filters.',
      parameters: [
        { $ref: '#/components/parameters/SectorService' },
        { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Search over the sector search fields.' },
        { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
        { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
        { name: 'sort', in: 'query', schema: { type: 'string', enum: ['latest', 'oldest', 'price-low', 'price-high'], default: 'latest' } },
        { name: 'priceMin', in: 'query', schema: { type: 'number' } },
        { name: 'priceMax', in: 'query', schema: { type: 'number' } },
        { name: 'city', in: 'query', schema: { type: 'string' } },
      ],
      responses: {
        200: { description: 'Paginated listings', content: { 'application/json': { schema: successWith(sectorListData) } } },
        503: { $ref: '#/components/responses/ServiceUnavailable' },
      },
    },
    post: {
      tags: ['Products'],
      summary: 'Create a sector listing',
      description: 'Accepts JSON or `multipart/form-data` (`images`, up to 10). The status is forced to `pending` until an admin approves it.',
      security: sectorSecurity,
      requestBody: {
        required: true,
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/SectorListing' } },
          'multipart/form-data': { schema: { $ref: '#/components/schemas/SectorListing' } },
        },
      },
      responses: {
        201: { description: 'Created (pending approval)', content: { 'application/json': { schema: successWith(sectorItemData) } } },
        400: { $ref: '#/components/responses/BadRequest' },
        401: { $ref: '#/components/responses/Unauthorized' },
      },
    },
  },
  '/product/{service}/my': {
    get: {
      tags: ['Products'],
      summary: 'List my sector listings',
      security: sectorSecurity,
      parameters: [{ $ref: '#/components/parameters/SectorService' }],
      responses: {
        200: {
          description: 'Listings owned by the caller',
          content: {
            'application/json': {
              schema: successWith({ type: 'object', properties: { items: { type: 'array', items: sectorRef } } }),
            },
          },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
      },
    },
  },
  '/product/{service}/similar/{id}': {
    get: {
      tags: ['Products'],
      summary: 'Similar sector listings',
      description: 'Implemented for `vehicles`, `finance` and `jewellery`.',
      parameters: [{ $ref: '#/components/parameters/SectorService' }, { $ref: '#/components/parameters/ListingId' }],
      responses: {
        200: {
          description: 'Similar listings (max 4)',
          content: {
            'application/json': {
              schema: successWith({ type: 'object', properties: { items: { type: 'array', items: sectorRef } } }),
            },
          },
        },
        404: { $ref: '#/components/responses/NotFound' },
      },
    },
  },
  '/product/{service}/{id}': {
    get: {
      tags: ['Products'],
      summary: 'Get one sector listing',
      parameters: [{ $ref: '#/components/parameters/SectorService' }, { $ref: '#/components/parameters/ListingId' }],
      responses: {
        200: { description: 'Listing', content: { 'application/json': { schema: successWith(sectorItemData) } } },
        404: { $ref: '#/components/responses/NotFound' },
      },
    },
    put: {
      tags: ['Products'],
      summary: 'Update a sector listing',
      description: 'Owner or admin only. Accepts JSON or multipart (`images`).',
      security: sectorSecurity,
      parameters: [{ $ref: '#/components/parameters/SectorService' }, { $ref: '#/components/parameters/ListingId' }],
      requestBody: {
        required: true,
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/SectorListing' } },
          'multipart/form-data': { schema: { $ref: '#/components/schemas/SectorListing' } },
        },
      },
      responses: {
        200: { description: 'Updated listing', content: { 'application/json': { schema: successWith(sectorItemData) } } },
        400: { $ref: '#/components/responses/BadRequest' },
        401: { $ref: '#/components/responses/Unauthorized' },
        403: { $ref: '#/components/responses/Forbidden' },
        404: { $ref: '#/components/responses/NotFound' },
      },
    },
    delete: {
      tags: ['Products'],
      summary: 'Delete a sector listing',
      description: 'Owner or admin only. Removes the document and its uploaded media.',
      security: sectorSecurity,
      parameters: [{ $ref: '#/components/parameters/SectorService' }, { $ref: '#/components/parameters/ListingId' }],
      responses: {
        200: { description: 'Deleted', content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } } },
        401: { $ref: '#/components/responses/Unauthorized' },
        403: { $ref: '#/components/responses/Forbidden' },
        404: { $ref: '#/components/responses/NotFound' },
      },
    },
  },
  '/product/{service}/{id}/status': {
    patch: {
      tags: ['Products'],
      summary: 'Toggle listing status',
      description: 'Owner or admin only. Implemented for `vehicles`, `finance` and `jewellery` — flips `active` ↔ `inactive`.',
      security: sectorSecurity,
      parameters: [{ $ref: '#/components/parameters/SectorService' }, { $ref: '#/components/parameters/ListingId' }],
      responses: {
        200: { description: 'Updated listing', content: { 'application/json': { schema: successWith(sectorItemData) } } },
        401: { $ref: '#/components/responses/Unauthorized' },
        403: { $ref: '#/components/responses/Forbidden' },
        404: { $ref: '#/components/responses/NotFound' },
      },
    },
  },
  '/product/finance-offerings': {
    get: {
      tags: ['Products'],
      summary: 'List finance offerings',
      description: 'Read-only finance products (loans, cards, schemes) published by partners.',
      parameters: [
        { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
        { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
      ],
      responses: {
        200: { description: 'Paginated offerings', content: { 'application/json': { schema: successWith(sectorListData) } } },
      },
    },
  },
  '/product/finance-offerings/{id}': {
    get: {
      tags: ['Products'],
      summary: 'Get one finance offering',
      parameters: [{ $ref: '#/components/parameters/ListingId' }],
      responses: {
        200: { description: 'Offering', content: { 'application/json': { schema: successWith({ type: 'object', properties: { item: sectorRef } }) } } },
        404: { $ref: '#/components/responses/NotFound' },
      },
    },
  },
};

Object.assign(options.definition.paths, sectorPaths);

module.exports = swaggerJsdoc(options);
