/**
 * Indian Postal PIN Code Lookup Module (M3 Surveillance Platform).
 *
 * Implements:
 * 1. 6-digit numeric PIN code validation (/^[1-9][0-9]{5}$/).
 * 2. Complete offline-first lookup powered by authoritative India Post dataset
 *    via @twin.techies/india-pincode (23,000+ PIN codes, 40,000+ post offices).
 * 3. Comprehensive coverage across all Indian States and Union Territories:
 *    Goa, Delhi, Maharashtra, Karnataka, Bihar, Uttar Pradesh, West Bengal, and all others.
 * 4. Multi-post-office support with district, state, and post office listing.
 * 5. Safe fallback handling: does not overwrite manual inputs on invalid or missing lookups.
 * 6. Zero external API calls or exposed API keys on mobile.
 */

// Load authoritative India Post dataset directly via static JSON (compatible with React Native / Metro)
interface PincodeDataset {
  version: string;
  generatedAt: string;
  states: string[];
  pincodes: Record<string, [number, string, [string, string][]]>;
}

let cachedDataset: PincodeDataset | null = null;

function getDataset(): PincodeDataset {
  if (!cachedDataset) {
    // Metro bundler natively bundles JSON without Node.js fs dependencies
    cachedDataset = require('../data/pincodes.json') as PincodeDataset;
  }
  return cachedDataset;
}

export interface PostOfficeDetail {
  name: string;
  city: string;
  district: string;
  state: string;
  pincode: string;
}

export interface PinLookupResult {
  pincode: string;
  district: string;
  state: string;
  offices: PostOfficeDetail[];
}

/**
 * Validates that an Indian postal PIN code contains exactly 6 digits,
 * starting with a non-zero digit (1-9).
 */
export function validatePincode(pin: string): boolean {
  const clean = pin.trim().replace(/[^0-9]/g, '');
  if (!/^[1-9][0-9]{5}$/.test(clean)) return false;
  try {
    const ds = getDataset();
    return Boolean(ds && ds.pincodes && ds.pincodes[clean]);
  } catch {
    return clean.length === 6;
  }
}

/**
 * Looks up postal details for a 6-digit Indian PIN code.
 * Returns district, state, and list of post offices, or null if not found/invalid.
 */
export function lookupPincode(pin: string): PinLookupResult | null {
  const clean = pin.trim().replace(/[^0-9]/g, '');
  if (clean.length !== 6) return null;

  try {
    const ds = getDataset();
    const entry = ds?.pincodes?.[clean];
    if (!entry) return null;

    const [stateIdx, district, offices] = entry;
    const state = ds.states[stateIdx];
    if (!state || !district) return null;

    return {
      pincode: clean,
      district,
      state,
      offices: (offices || []).map(([name, city]) => ({
        name,
        city,
        district,
        state,
        pincode: clean,
      })),
    };
  } catch {
    return null;
  }
}
