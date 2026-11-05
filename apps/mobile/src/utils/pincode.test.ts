import { lookupPincode, validatePincode } from './pincode';

describe('Indian Postal PIN Code Lookup', () => {
  describe('validatePincode', () => {
    it('validates 6-digit PIN codes correctly', () => {
      expect(validatePincode('403001')).toBe(true); // Goa
      expect(validatePincode('110001')).toBe(true); // Delhi
      expect(validatePincode('400001')).toBe(true); // Maharashtra
      expect(validatePincode('560001')).toBe(true); // Karnataka
      expect(validatePincode('800001')).toBe(true); // Bihar
      expect(validatePincode('226001')).toBe(true); // Uttar Pradesh
      expect(validatePincode('700001')).toBe(true); // West Bengal
    });

    it('rejects invalid PIN formats', () => {
      expect(validatePincode('')).toBe(false);
      expect(validatePincode('12345')).toBe(false); // only 5 digits
      expect(validatePincode('1234567')).toBe(false); // 7 digits
      expect(validatePincode('012345')).toBe(false); // starts with 0
      expect(validatePincode('ABCDEF')).toBe(false); // non-numeric
    });
  });

  describe('lookupPincode across Indian States & UTs', () => {
    it('looks up Goa postal locations with multiple post offices', () => {
      const res = lookupPincode('403001');
      expect(res).not.toBeNull();
      expect(res?.state).toBe('Goa');
      expect(res?.district).toBe('North Goa');
      expect(res?.offices.length).toBeGreaterThan(0);
      expect(res?.offices.some((o) => o.name === 'Panaji')).toBe(true);
    });

    it('looks up Delhi postal locations', () => {
      const res = lookupPincode('110001');
      expect(res).not.toBeNull();
      expect(res?.state).toBe('Delhi');
      expect(res?.district).toBe('New Delhi');
      expect(res?.offices.length).toBeGreaterThan(0);
      expect(res?.offices.some((o) => o.name.includes('Connaught Place'))).toBe(true);
    });

    it('looks up Maharashtra postal locations', () => {
      const res = lookupPincode('400001');
      expect(res).not.toBeNull();
      expect(res?.state).toBe('Maharashtra');
      expect(res?.district).toBe('Mumbai');
    });

    it('looks up Karnataka postal locations', () => {
      const res = lookupPincode('560001');
      expect(res).not.toBeNull();
      expect(res?.state).toBe('Karnataka');
      expect(res?.district).toMatch(/Bangalore|Bengaluru/i);
    });

    it('looks up Bihar postal locations', () => {
      const res = lookupPincode('800001');
      expect(res).not.toBeNull();
      expect(res?.state).toBe('Bihar');
      expect(res?.district).toBe('Patna');
    });

    it('looks up Uttar Pradesh postal locations', () => {
      const res = lookupPincode('226001');
      expect(res).not.toBeNull();
      expect(res?.state).toBe('Uttar Pradesh');
      expect(res?.district).toBe('Lucknow');
    });

    it('looks up West Bengal postal locations', () => {
      const res = lookupPincode('700001');
      expect(res).not.toBeNull();
      expect(res?.state).toBe('West Bengal');
    });

    it('returns null for non-existent PIN codes without throwing errors', () => {
      expect(lookupPincode('999999')).toBeNull();
      expect(lookupPincode('111111')).toBeNull();
    });

    it('returns null for short PIN codes without looking up prematurely', () => {
      expect(lookupPincode('403')).toBeNull();
      expect(lookupPincode('4030')).toBeNull();
      expect(lookupPincode('40300')).toBeNull();
    });
  });
});
