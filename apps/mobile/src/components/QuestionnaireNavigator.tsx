/**
 * QuestionnaireNavigator — enhanced section-by-section questionnaire experience.
 *
 * Implements:
 *  - 4-Section questionnaire navigation (Sections I–IV; Travel is a separate feature).
 *  - Native date pickers for DOB and illness onset.
 *  - Automatic age calculation in completed years from Date of Birth.
 *  - Read-only registered mobile number.
 *  - Government ID type handling: Aadhaar (12 digits), Voter ID, Other (type + number).
 *  - Present address: Site premises (auto-populated active site address) vs Other location (Goa hierarchy).
 *  - Permanent address: 6-digit PIN code lookup for District & State with manual override.
 *  - Mobile Brand searchable selector with 'Other' text input.
 *  - Conditional follow-up questions for previous malaria and fever today.
 *  - Review of completed answers on the final section before Informed Consent.
 *  - Strict ASD-STE100 clear labels and large touch targets.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  Pressable,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  WORKER_SCREENING_SECTIONS,
  CONSENT_STEP,
  MOBILE_BRAND_OPTIONS,
  type QuestionField,
  type QuestionSection,
} from '@m3/shared';
import { palette, spacing, radius, fontSize, fontWeight } from '@/theme';
import { DatePickerField } from './DatePickerField';
import { Button } from './ui';
import { lookupPincode } from '@/utils/pincode';

export type Answers = Record<string, unknown>;

// ─── Goa Locations for Present Address (Option B) ───────────────────────────

const GOA_TALUKAS: Record<string, string[]> = {
  'North Goa': ['Bardez', 'Tiswadi', 'Pernem', 'Bicholim', 'Sattari'],
  'South Goa': ['Salcete', 'Mormugao', 'Ponda', 'Quepem', 'Canacona', 'Sanguem'],
};

const GOA_AREAS: Record<string, string[]> = {
  Bardez: ['Candolim', 'Calangute', 'Mapusa', 'Porvorim', 'Anjuna', 'Other'],
  Tiswadi: ['Panaji', 'Old Goa', 'Santa Cruz', 'Bambolim', 'Other'],
  Pernem: ['Pernem Town', 'Mandrem', 'Morjim', 'Arambol', 'Other'],
  Bicholim: ['Bicholim Town', 'Sanquelim', 'Other'],
  Sattari: ['Valpoi', 'Other'],
  Salcete: ['Margao', 'Colva', 'Benaulim', 'Fatorda', 'Navelim', 'Other'],
  Mormugao: ['Vasco da Gama', 'Dabolim', 'Cortalim', 'Other'],
  Ponda: ['Ponda Town', 'Shiroda', 'Kundaim', 'Other'],
  Quepem: ['Quepem Town', 'Curchorem', 'Other'],
  Canacona: ['Chaudi', 'Palolem', 'Agonda', 'Other'],
  Sanguem: ['Sanguem Town', 'Other'],
};

// ─── Visibility Helper ───────────────────────────────────────────────────────

function isVisible(field: QuestionField, answers: Answers): boolean {
  if (!field.showIf) return true;
  const actual = answers[field.showIf.field];
  const expected = field.showIf.equals;
  if (typeof expected === 'boolean') {
    return actual === expected || actual === (expected ? 'yes' : 'no');
  }
  return actual === expected;
}

function calculateAgeYears(dobIso: string): number | null {
  const parts = dobIso.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  const [y, m, d] = parts;
  const birth = new Date(y, m - 1, d);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const mDiff = now.getMonth() - birth.getMonth();
  if (mDiff < 0 || (mDiff === 0 && now.getDate() < birth.getDate())) {
    age--;
  }
  return age >= 0 ? age : null;
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function ProgressBar({ current, total }: { current: number; total: number }) {
  const { t } = useTranslation();
  const pct = total > 0 ? (current / total) * 100 : 0;
  return (
    <View style={styles.progressContainer}>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${pct}%` as `${number}%` }]} />
      </View>
      <Text style={styles.progressLabel}>
        {t('screening.sectionOf', { current, total, defaultValue: `Section ${current} of ${total}` })}
      </Text>
    </View>
  );
}

// ─── Option Cards (Radio & Checkbox) ─────────────────────────────────────────

function OptionCard({
  label,
  selected,
  onPress,
  multi,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  multi?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={multi ? 'checkbox' : 'radio'}
      accessibilityState={{ checked: selected }}
      style={({ pressed }) => [
        styles.optionCard,
        selected && styles.optionCardSelected,
        pressed && { opacity: 0.85 },
      ]}
    >
      <View style={[styles.optionIndicator, multi && styles.optionIndicatorCheck, selected && styles.optionIndicatorActive]}>
        {selected && <Text style={styles.optionTick}>{multi ? '✓' : '●'}</Text>}
      </View>
      <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>{label}</Text>
    </Pressable>
  );
}

// ─── Specialized Field Renderers ──────────────────────────────────────────────

function MobileNumberField({ value, label }: { value: unknown; label: string }) {
  const { t } = useTranslation();
  return (
    <View style={styles.fieldWrapper}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.textInput, styles.readOnlyInput]}>
        <Text style={styles.readOnlyText}>
          {value ? String(value) : t('screening.noMobileRegistered', 'No registered mobile')}
        </Text>
        <Text style={styles.readOnlyBadge}>🔒 {t('screening.readOnly', 'Read-only')}</Text>
      </View>
      <Text style={styles.helperText}>
        {t('screening.mobileFromRegistration', 'Using your registered phone number as your verified identity reference.')}
      </Text>
    </View>
  );
}

function AgeField({ value, label }: { value: unknown; label: string }) {
  const { t } = useTranslation();
  return (
    <View style={styles.fieldWrapper}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.textInput, styles.readOnlyInput]}>
        <Text style={styles.readOnlyText}>
          {value != null && value !== '' ? `${value} years` : t('screening.ageAutoCalc', 'Calculated automatically from Date of Birth')}
        </Text>
      </View>
    </View>
  );
}

function GovIdFields({
  answers,
  onChange,
  invalid,
}: {
  answers: Answers;
  onChange: (id: string, val: unknown) => void;
  invalid: boolean;
}) {
  const { t } = useTranslation();
  const idType = (answers['gov_id_type'] as string) || 'aadhaar';
  const idNum = (answers['gov_id_number'] as string) || '';
  const otherType = (answers['gov_id_other_type'] as string) || '';

  const isAadhaar = idType === 'aadhaar';
  const isVoter = idType === 'voter_id';
  const isOther = idType === 'other';

  const aadhaarValid = !idNum || /^[0-9]{12}$/.test(idNum);
  const voterValid = !idNum || /^[a-zA-Z0-9]{6,12}$/.test(idNum);

  return (
    <View style={styles.fieldWrapper}>
      <Text style={styles.fieldLabel}>{t('screening.govIdType', 'Government ID Type')}</Text>
      <View style={{ gap: spacing.sm, marginBottom: spacing.md }}>
        <OptionCard
          label={t('screening.aadhaar', 'Aadhaar (12 digits)')}
          selected={isAadhaar}
          onPress={() => onChange('gov_id_type', 'aadhaar')}
        />
        <OptionCard
          label={t('screening.voterId', 'Voter ID (EPIC)')}
          selected={isVoter}
          onPress={() => onChange('gov_id_type', 'voter_id')}
        />
        <OptionCard
          label={t('screening.otherId', 'Other Government ID')}
          selected={isOther}
          onPress={() => onChange('gov_id_type', 'other')}
        />
      </View>

      {isOther && (
        <View style={{ marginBottom: spacing.md }}>
          <Text style={styles.fieldLabel}>{t('screening.specifyIdType', 'Specify ID Type (e.g. Driving Licence)')}</Text>
          <TextInput
            style={styles.textInput}
            value={otherType}
            onChangeText={(txt) => onChange('gov_id_other_type', txt)}
            placeholder="e.g. Driving Licence, PAN Card"
            placeholderTextColor={palette.textMuted}
          />
        </View>
      )}

      <Text style={styles.fieldLabel}>
        {isAadhaar ? 'Aadhaar Number (12 digits)' : isVoter ? 'Voter ID Number' : 'ID Number'}
      </Text>
      <TextInput
        style={[styles.textInput, (invalid || (isAadhaar && idNum && !aadhaarValid)) && styles.textInputError]}
        value={idNum}
        onChangeText={(txt) => {
          if (isAadhaar) {
            const digits = txt.replace(/[^0-9]/g, '').slice(0, 12);
            onChange('gov_id_number', digits);
          } else {
            onChange('gov_id_number', txt.trim().toUpperCase());
          }
        }}
        keyboardType={isAadhaar ? 'numeric' : 'default'}
        maxLength={isAadhaar ? 12 : 20}
        placeholder={isAadhaar ? '12-digit number' : 'Enter ID number'}
        placeholderTextColor={palette.textMuted}
      />
      {isAadhaar && idNum.length > 0 && idNum.length < 12 && (
        <Text style={styles.errorText}>Aadhaar must be exactly 12 digits (currently {idNum.length})</Text>
      )}
      {isVoter && idNum.length > 0 && !voterValid && (
        <Text style={styles.errorText}>Please enter a valid Voter ID number</Text>
      )}
    </View>
  );
}

function PresentAddressFields({
  answers,
  onChange,
  siteAddress,
}: {
  answers: Answers;
  onChange: (id: string, val: unknown) => void;
  siteAddress?: string;
}) {
  const { t } = useTranslation();
  const addressType = (answers['present_address_type'] as string) || 'site_premises';
  const isPremises = addressType === 'site_premises';
  const isOther = addressType === 'other_location';

  const selectedDistrict = (answers['present_address_district'] as string) || 'North Goa';
  const talukas = GOA_TALUKAS[selectedDistrict] || [];
  const selectedTaluka = (answers['present_address_taluka'] as string) || talukas[0] || 'Bardez';
  const areas = GOA_AREAS[selectedTaluka] || ['Other'];
  const selectedArea = (answers['present_address_area'] as string) || areas[0] || '';

  return (
    <View style={styles.fieldWrapper}>
      <Text style={styles.fieldLabel}>{t('screening.presentAddress', 'Present Address')}</Text>
      <View style={{ gap: spacing.sm, marginBottom: spacing.md }}>
        <OptionCard
          label={t('screening.stayingSitePremises', 'Staying within construction site premises')}
          selected={isPremises}
          onPress={() => {
            onChange('present_address_type', 'site_premises');
            if (siteAddress) onChange('present_address_site_name', siteAddress);
          }}
        />
        <OptionCard
          label={t('screening.stayingOtherLocation', 'Staying at another location in Goa')}
          selected={isOther}
          onPress={() => onChange('present_address_type', 'other_location')}
        />
      </View>

      {isPremises ? (
        <View style={styles.cardInfo}>
          <Text style={styles.cardInfoTitle}>📍 Registered Construction Site Address:</Text>
          <Text style={styles.cardInfoText}>
            {siteAddress || (answers['present_address_site_name'] as string) || 'Current Active Site Premises'}
          </Text>
          <Text style={styles.helperText}>Automatically linked to your active site. Read-only.</Text>
        </View>
      ) : (
        <View style={{ gap: spacing.sm }}>
          <Text style={styles.fieldSubLabel}>District in Goa</Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {['North Goa', 'South Goa'].map((d) => (
              <Pressable
                key={d}
                onPress={() => {
                  onChange('present_address_district', d);
                  const newTalukas = GOA_TALUKAS[d] || [];
                  onChange('present_address_taluka', newTalukas[0] || '');
                }}
                style={[styles.chipButton, selectedDistrict === d && styles.chipButtonActive]}
              >
                <Text style={[styles.chipText, selectedDistrict === d && styles.chipTextActive]}>{d}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.fieldSubLabel}>Taluka</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {talukas.map((tk) => (
              <Pressable
                key={tk}
                onPress={() => {
                  onChange('present_address_taluka', tk);
                  const newAreas = GOA_AREAS[tk] || ['Other'];
                  onChange('present_address_area', newAreas[0] || '');
                }}
                style={[styles.chipButton, selectedTaluka === tk && styles.chipButtonActive]}
              >
                <Text style={[styles.chipText, selectedTaluka === tk && styles.chipTextActive]}>{tk}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.fieldSubLabel}>Area / Village</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {areas.map((ar) => (
              <Pressable
                key={ar}
                onPress={() => onChange('present_address_area', ar)}
                style={[styles.chipButton, selectedArea === ar && styles.chipButtonActive]}
              >
                <Text style={[styles.chipText, selectedArea === ar && styles.chipTextActive]}>{ar}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.fieldSubLabel, { marginTop: spacing.xs }]}>
            {t('screening.anythingElse', 'Anything else you would like to specify?')}
          </Text>
          <TextInput
            style={[styles.textInput, styles.textInputMulti]}
            value={(answers['present_address_extra'] as string) || ''}
            onChangeText={(txt) => onChange('present_address_extra', txt)}
            placeholder="Room / house number, landmark, nearby building"
            placeholderTextColor={palette.textMuted}
            multiline
            numberOfLines={2}
          />
        </View>
      )}
    </View>
  );
}

function PermanentAddressFields({
  answers,
  onChange,
}: {
  answers: Answers;
  onChange: (id: string, val: unknown) => void;
}) {
  const { t } = useTranslation();
  const pin = (answers['permanent_address_pincode'] as string) || '';
  const district = (answers['permanent_address_district'] as string) || '';
  const state = (answers['permanent_address_state'] as string) || '';
  const details = (answers['permanent_address_details'] as string) || '';

  const [lookupConfirmed, setLookupConfirmed] = useState(false);

  function handlePinChange(txt: string) {
    const clean = txt.replace(/[^0-9]/g, '').slice(0, 6);
    onChange('permanent_address_pincode', clean);
    if (clean.length >= 3) {
      const match = lookupPincode(clean);
      if (match) {
        onChange('permanent_address_district', match.district);
        onChange('permanent_address_state', match.state);
        setLookupConfirmed(true);
      }
    }
  }

  return (
    <View style={styles.fieldWrapper}>
      <Text style={styles.fieldLabel}>{t('screening.permanentAddress', 'Permanent Address (Home State)')}</Text>

      <Text style={styles.fieldSubLabel}>{t('screening.pinCode', '6-Digit PIN Code')}</Text>
      <TextInput
        style={styles.textInput}
        value={pin}
        onChangeText={handlePinChange}
        keyboardType="numeric"
        maxLength={6}
        placeholder="e.g. 800001 or 700001"
        placeholderTextColor={palette.textMuted}
      />

      {lookupConfirmed && district ? (
        <View style={styles.verifiedBadge}>
          <Text style={styles.verifiedText}>✓ Postal Lookup: {district}, {state}</Text>
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Text style={styles.fieldSubLabel}>{t('screening.district', 'District')}</Text>
          <TextInput
            style={styles.textInput}
            value={district}
            onChangeText={(txt) => onChange('permanent_address_district', txt)}
            placeholder="District name"
            placeholderTextColor={palette.textMuted}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.fieldSubLabel}>{t('screening.state', 'State')}</Text>
          <TextInput
            style={styles.textInput}
            value={state}
            onChangeText={(txt) => onChange('permanent_address_state', txt)}
            placeholder="Home state"
            placeholderTextColor={palette.textMuted}
          />
        </View>
      </View>

      <Text style={[styles.fieldSubLabel, { marginTop: spacing.sm }]}>
        {t('screening.addressDetails', 'Village / Town / Street (optional)')}
      </Text>
      <TextInput
        style={[styles.textInput, styles.textInputMulti]}
        value={details}
        onChangeText={(txt) => onChange('permanent_address_details', txt)}
        placeholder="Village, Post office, Police Station"
        placeholderTextColor={palette.textMuted}
        multiline
        numberOfLines={2}
      />
    </View>
  );
}

function MobileBrandField({
  value,
  onChange,
  answers,
  onFieldChange,
}: {
  value: unknown;
  onChange: (v: unknown) => void;
  answers: Answers;
  onFieldChange: (id: string, v: unknown) => void;
}) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState('');
  const brandVal = (value as string) || '';
  const otherBrand = (answers['mobile_brand_other'] as string) || '';

  const filtered = useMemo(() => {
    if (!filter) return MOBILE_BRAND_OPTIONS;
    return MOBILE_BRAND_OPTIONS.filter((o) =>
      o.label.toLowerCase().includes(filter.toLowerCase()),
    );
  }, [filter]);

  return (
    <View style={styles.fieldWrapper}>
      <Text style={styles.fieldLabel}>{t('screening.mobileBrand', 'Mobile Phone Brand')}</Text>
      <TextInput
        style={[styles.textInput, { marginBottom: spacing.sm }]}
        value={filter}
        onChangeText={setFilter}
        placeholder={t('screening.searchBrand', 'Search or select mobile brand...')}
        placeholderTextColor={palette.textMuted}
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm }}>
        {filtered.slice(0, 10).map((b) => (
          <Pressable
            key={b.value}
            onPress={() => onChange(b.value)}
            style={[styles.chipButton, brandVal === b.value && styles.chipButtonActive]}
          >
            <Text style={[styles.chipText, brandVal === b.value && styles.chipTextActive]}>{b.label}</Text>
          </Pressable>
        ))}
      </View>

      {brandVal === 'other' && (
        <View style={{ marginTop: spacing.xs }}>
          <Text style={styles.fieldSubLabel}>Specify Mobile Brand</Text>
          <TextInput
            style={styles.textInput}
            value={otherBrand}
            onChangeText={(txt) => onFieldChange('mobile_brand_other', txt)}
            placeholder="Type your phone brand"
            placeholderTextColor={palette.textMuted}
          />
        </View>
      )}
    </View>
  );
}

// ─── Field Renderer ───────────────────────────────────────────────────────────

function FieldRenderer({
  field,
  value,
  onChange,
  onFieldChange,
  invalid,
  answers,
  siteAddress,
}: {
  field: QuestionField;
  value: unknown;
  onChange: (v: unknown) => void;
  onFieldChange: (id: string, v: unknown) => void;
  invalid: boolean;
  answers: Answers;
  siteAddress?: string;
}) {
  const { t } = useTranslation();
  const label = `${t('q.' + field.id, field.label)}${field.required ? ' *' : ''}`;
  const error = invalid ? t('screening.required', 'This field is required') : undefined;

  // Intercept special fields
  if (field.id === 'mobile_number') {
    return <MobileNumberField value={value} label={label} />;
  }
  if (field.id === 'age_years') {
    return <AgeField value={value} label={label} />;
  }
  if (field.id === 'gov_id_type') {
    return <GovIdFields answers={answers} onChange={onFieldChange} invalid={invalid} />;
  }
  if (field.id === 'gov_id_number') {
    return null; // Handled within GovIdFields
  }
  if (field.id === 'present_address_type') {
    return <PresentAddressFields answers={answers} onChange={onFieldChange} siteAddress={siteAddress} />;
  }
  if (field.id === 'present_address_extra') {
    return null; // Handled within PresentAddressFields
  }
  if (field.id === 'permanent_address_pincode') {
    return <PermanentAddressFields answers={answers} onChange={onFieldChange} />;
  }
  if (
    field.id === 'permanent_address_district' ||
    field.id === 'permanent_address_state' ||
    field.id === 'permanent_address_details'
  ) {
    return null; // Handled within PermanentAddressFields
  }
  if (field.id === 'mobile_brand') {
    return (
      <MobileBrandField
        value={value}
        onChange={onChange}
        answers={answers}
        onFieldChange={onFieldChange}
      />
    );
  }

  const today = new Date();

  switch (field.type) {
    case 'date':
      return (
        <DatePickerField
          label={label}
          value={value as string | undefined}
          onChange={(iso) => {
            onChange(iso);
            if (field.id === 'date_of_birth') {
              const age = calculateAgeYears(iso);
              if (age !== null) onFieldChange('age_years', age);
            }
          }}
          minimumDate={field.id === 'date_of_birth' ? new Date(today.getFullYear() - 110, 0, 1) : new Date(today.getFullYear() - 50, 0, 1)}
          maximumDate={today}
          error={error}
          placeholder={t('screening.selectDate', 'Select date')}
        />
      );

    case 'number':
    case 'temperature': {
      const unitSuffix = field.unit ? ` (${field.unit})` : '';
      return (
        <View style={styles.fieldWrapper}>
          <Text style={styles.fieldLabel}>{label}{unitSuffix}</Text>
          <TextInput
            style={[styles.textInput, invalid && styles.textInputError]}
            value={value != null ? String(value) : ''}
            onChangeText={(txt) => {
              if (field.type === 'temperature') {
                onChange(txt);
              } else {
                const clean = txt.replace(/[^0-9]/g, '');
                onChange(clean ? Number(clean) : '');
              }
            }}
            keyboardType={field.type === 'temperature' ? 'decimal-pad' : 'numeric'}
            returnKeyType="done"
            placeholderTextColor={palette.textMuted}
            placeholder={field.unit ?? (field.type === 'temperature' ? 'e.g. 37.5' : '')}
          />
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>
      );
    }

    case 'text':
    case 'textarea': {
      const isPhone = field.id === 'alternate_contact';
      return (
        <View style={styles.fieldWrapper}>
          <Text style={styles.fieldLabel}>{label}</Text>
          <TextInput
            style={[
              styles.textInput,
              field.type === 'textarea' && styles.textInputMulti,
              invalid && styles.textInputError,
            ]}
            value={(value as string) ?? ''}
            onChangeText={(txt) => {
              if (isPhone) {
                const digits = txt.replace(/[^0-9]/g, '').slice(0, 10);
                onChange(digits);
              } else {
                onChange(txt);
              }
            }}
            multiline={field.type === 'textarea'}
            numberOfLines={field.type === 'textarea' ? 3 : 1}
            keyboardType={isPhone ? 'phone-pad' : 'default'}
            returnKeyType={field.type === 'textarea' ? 'default' : 'next'}
            placeholderTextColor={palette.textMuted}
            placeholder={isPhone ? '10-digit number' : ''}
            maxLength={isPhone ? 10 : undefined}
          />
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>
      );
    }

    case 'multi':
      return (
        <View style={styles.fieldWrapper}>
          <Text style={styles.fieldLabel}>{label}</Text>
          <View style={{ gap: spacing.sm }}>
            {(field.options ?? []).map((opt) => {
              const selectedList = (value as string[]) ?? [];
              const isOn = selectedList.includes(opt.value);
              const optLabel = t('q.opt_' + opt.value, t('options.' + opt.value, opt.label));
              return (
                <OptionCard
                  key={opt.value}
                  label={optLabel}
                  selected={isOn}
                  multi
                  onPress={() => {
                    const set = new Set(selectedList);
                    if (isOn) {
                      set.delete(opt.value);
                    } else {
                      if (opt.value === 'none') {
                        set.clear();
                      } else {
                        set.delete('none');
                      }
                      set.add(opt.value);
                    }
                    onChange(Array.from(set));
                  }}
                />
              );
            })}
          </View>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>
      );

    default: // single | boolean | tristate
      return (
        <View style={styles.fieldWrapper}>
          <Text style={styles.fieldLabel}>{label}</Text>
          <View style={{ gap: spacing.sm }}>
            {(field.options ?? []).map((opt) => {
              const isOn = value === opt.value;
              const optLabel = t('q.opt_' + opt.value, t('options.' + opt.value, opt.label));
              return (
                <OptionCard
                  key={opt.value}
                  label={optLabel}
                  selected={isOn}
                  onPress={() => onChange(opt.value)}
                />
              );
            })}
          </View>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>
      );
  }
}

// ─── Section View ─────────────────────────────────────────────────────────────

function SectionView({
  section,
  answers,
  onChange,
  invalidIds,
  siteAddress,
}: {
  section: QuestionSection;
  answers: Answers;
  onChange: (id: string, v: unknown) => void;
  invalidIds: string[];
  siteAddress?: string;
}) {
  const { t } = useTranslation();
  const visibleFields = section.fields.filter((f) => isVisible(f, answers));

  return (
    <View>
      <Text style={styles.sectionTitle}>{t('q.' + section.id, section.title)}</Text>
      {visibleFields.map((field) => (
        <FieldRenderer
          key={field.id}
          field={field}
          value={answers[field.id]}
          onChange={(v) => onChange(field.id, v)}
          onFieldChange={onChange}
          invalid={invalidIds.includes(field.id)}
          answers={answers}
          siteAddress={siteAddress}
        />
      ))}
    </View>
  );
}

// ─── Review Summary (Before Final Submission) ─────────────────────────────────

function ReviewSummary({ answers }: { answers: Answers }) {
  const { t } = useTranslation();
  return (
    <View style={styles.reviewCard}>
      <Text style={styles.reviewTitle}>{t('screening.reviewTitle', 'Review Your Screening Answers')}</Text>
      <View style={styles.reviewRow}>
        <Text style={styles.reviewKey}>{t('q.full_name', 'Worker Name')}:</Text>
        <Text style={styles.reviewVal}>{String(answers['full_name'] || '—')}</Text>
      </View>
      <View style={styles.reviewRow}>
        <Text style={styles.reviewKey}>{t('q.dob', 'Date of Birth')}:</Text>
        <Text style={styles.reviewVal}>{String(answers['date_of_birth'] || '—')} ({answers['age_years'] ? `${answers['age_years']} yrs` : '—'})</Text>
      </View>
      <View style={styles.reviewRow}>
        <Text style={styles.reviewKey}>{t('auth.phone', 'Mobile')}:</Text>
        <Text style={styles.reviewVal}>{String(answers['mobile_number'] || '—')}</Text>
      </View>
      <View style={styles.reviewRow}>
        <Text style={styles.reviewKey}>{t('q.fever_today', 'Fever Today')}:</Text>
        <Text style={styles.reviewVal}>{answers['fever_today'] === 'yes' ? t('common.yes') : t('common.no')}</Text>
      </View>
      <View style={styles.reviewRow}>
        <Text style={styles.reviewKey}>{t('q.duration_in_goa', 'Time in Goa')}:</Text>
        <Text style={styles.reviewVal}>{String(answers['duration_in_goa'] || '—')}</Text>
      </View>
    </View>
  );
}

// ─── Consent Gate ─────────────────────────────────────────────────────────────

function ConsentGate({
  consent,
  onToggle,
  invalid,
}: {
  consent: boolean;
  onToggle: () => void;
  invalid: boolean;
}) {
  const { t } = useTranslation();
  return (
    <View style={[styles.consentCard, invalid && { borderColor: palette.danger, borderWidth: 1.5 }]}>
      <Text style={styles.consentTitle}>{t('screening.consent', 'Informed Consent')}</Text>
      <Text style={styles.consentBody}>{CONSENT_STEP.statement}</Text>
      <Pressable
        onPress={onToggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: consent }}
        style={styles.consentRow}
      >
        <View style={[styles.consentBox, consent && styles.consentBoxChecked]}>
          {consent ? <Text style={styles.consentTick}>✓</Text> : null}
        </View>
        <Text style={styles.consentAck}>{t('screening.consentAck', CONSENT_STEP.acknowledgementLabel)}</Text>
      </Pressable>
      {invalid ? <Text style={styles.errorText}>{t('screening.consentRequired', 'Consent is required to submit.')}</Text> : null}
    </View>
  );
}

// ─── Main Navigator ───────────────────────────────────────────────────────────

interface QuestionnaireNavigatorProps {
  answers: Answers;
  onChange: (id: string, value: unknown) => void;
  consent: boolean;
  onConsentToggle: () => void;
  onSectionChange?: (sectionIndex: number) => void;
  onComplete: () => void;
  onSaveDraft: () => void;
  busy?: boolean;
  sections?: QuestionSection[];
  siteAddress?: string;
}

export function QuestionnaireNavigator({
  answers,
  onChange,
  consent,
  onConsentToggle,
  onSectionChange,
  onComplete,
  onSaveDraft,
  busy = false,
  sections = WORKER_SCREENING_SECTIONS,
  siteAddress,
}: QuestionnaireNavigatorProps) {
  const { t } = useTranslation();
  const [sectionIndex, setSectionIndex] = useState(0);
  const [invalidIds, setInvalidIds] = useState<string[]>([]);
  const [consentInvalid, setConsentInvalid] = useState(false);

  const totalSections = sections.length;
  const isLast = sectionIndex === totalSections - 1;
  const currentSection = sections[sectionIndex];

  const currentRequiredVisible = useMemo(
    () =>
      currentSection.fields
        .filter((f) => f.required && isVisible(f, answers))
        .map((f) => f.id),
    [currentSection, answers],
  );

  const validate = useCallback((): boolean => {
    const missing = currentRequiredVisible.filter((id) => {
      const val = answers[id];
      if (val == null || val === '') return true;
      if (Array.isArray(val) && val.length === 0) return true;
      if (id === 'mobile_number' && String(val).length < 10) return true;
      return false;
    });
    setInvalidIds(missing);
    return missing.length === 0;
  }, [currentRequiredVisible, answers]);

  function goNext() {
    if (!validate()) return;
    setInvalidIds([]);
    const next = sectionIndex + 1;
    setSectionIndex(next);
    onSectionChange?.(next);
  }

  function goPrev() {
    setInvalidIds([]);
    const prev = sectionIndex - 1;
    setSectionIndex(prev);
    onSectionChange?.(prev);
  }

  function handleComplete() {
    const sectionValid = validate();
    const consentValid = consent;
    setConsentInvalid(!consentValid);
    if (!sectionValid || !consentValid) return;
    onComplete();
  }

  return (
    <View style={styles.root}>
      <ProgressBar current={sectionIndex + 1} total={totalSections} />

      <SectionView
        section={currentSection}
        answers={answers}
        onChange={onChange}
        invalidIds={invalidIds}
        siteAddress={siteAddress}
      />

      {isLast && (
        <>
          <ReviewSummary answers={answers} />
          <ConsentGate
            consent={consent}
            onToggle={onConsentToggle}
            invalid={consentInvalid}
          />
        </>
      )}

      {/* Navigation Buttons */}
      <View style={styles.navRow}>
        {sectionIndex > 0 ? (
          <Pressable onPress={goPrev} style={styles.backButton} accessibilityRole="button">
            <Text style={styles.backButtonText}>
              {t('screening.previous', '← Previous')}
            </Text>
          </Pressable>
        ) : (
          <View style={{ flex: 1 }} />
        )}

        <View style={styles.rightButtons}>
          {!isLast ? (
            <Button
              label={t('screening.continue', 'Continue →')}
              onPress={goNext}
              loading={busy}
            />
          ) : (
            <Button
              label={t('screening.submit', 'Submit screening')}
              onPress={handleComplete}
              loading={busy}
            />
          )}
          <Button
            label={t('screening.saveDraft', 'Save draft')}
            variant="ghost"
            onPress={onSaveDraft}
            loading={busy}
          />
        </View>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

  // Progress
  progressContainer: { marginBottom: spacing.lg },
  progressTrack: {
    height: 6,
    backgroundColor: palette.border,
    borderRadius: radius.pill,
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
  progressFill: {
    height: '100%',
    backgroundColor: palette.primary,
    borderRadius: radius.pill,
  },
  progressLabel: {
    fontSize: fontSize.sm,
    color: palette.textMuted,
    textAlign: 'right',
  },

  // Section
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold as '700',
    color: palette.text,
    marginBottom: spacing.lg,
  },

  // Field
  fieldWrapper: { marginBottom: spacing.lg },
  fieldLabel: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium as '500',
    color: palette.text,
    marginBottom: spacing.sm,
    lineHeight: 22,
  },
  fieldSubLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium as '500',
    color: palette.textMuted,
    marginBottom: spacing.xs,
  },
  textInput: {
    borderWidth: 1.5,
    borderColor: palette.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: fontSize.md,
    color: palette.text,
    backgroundColor: palette.surface,
    minHeight: 52,
  },
  textInputMulti: { minHeight: 80, textAlignVertical: 'top' },
  textInputError: { borderColor: palette.danger },
  readOnlyInput: {
    backgroundColor: '#F3F4F6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  readOnlyText: {
    fontSize: fontSize.md,
    color: palette.text,
    fontWeight: '500',
  },
  readOnlyBadge: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    fontWeight: '600',
  },
  helperText: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    marginTop: 4,
  },
  errorText: {
    color: palette.danger,
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },

  // Option cards
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: palette.border,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: palette.surface,
    minHeight: 56,
    gap: spacing.md,
  },
  optionCardSelected: {
    borderColor: palette.primary,
    backgroundColor: palette.primarySoft,
  },
  optionIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  optionIndicatorCheck: { borderRadius: 4 },
  optionIndicatorActive: { borderColor: palette.primary },
  optionTick: { color: palette.primary, fontSize: 12, fontWeight: '700' },
  optionLabel: { fontSize: fontSize.md, color: palette.text, flex: 1, lineHeight: 22 },
  optionLabelSelected: { color: palette.primaryDark, fontWeight: fontWeight.medium as '500' },

  // Info cards & chips
  cardInfo: {
    backgroundColor: palette.primarySoft,
    padding: spacing.md,
    borderRadius: radius.md,
    borderLeftWidth: 4,
    borderLeftColor: palette.primary,
  },
  cardInfoTitle: { fontSize: fontSize.sm, fontWeight: '700', color: palette.primaryDark, marginBottom: 2 },
  cardInfoText: { fontSize: fontSize.md, color: palette.text, fontWeight: '600' },
  chipButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  chipButtonActive: {
    borderColor: palette.primary,
    backgroundColor: palette.primarySoft,
  },
  chipText: { fontSize: fontSize.sm, color: palette.text },
  chipTextActive: { color: palette.primaryDark, fontWeight: '600' },
  verifiedBadge: {
    backgroundColor: '#ECFDF5',
    padding: spacing.sm,
    borderRadius: radius.sm,
    marginTop: spacing.xs,
  },
  verifiedText: { fontSize: fontSize.xs, color: '#065F46', fontWeight: '600' },

  // Review card
  reviewCard: {
    backgroundColor: palette.surface,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: palette.border,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  reviewTitle: { fontSize: fontSize.md, fontWeight: '700', color: palette.text, marginBottom: spacing.xs },
  reviewRow: { flexDirection: 'row', justifyContent: 'space-between' },
  reviewKey: { fontSize: fontSize.sm, color: palette.textMuted },
  reviewVal: { fontSize: fontSize.sm, color: palette.text, fontWeight: '600' },

  // Consent
  consentCard: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: palette.primary,
  },
  consentTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold as '700',
    color: palette.text,
    marginBottom: spacing.sm,
  },
  consentBody: {
    fontSize: fontSize.sm,
    color: palette.textMuted,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  consentBox: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 2,
  },
  consentBoxChecked: { backgroundColor: palette.primary },
  consentTick: { color: palette.textOnColor, fontWeight: '800', fontSize: 14 },
  consentAck: { flex: 1, fontSize: fontSize.md, color: palette.text, lineHeight: 22 },

  // Navigation
  navRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  backButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    minHeight: 48,
  },
  backButtonText: {
    fontSize: fontSize.md,
    color: palette.primary,
    fontWeight: fontWeight.medium as '500',
  },
  rightButtons: {
    flex: 1,
    gap: spacing.sm,
  },
});
