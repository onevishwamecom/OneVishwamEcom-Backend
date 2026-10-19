/**
 * googleMapsResolver.js
 * Utility to extract exact locations and generate valid Google Maps iframe embed URLs
 * from various Google Maps link formats (full URLs, @coords, short links maps.app.goo.gl, etc.)
 */

const resolvedCache = new Map();
const MAX_CACHE_SIZE = 500;

/**
 * Parses any Google Maps URL or string to extract coordinates, place names, and embed URLs.
 * Strictly uses the URL provided; does NOT use fallback state or city strings.
 */
function extractFromGoogleMapsUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  // 1. If iframe HTML was provided, extract the src attribute
  const iframeMatch = trimmed.match(/src=["']([^"']+)["']/i);
  const target = (iframeMatch ? iframeMatch[1] : trimmed).trim();

  // 2. Direct embed links
  if (target.includes('/embed') || target.includes('output=embed')) {
    return {
      embedUrl: target,
      directUrl: target,
      lat: null,
      lng: null,
      placeName: null,
    };
  }

  // 3. URLs with @lat,lng: e.g. /@12.8596123,77.5843456,15z or /@12.8596123,77.5843456
  const atCoordMatch = target.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atCoordMatch) {
    const lat = atCoordMatch[1];
    const lng = atCoordMatch[2];
    return {
      lat,
      lng,
      placeName: null,
      embedUrl: `https://maps.google.com/maps?q=${lat},${lng}&t=&z=16&ie=UTF8&iwloc=&output=embed`,
      directUrl: target.startsWith('http') ? target : `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
    };
  }

  // 4. Coordinates in query string: ?q=lat,lng or &query=lat,lng or &ll=lat,lng
  const queryCoordMatch = target.match(/[?&](?:q|query|ll)=(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
  if (queryCoordMatch) {
    const lat = queryCoordMatch[1];
    const lng = queryCoordMatch[2];
    return {
      lat,
      lng,
      placeName: null,
      embedUrl: `https://maps.google.com/maps?q=${lat},${lng}&t=&z=16&ie=UTF8&iwloc=&output=embed`,
      directUrl: target.startsWith('http') ? target : `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
    };
  }

  // 5. Raw comma-separated coordinates: "12.8596, 77.5843"
  const rawCoordMatch = target.match(/^(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)$/);
  if (rawCoordMatch) {
    const lat = rawCoordMatch[1];
    const lng = rawCoordMatch[2];
    return {
      lat,
      lng,
      placeName: null,
      embedUrl: `https://maps.google.com/maps?q=${lat},${lng}&t=&z=16&ie=UTF8&iwloc=&output=embed`,
      directUrl: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
    };
  }

  // 6. URLs with /place/Name
  const placeMatch = target.match(/\/place\/([^/@?]+)/);
  if (placeMatch) {
    const placeName = decodeURIComponent(placeMatch[1].replace(/\+/g, ' '));
    return {
      lat: null,
      lng: null,
      placeName,
      embedUrl: `https://maps.google.com/maps?q=${encodeURIComponent(placeName)}&t=&z=16&ie=UTF8&iwloc=&output=embed`,
      directUrl: target.startsWith('http') ? target : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeName)}`,
    };
  }

  // 7. URLs with query string ?q=Place+Name (non-coordinate query)
  const qTextMatch = target.match(/[?&](?:q|query)=([^&#]+)/);
  if (qTextMatch) {
    const query = decodeURIComponent(qTextMatch[1].replace(/\+/g, ' '));
    return {
      lat: null,
      lng: null,
      placeName: query,
      embedUrl: `https://maps.google.com/maps?q=${encodeURIComponent(query)}&t=&z=16&ie=UTF8&iwloc=&output=embed`,
      directUrl: target.startsWith('http') ? target : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`,
    };
  }

  return null;
}

/**
 * Resolves a Google Maps URL (including short links like maps.app.goo.gl or goo.gl/maps)
 * by following HTTP redirects to get the exact location and embed URL.
 * Never uses state or city fallbacks.
 */
async function resolveGoogleMapsUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { originalUrl: '', resolvedUrl: '', embedUrl: '', directUrl: '', lat: null, lng: null };
  }

  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { originalUrl: '', resolvedUrl: '', embedUrl: '', directUrl: '', lat: null, lng: null };
  }

  if (resolvedCache.has(trimmed)) {
    return resolvedCache.get(trimmed);
  }

  // First check if it can be directly parsed without following redirects
  const directExtraction = extractFromGoogleMapsUrl(trimmed);
  if (directExtraction && directExtraction.embedUrl && !trimmed.includes('goo.gl')) {
    const result = {
      originalUrl: trimmed,
      resolvedUrl: trimmed,
      directUrl: directExtraction.directUrl || trimmed,
      embedUrl: directExtraction.embedUrl,
      lat: directExtraction.lat,
      lng: directExtraction.lng,
      placeName: directExtraction.placeName || null,
    };
    addToCache(trimmed, result);
    return result;
  }

  let resolvedUrl = trimmed;

  // If it's a short URL (maps.app.goo.gl or goo.gl/maps), follow redirects
  const isShortLink = /^(https?:\/\/)?(maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(trimmed);

  if (isShortLink && typeof fetch === 'function') {
    try {
      const targetUrl = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const response = await fetch(targetUrl, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });
      clearTimeout(timeoutId);

      if (response && response.url && response.url !== targetUrl) {
        resolvedUrl = response.url;
      }
    } catch (err) {
      console.warn(`[MAP_RESOLVER] Short URL resolution warning for ${trimmed}: ${err.message}`);
    }
  }

  // Try extracting from the resolved destination URL
  const extracted = extractFromGoogleMapsUrl(resolvedUrl) || directExtraction;

  let embedUrl = '';
  let directUrl = trimmed;
  let lat = null;
  let lng = null;
  let placeName = null;

  if (extracted) {
    embedUrl = extracted.embedUrl;
    directUrl = extracted.directUrl || trimmed;
    lat = extracted.lat;
    lng = extracted.lng;
    placeName = extracted.placeName || null;
  } else if (trimmed.startsWith('http')) {
    // If we couldn't parse coordinates from short URL directly, try constructing query embed from original URL
    embedUrl = `https://maps.google.com/maps?q=${encodeURIComponent(trimmed)}&t=&z=16&ie=UTF8&iwloc=&output=embed`;
    directUrl = trimmed;
  }

  const finalResult = {
    originalUrl: trimmed,
    resolvedUrl,
    directUrl,
    embedUrl,
    lat,
    lng,
    placeName,
  };

  addToCache(trimmed, finalResult);
  return finalResult;
}

function addToCache(key, value) {
  if (resolvedCache.size >= MAX_CACHE_SIZE) {
    const firstKey = resolvedCache.keys().next().value;
    resolvedCache.delete(firstKey);
  }
  resolvedCache.set(key, value);
}

module.exports = {
  extractFromGoogleMapsUrl,
  resolveGoogleMapsUrl,
};
