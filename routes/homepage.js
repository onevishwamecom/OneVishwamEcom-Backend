const express = require('express');
const { optionalAuth } = require('../middleware/auth');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const modules = require('../modules');
const Property = require('../modules/properties/model');
const Vehicle = require('../modules/vehicles/model');
// Groceries, Garments, Jewellery, Finance, FinanceOfferings are disabled —
// only Properties and Vehicles are active.

const router = express.Router();

// Card-level projection — only fields needed by homepage cards
// Card-level projection — only fields needed by homepage cards
const CARD_PROJECTION = {
  title: 1,
  name: 1,
  subtitle: 1,
  price: 1,
  numericPrice: 1,
  priceSuffix: 1,
  city: 1,
  area: 1,
  location: 1,
  address: 1,
  locality: 1,
  pincode: 1,
  locationUrl: 1,
  mapUrl: 1,
  googleMapsUrl: 1,
  images: 1,
  image: 1,
  category: 1,
  propertyType: 1,
  subcategory: 1,
  bhk: 1,
  priority: 1,
  isPriority: 1,
  status: 1,
  availabilityStatus: 1,
  featured: 1,
  createdAt: 1,
  // Vehicle-specific
  brand: 1,
  model: 1,
  year: 1,
  fuelType: 1,
  transmission: 1,
  kmDriven: 1,
  condition: 1,
  statusBadges: 1,
  cardPills: 1,
  showroom: 1,
  // Grocery-specific
  unit: 1,
  stock: 1,
  // Garment-specific
  size: 1,
  color: 1,
  // Jewellery-specific
  metalType: 1,
  purity: 1,
  weightGrams: 1,
  // Finance-specific
  companyName: 1,
  serviceName: 1,
  interestRate: 1,
  logo: 1,
  banner: 1,
};


function resolvePropertyLocality(p) {
  if (!p) return '';
  let locality = (p.locality || '').trim();
  if (locality && !/^bangalore$/i.test(locality) && !/^bengaluru$/i.test(locality)) {
    return locality;
  }
  const combined = `${p.title || ''} ${p.subtitle || ''} ${p.vendorName || ''} ${p.address || ''}`.toLowerCase();
  if (combined.includes('nelamangala') || combined.includes('bmrda')) return 'Nelamangala';
  if (combined.includes('kempegowda layout') || combined.includes('nada prabhu') || combined.includes('bda')) return 'Nada Prabhu Kempegowda Layout';
  if (combined.includes('kanakapura') || combined.includes('annanta') || combined.includes('avaana') || combined.includes('oraiyan')) return 'Kanakapura Road';
  if (combined.includes('begur') || combined.includes('bbmp enclave') || combined.includes('sp prime')) return 'Begur';
  if (combined.includes('electronic city') || combined.includes('e-city') || combined.includes('showroom')) return 'Electronic City';
  if (combined.includes('sarjapur')) return 'Sarjapur Road';
  if (combined.includes('whitefield') || combined.includes('fortuna')) return 'Whitefield';
  if (combined.includes('devanahalli') || combined.includes('artemis')) return 'Devanahalli';
  if (combined.includes('yelahanka')) return 'Yelahanka';
  if (combined.includes('thanisandra')) return 'Thanisandra';
  if (combined.includes('kengeri') || combined.includes('sampada')) return 'Kengeri';
  if (combined.includes('bidadi') || combined.includes('bhoo vaibhav')) return 'Bidadi';
  if (combined.includes('dobbaspet') || combined.includes('dhabaspet')) return 'Dobbaspet';
  if (combined.includes('gottigere') || combined.includes('vedanth')) return 'Gottigere';
  if (combined.includes('jigani')) return 'Jigani';
  return locality;
}

function formatPropertyLocation(p) {
  if (!p) return 'Bangalore';
  const locality = resolvePropertyLocality(p);
  const address = (p.address || '').trim();
  const rawCity = (p.city || 'Bangalore').trim();
  const city = /^\d+$/.test(rawCity) ? 'Bangalore' : (/^bengaluru$/i.test(rawCity) ? 'Bangalore' : rawCity);

  const cleanAddr = address.toLowerCase();
  const isAddressJustCity = !address || cleanAddr === 'bangalore' || cleanAddr === 'bengaluru' || cleanAddr === city.toLowerCase();

  const parts = [];
  if (locality) parts.push(locality);
  if (address && !isAddressJustCity) {
    if (!locality || !address.toLowerCase().includes(locality.toLowerCase())) {
      parts.push(address);
    }
  } else {
    parts.push(city);
  }
  return parts.filter(Boolean).join(', ') || 'Bangalore';
}

function formatPropertyCard(p) {
  if (!p) return p;
  const loc = formatPropertyLocation(p);
  return {
    ...p,
    location: loc,
    locality: resolvePropertyLocality(p) || p.locality,
    city: /^bengaluru$/i.test(p.city) ? 'Bangalore' : p.city,
  };
}

// GET /api/homepage — single endpoint returning all homepage sections
router.get('/', optionalAuth, asyncHandler(async (req, res) => {
  const [
    featuredProperties,
    latestProperties,
    latestVehicles,
  ] = await Promise.all([
    // Featured properties (top 6)
    Property.find({ featured: true, status: { $in: ['approved', 'active'] }, availabilityStatus: { $ne: 'sold_out' } })
      .sort({ createdAt: -1 })
      .limit(6)
      .select(CARD_PROJECTION)
      .lean(),

    // Latest properties (top 8)
    Property.find({ status: { $in: ['approved', 'active'] }, availabilityStatus: { $ne: 'sold_out' } })
      .sort({ createdAt: -1 })
      .limit(8)
      .select(CARD_PROJECTION)
      .lean(),

    // Latest vehicles (top 8)
    Vehicle.find({ status: { $in: ['approved', 'active'] }, availabilityStatus: { $ne: 'sold_out' } })
      .sort({ createdAt: -1 })
      .limit(8)
      .select(CARD_PROJECTION)
      .lean().catch(() => []),
  ]);

  // Stats — only active categories
  const [totalProperties, totalVehicles] = await Promise.all([
    Property.countDocuments({ status: { $in: ['approved', 'active'] } }),
    Vehicle.countDocuments({ status: { $in: ['approved', 'active'] } }).catch(() => 0),
  ]);

  const data = {
    featured: featuredProperties.map(formatPropertyCard),
    latestProperties: latestProperties.map(formatPropertyCard),
    latestVehicles,
    // Disabled categories — return empty arrays to keep response shape stable
    latestGroceries: [],
    latestGarments: [],
    latestJewellery: [],
    latestFinance: [],
    financeOfferings: [],
    stats: {
      totalProperties,
      totalVehicles,
      totalGroceries: 0,
      totalGarments: 0,
      totalJewellery: 0,
      totalFinance: 0,
    },
  };

  new ApiResponse(200, data, 'Homepage data fetched').send(res);
}));

module.exports = router;