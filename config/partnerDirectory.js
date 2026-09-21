/**
 * Centralized Partner & In-House Identity Directory (Backend)
 * ============================================================================
 * Source of truth for verifying and enforcing Channel Partner / In-House
 * identity mappings during token verification and listing creation.
 * ============================================================================
 */

const PARTNER_REGISTRY = {
  'co@vishwam.com': {
    role: 'in_house',
    partnerName: 'One Vishwam',
    isVerified: true,
    origin: 'in_house_project',
  },
  'cp.hassan@vishwam.com': {
    role: 'channel_partner',
    partnerName: 'Hassan Prime Properties',
    isVerified: true,
    origin: 'channel_partner_project',
  },
  'partner1@example.com': {
    role: 'channel_partner',
    partnerName: 'Assigned Partner Entity',
    isVerified: true,
    origin: 'channel_partner_project',
  },
};

function resolvePartnerIdentity(email) {
  if (!email || typeof email !== 'string') {
    return {
      role: 'lister',
      partnerName: '',
      isVerified: false,
      isLocked: false,
    };
  }

  const normalized = email.trim().toLowerCase();
  const entry = PARTNER_REGISTRY[normalized];

  if (entry) {
    return {
      ...entry,
      isLocked: true,
    };
  }

  return {
    role: 'lister',
    partnerName: '',
    isVerified: false,
    isLocked: false,
  };
}

module.exports = {
  PARTNER_REGISTRY,
  resolvePartnerIdentity,
};

