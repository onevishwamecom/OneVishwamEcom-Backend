/**
 * Phone number normalization/validation utilities.
 *
 * Strategy (Indian market):
 *  - Accept numbers in the common formats:
 *      9876543210
 *      +91 9876543210
 *      +91-9876543210
 *      +919876543210
 *      0 9876543210 (leading 0 trunk code)
 *  - Strip everything that is not a digit.
 *  - If the remaining digits are 10 digits -> use as-is.
 *  - If the remaining digits are 12 and start with "91" -> strip country code.
 *  - If the remaining digits start with "0" and are 11 digits -> strip the leading 0.
 *  - Stored normalized form: raw 10-digit number, e.g. "9876543210".
 */

const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/;

/**
 * Normalize an Indian mobile number into a raw 10-digit string "XXXXXXXXXX".
 * Throws on invalid input.
 */
function normalizePhone(raw) {
  if (typeof raw !== 'string' && typeof raw !== 'number') {
    throw new Error('Phone number is required');
  }
  const str = String(raw).trim();
  if (!str) throw new Error('Phone number is required');

  // Keep only digits
  const digits = str.replace(/\D/g, '');

  if (digits.length === 0) throw new Error('Phone number is required');

  let tenDigit;
  if (digits.length === 10) {
    // Local format: 9876543210
    tenDigit = digits;
  } else if (digits.length === 11 && digits.startsWith('0')) {
    // Trunk code format: 09876543210
    tenDigit = digits.slice(1);
  } else if (digits.length === 12 && digits.startsWith('91')) {
    // Already has country code: 919876543210
    tenDigit = digits.slice(2);
  } else if (digits.length === 13 && digits.startsWith('91')) {
    tenDigit = digits.slice(2);
  } else if (digits.startsWith('91') && digits.length >= 13) {
    // e.g. +91 9876543210 -> after stripping non-digits is 919876543210 (12)
    tenDigit = digits.slice(2);
  } else {
    throw new Error('Please enter a valid 10-digit Indian mobile number');
  }

  if (!/^[6-9]\d{9}$/.test(tenDigit)) {
    throw new Error('Please enter a valid Indian mobile number starting with 6-9');
  }

  return tenDigit;
}

function formatPhoneForDisplay(normalized) {
  if (!normalized || normalized.length !== 10) return normalized;
  return `+91 ${normalized.slice(0, 5)} ${normalized.slice(5)}`;
}

function maskPhone(normalized) {
  if (!normalized || normalized.length !== 10) return '******';
  return `+91 *****${normalized.slice(-4)}`;
}

module.exports = {
  normalizePhone,
  formatPhoneForDisplay,
  maskPhone,
  INDIAN_MOBILE_REGEX,
};
