import { resources, initI18n } from './index';
import { LANGUAGES } from '@m3/shared';

describe('i18n', () => {
  it('provides all four supported languages', () => {
    for (const lng of LANGUAGES) {
      expect(resources[lng]).toBeDefined();
      expect(resources[lng].translation).toBeDefined();
    }
  });

  it('has the same key structure across languages (no missing sections)', () => {
    const enKeys = Object.keys(resources.en.translation).sort();
    for (const lng of LANGUAGES) {
      expect(Object.keys(resources[lng].translation).sort()).toEqual(enKeys);
    }
  });

  it('translates a known key after init', () => {
    const i18n = initI18n('hi');
    void i18n.changeLanguage('hi');
    expect(i18n.t('nav.transfer')).toBe('स्थानांतरण');
    void i18n.changeLanguage('en');
    expect(i18n.t('nav.transfer')).toBe('Transfer');
  });
});
