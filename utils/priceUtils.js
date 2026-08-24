/**
 * Shared Indian price parsing utility.
 * Handles: "₹4.5 L", "2.5Cr", "50,00,000", "5 Lakh", "500000", "25K", etc.
 */

const LAKH = 100000;
const CRORE = 10000000;
const THOUSAND = 1000;

function parsePrice(s) {
  if (!s && s !== 0) return 0;
  if (typeof s === 'number') return s;

  const raw = String(s).replace(/[₹,\s]/g, '').trim();
  if (!raw) return 0;

  // Extract the numeric part and suffix
  const match = raw.match(/^([+-]?\d+\.?\d*)\s*(.*)/i);
  if (!match) return 0;

  const num = parseFloat(match[1]);
  if (isNaN(num)) return 0;

  const suffix = (match[2] || '').toLowerCase().trim();

  if (suffix.startsWith('cr') || suffix.startsWith('crore')) return num * CRORE;
  if (suffix.startsWith('l') || suffix.startsWith('lakh')) return num * LAKH;
  if (suffix.startsWith('k') || suffix.startsWith('thousand')) return num * THOUSAND;

  return num;
}

module.exports = { parsePrice };
