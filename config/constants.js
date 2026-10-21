const modules = require('../modules');

// Canonical marketplace category module IDs
const CATEGORIES = [
  'properties',
  'vehicles',
  'groceries',
  'garments',
  'jewellery',
  'finance',
  'finance-offerings',
  'electronics',
  'bedding',
];

// Single consistent category-to-module mapping across the entire backend
const CATEGORY_TO_MODULE = {
  properties: 'properties',
  property: 'properties',
  vehicles: 'vehicles',
  vehicle: 'vehicles',
  groceries: 'groceries',
  grocery: 'groceries',
  garments: 'garments',
  garment: 'garments',
  jewellery: 'jewellery',
  jewelry: 'jewellery',
  finance: 'finance',
  'finance-offerings': 'finance-offerings',
  electronics: 'electronics',
  'consumer-electronics': 'electronics',
  bedding: 'bedding',
  'bedding-comfort': 'bedding',
  'bedding_comfort': 'bedding',
};

// Normalized category slug lookup for filenames and templates
const CATEGORY_CANONICAL_SLUG = {
  properties: 'properties',
  property: 'properties',
  vehicles: 'vehicle',
  vehicle: 'vehicle',
  groceries: 'grocery',
  grocery: 'grocery',
  garments: 'garment',
  garment: 'garment',
  jewellery: 'jewellery',
  jewelry: 'jewellery',
  finance: 'finance',
  'finance-offerings': 'finance-offerings',
  electronics: 'electronics',
  'consumer-electronics': 'electronics',
  bedding: 'bedding',
  'bedding-comfort': 'bedding',
};

function normalizeCategory(category) {
  if (!category) return null;
  const raw = String(category).trim().toLowerCase();
  const clean = raw.replace(/[_\s]+/g, '-');
  const noHyphen = clean.replace(/-/g, '');
  return CATEGORY_TO_MODULE[clean] || CATEGORY_TO_MODULE[raw] || CATEGORY_TO_MODULE[noHyphen] || clean;
}

function findModule(type, fallbackToDefault = true) {
  if (!type) return fallbackToDefault ? modules[0] : null;
  const normalized = normalizeCategory(type);
  const found = modules.find((m) => m.id === normalized);
  if (found) return found;
  return fallbackToDefault ? (modules.find((m) => m.id === 'properties') || modules[0]) : null;
}

const LISTING_STATUS = ['active', 'pending', 'sold', 'inactive'];
const PROPERTY_TYPES = ['Apartment', 'House', 'Villa', 'Plot', 'Commercial'];
const VEHICLE_TYPES = ['Car', 'Bike', 'Scooter', 'Commercial'];
const GARMENT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Free Size'];
const GROCERY_UNITS = ['Kg', 'Liter', 'Piece', 'Pack', 'Dozen'];
const ROLES = ['user', 'admin'];

module.exports = {
  CATEGORIES,
  CATEGORY_TO_MODULE,
  CATEGORY_CANONICAL_SLUG,
  normalizeCategory,
  findModule,
  LISTING_STATUS,
  PROPERTY_TYPES,
  VEHICLE_TYPES,
  GARMENT_SIZES,
  GROCERY_UNITS,
  ROLES,
};
