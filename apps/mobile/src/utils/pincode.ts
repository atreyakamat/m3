/**
 * PIN code lookup helper for Indian postal codes (6 digits).
 * Maps 3-digit prefix ranges to District and State for instant, offline
 * confirmation in the worker questionnaire.
 */

export interface PinLookupResult {
  district: string;
  state: string;
}

// Major migrant source regions and Goa PIN prefixes
const PIN_PREFIX_MAP: Record<string, PinLookupResult> = {
  // Goa
  '403': { district: 'North Goa / South Goa', state: 'Goa' },

  // Bihar
  '800': { district: 'Patna', state: 'Bihar' },
  '801': { district: 'Patna', state: 'Bihar' },
  '802': { district: 'Bhojpur', state: 'Bihar' },
  '803': { district: 'Nalanda', state: 'Bihar' },
  '804': { district: 'Jehanabad', state: 'Bihar' },
  '805': { district: 'Nawada', state: 'Bihar' },
  '811': { district: 'Munger', state: 'Bihar' },
  '812': { district: 'Bhagalpur', state: 'Bihar' },
  '813': { district: 'Banka', state: 'Bihar' },
  '821': { district: 'Rohtas', state: 'Bihar' },
  '823': { district: 'Gaya', state: 'Bihar' },
  '824': { district: 'Aurangabad', state: 'Bihar' },
  '841': { district: 'Saran / Siwan', state: 'Bihar' },
  '842': { district: 'Muzaffarpur', state: 'Bihar' },
  '843': { district: 'Vaishali', state: 'Bihar' },
  '844': { district: 'Vaishali', state: 'Bihar' },
  '845': { district: 'East Champaran', state: 'Bihar' },
  '846': { district: 'Darbhanga', state: 'Bihar' },
  '847': { district: 'Madhubani', state: 'Bihar' },
  '848': { district: 'Samastipur', state: 'Bihar' },
  '851': { district: 'Begusarai', state: 'Bihar' },
  '852': { district: 'Saharsa', state: 'Bihar' },
  '853': { district: 'Khagaria', state: 'Bihar' },
  '854': { district: 'Purnia', state: 'Bihar' },
  '855': { district: 'Kishanganj', state: 'Bihar' },

  // Jharkhand
  '814': { district: 'Deoghar / Dumka', state: 'Jharkhand' },
  '815': { district: 'Giridih', state: 'Jharkhand' },
  '816': { district: 'Pakur / Sahibganj', state: 'Jharkhand' },
  '825': { district: 'Hazaribagh', state: 'Jharkhand' },
  '826': { district: 'Dhanbad', state: 'Jharkhand' },
  '827': { district: 'Bokaro', state: 'Jharkhand' },
  '828': { district: 'Dhanbad', state: 'Jharkhand' },
  '829': { district: 'Ramgarh', state: 'Jharkhand' },
  '831': { district: 'East Singhbhum (Jamshedpur)', state: 'Jharkhand' },
  '832': { district: 'Saraikela Kharsawan', state: 'Jharkhand' },
  '833': { district: 'West Singhbhum', state: 'Jharkhand' },
  '834': { district: 'Ranchi', state: 'Jharkhand' },
  '835': { district: 'Khunti / Simdega', state: 'Jharkhand' },

  // West Bengal
  '700': { district: 'Kolkata', state: 'West Bengal' },
  '711': { district: 'Howrah', state: 'West Bengal' },
  '712': { district: 'Hooghly', state: 'West Bengal' },
  '713': { district: 'Bardhaman', state: 'West Bengal' },
  '721': { district: 'Paschim Medinipur', state: 'West Bengal' },
  '722': { district: 'Bankura', state: 'West Bengal' },
  '723': { district: 'Purulia', state: 'West Bengal' },
  '731': { district: 'Birbhum', state: 'West Bengal' },
  '732': { district: 'Malda', state: 'West Bengal' },
  '733': { district: 'Uttar Dinajpur', state: 'West Bengal' },
  '734': { district: 'Darjeeling', state: 'West Bengal' },
  '735': { district: 'Jalpaiguri', state: 'West Bengal' },
  '736': { district: 'Cooch Behar', state: 'West Bengal' },
  '741': { district: 'Nadia', state: 'West Bengal' },
  '742': { district: 'Murshidabad', state: 'West Bengal' },
  '743': { district: 'South 24 Parganas', state: 'West Bengal' },

  // Odisha
  '751': { district: 'Khurda (Bhubaneswar)', state: 'Odisha' },
  '752': { district: 'Puri', state: 'Odisha' },
  '753': { district: 'Cuttack', state: 'Odisha' },
  '754': { district: 'Jagatsinghpur / Kendrapara', state: 'Odisha' },
  '755': { district: 'Jajpur', state: 'Odisha' },
  '756': { district: 'Balasore', state: 'Odisha' },
  '757': { district: 'Mayurbhanj', state: 'Odisha' },
  '758': { district: 'Kendujhar', state: 'Odisha' },
  '760': { district: 'Ganjam (Berhampur)', state: 'Odisha' },
  '761': { district: 'Ganjam', state: 'Odisha' },
  '762': { district: 'Kandhamal', state: 'Odisha' },
  '763': { district: 'Kalahandi', state: 'Odisha' },
  '764': { district: 'Koraput', state: 'Odisha' },
  '765': { district: 'Rayagada', state: 'Odisha' },
  '766': { district: 'Nabarangpur', state: 'Odisha' },
  '767': { district: 'Balangir', state: 'Odisha' },
  '768': { district: 'Sambalpur', state: 'Odisha' },
  '769': { district: 'Sundargarh (Rourkela)', state: 'Odisha' },

  // Karnataka
  '560': { district: 'Bengaluru Urban', state: 'Karnataka' },
  '570': { district: 'Mysuru', state: 'Karnataka' },
  '571': { district: 'Chamarajanagar', state: 'Karnataka' },
  '574': { district: 'Dakshina Kannada', state: 'Karnataka' },
  '575': { district: 'Mangaluru', state: 'Karnataka' },
  '576': { district: 'Udupi', state: 'Karnataka' },
  '577': { district: 'Shivamogga', state: 'Karnataka' },
  '580': { district: 'Dharwad (Hubli)', state: 'Karnataka' },
  '581': { district: 'Uttara Kannada (Karwar)', state: 'Karnataka' },
  '582': { district: 'Gadag', state: 'Karnataka' },
  '583': { district: 'Ballari', state: 'Karnataka' },
  '584': { district: 'Raichur', state: 'Karnataka' },
  '585': { district: 'Kalaburagi (Gulbarga)', state: 'Karnataka' },
  '586': { district: 'Vijayapura (Bijapur)', state: 'Karnataka' },
  '587': { district: 'Bagalkote', state: 'Karnataka' },
  '590': { district: 'Belagavi (Belgaum)', state: 'Karnataka' },
  '591': { district: 'Belagavi', state: 'Karnataka' },

  // Maharashtra
  '400': { district: 'Mumbai', state: 'Maharashtra' },
  '401': { district: 'Thane / Palghar', state: 'Maharashtra' },
  '411': { district: 'Pune', state: 'Maharashtra' },
  '415': { district: 'Ratnagiri', state: 'Maharashtra' },
  '416': { district: 'Kolhapur / Sindhudurg', state: 'Maharashtra' },
  '422': { district: 'Nashik', state: 'Maharashtra' },
  '431': { district: 'Chhatrapati Sambhajinagar', state: 'Maharashtra' },
  '440': { district: 'Nagpur', state: 'Maharashtra' },

  // Uttar Pradesh
  '201': { district: 'Ghaziabad / Gautam Buddha Nagar', state: 'Uttar Pradesh' },
  '208': { district: 'Kanpur Nagar', state: 'Uttar Pradesh' },
  '211': { district: 'Prayagraj (Allahabad)', state: 'Uttar Pradesh' },
  '221': { district: 'Varanasi', state: 'Uttar Pradesh' },
  '226': { district: 'Lucknow', state: 'Uttar Pradesh' },
  '273': { district: 'Gorakhpur', state: 'Uttar Pradesh' },
  '274': { district: 'Deoria', state: 'Uttar Pradesh' },
  '275': { district: 'Mau', state: 'Uttar Pradesh' },
  '276': { district: 'Azamgarh', state: 'Uttar Pradesh' },
  '277': { district: 'Ballia', state: 'Uttar Pradesh' },
  '282': { district: 'Agra', state: 'Uttar Pradesh' },

  // Madhya Pradesh / Chhattisgarh
  '462': { district: 'Bhopal', state: 'Madhya Pradesh' },
  '452': { district: 'Indore', state: 'Madhya Pradesh' },
  '492': { district: 'Raipur', state: 'Chhattisgarh' },
  '495': { district: 'Bilaspur', state: 'Chhattisgarh' },

  // Assam
  '781': { district: 'Kamrup (Guwahati)', state: 'Assam' },
  '782': { district: 'Nagaon', state: 'Assam' },
  '783': { district: 'Dhubri', state: 'Assam' },
  '784': { district: 'Sonitpur', state: 'Assam' },
  '785': { district: 'Jorhat', state: 'Assam' },
  '786': { district: 'Dibrugarh', state: 'Assam' },

  // Andhra Pradesh & Telangana
  '500': { district: 'Hyderabad', state: 'Telangana' },
  '520': { district: 'Krishna (Vijayawada)', state: 'Andhra Pradesh' },
  '530': { district: 'Visakhapatnam', state: 'Andhra Pradesh' },
};

export function lookupPincode(pin: string): PinLookupResult | null {
  const clean = pin.trim().replace(/[^0-9]/g, '');
  if (clean.length < 3) return null;
  const prefix = clean.slice(0, 3);
  return PIN_PREFIX_MAP[prefix] || null;
}
