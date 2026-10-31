/**
 * M3 Worker Initial Screening — versioned form definition.
 *
 * Transcribed from "Questionnaire Updated 1 Sept 2026.docx", Worker Sections
 * I–IV. Section V (Travel) has been separated into an independent recurring
 * feature per project requirements.
 */

import { LANGUAGES, LANGUAGE_LABELS } from './enums';

export const QUESTIONNAIRE_VERSION = 'worker-screening-2026-10-31';

export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'temperature'
  | 'boolean' // Yes / No
  | 'tristate' // Yes / No / Don't know
  | 'single' // single-choice
  | 'multi'; // multi-choice

export interface FieldOption {
  value: string;
  /** i18n key; English fallback is the option label as written in the source. */
  label: string;
  /** This option reveals a free-text "other" field. */
  allowsOther?: boolean;
}

export interface QuestionField {
  id: string;
  type: FieldType;
  /** Question text exactly as in the approved source (English). */
  label: string;
  options?: FieldOption[];
  required?: boolean;
  unit?: string;
  /** id of a field whose "yes"/value gates visibility of this field. */
  showIf?: { field: string; equals: string | boolean };
  note?: string;
  needsApproval?: boolean;
}

export interface QuestionSection {
  id: string;
  title: string;
  fields: QuestionField[];
}

export const YES_NO: FieldOption[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
];

export const MOBILE_BRAND_OPTIONS: FieldOption[] = [
  { value: 'samsung', label: 'Samsung' },
  { value: 'xiaomi', label: 'Xiaomi / Redmi' },
  { value: 'vivo', label: 'Vivo' },
  { value: 'realme', label: 'Realme' },
  { value: 'oppo', label: 'Oppo' },
  { value: 'oneplus', label: 'OnePlus' },
  { value: 'apple', label: 'Apple (iPhone)' },
  { value: 'motorola', label: 'Motorola' },
  { value: 'poco', label: 'Poco' },
  { value: 'nokia', label: 'Nokia' },
  { value: 'lava', label: 'Lava' },
  { value: 'micromax', label: 'Micromax' },
  { value: 'tecno', label: 'Tecno' },
  { value: 'infinix', label: 'Infinix' },
  { value: 'itel', label: 'Itel' },
  { value: 'other', label: 'Other', allowsOther: true },
];

export const QUALIFICATION_OPTIONS: FieldOption[] = [
  { value: 'classes_1_5', label: 'Classes 1–5 completed' },
  { value: 'classes_5_10', label: 'Classes 5–10' },
  { value: 'twelfth_pass', label: '12th pass' },
  { value: 'undergraduate', label: 'Undergraduate' },
  { value: 'graduate', label: 'Graduate' },
];

export const DURATION_IN_GOA_OPTIONS: FieldOption[] = [
  { value: '1_6_months', label: '1–6 months' },
  { value: '6m_1y', label: '6 months to 1 year' },
  { value: '1_3_years', label: '1–3 years' },
  { value: '3_5_years', label: '3–5 years' },
  { value: 'gt_5_years', label: 'More than 5 years' },
];

export const WORKER_SCREENING_SECTIONS: QuestionSection[] = [
  {
    id: 'personal',
    title: 'Section I — Personal Details',
    fields: [
      { id: 'full_name', type: 'text', label: 'Full name (as per ID)', required: true },
      { id: 'date_of_birth', type: 'date', label: 'Date of Birth' },
      { id: 'age_years', type: 'number', label: 'Age (in completed years)' },
      {
        id: 'gender',
        type: 'single',
        label: 'Gender',
        required: true,
        options: [
          { value: 'male', label: 'Male' },
          { value: 'female', label: 'Female' },
        ],
      },
      { id: 'mobile_number', type: 'text', label: 'Mobile number (Registered)', required: true },
      { id: 'alternate_contact', type: 'text', label: 'Alternate contact number (optional)' },
      {
        id: 'gov_id_type',
        type: 'single',
        label: 'Government ID type',
        options: [
          { value: 'aadhaar', label: 'Aadhaar' },
          { value: 'voter_id', label: 'Voter ID' },
          { value: 'other', label: 'Other', allowsOther: true },
        ],
      },
      { id: 'gov_id_number', type: 'text', label: 'Government ID number' },
      {
        id: 'present_address_type',
        type: 'single',
        label: 'Present Address',
        options: [
          { value: 'site_premises', label: 'Staying within construction site premises' },
          { value: 'other_location', label: 'Staying at another location' },
        ],
      },
      {
        id: 'present_address_extra',
        type: 'textarea',
        label: 'Anything else you would like to specify?',
        showIf: { field: 'present_address_type', equals: 'other_location' },
      },
      { id: 'permanent_address_pincode', type: 'text', label: 'Permanent Address PIN Code' },
      { id: 'permanent_address_district', type: 'text', label: 'District' },
      { id: 'permanent_address_state', type: 'text', label: 'State' },
      { id: 'permanent_address_details', type: 'textarea', label: 'Additional Address Details (optional)' },
      {
        id: 'preferred_language',
        type: 'single',
        label: 'Preferred language for the app',
        options: LANGUAGES.map((code) => ({
          value: code,
          label: LANGUAGE_LABELS[code],
        })),
      },
    ],
  },
  {
    id: 'malaria_history',
    title: 'Section II — Past History of Malaria',
    fields: [
      { id: 'diagnosed_malaria', type: 'boolean', label: 'Have you ever been diagnosed with malaria?', options: YES_NO },
      {
        id: 'times_last_2_years',
        type: 'number',
        label: 'If yes, how many times in the last 2 years?',
        showIf: { field: 'diagnosed_malaria', equals: 'yes' },
      },
      {
        id: 'last_detection',
        type: 'single',
        label: 'Date of last malaria detection (month/year)',
        showIf: { field: 'diagnosed_malaria', equals: 'yes' },
        options: [
          { value: 'lte_1_year', label: '≤ 1 Year' },
          { value: '1_2_years', label: '1–2 Years' },
        ],
      },
      {
        id: 'treatment_place',
        type: 'single',
        label: 'Place where you received treatment for last malaria',
        showIf: { field: 'diagnosed_malaria', equals: 'yes' },
        options: [
          { value: 'uhc_phc', label: 'UHC / PHC' },
          { value: 'private_clinic', label: 'Private clinic' },
          { value: 'govt_hospital', label: 'Govt. Hospital' },
          { value: 'pharmacy', label: 'Pharmacy' },
          { value: 'other', label: 'Others', allowsOther: true },
        ],
      },
      {
        id: 'diagnosis_test_performed',
        type: 'boolean',
        label: 'Was a diagnostic test performed?',
        showIf: { field: 'diagnosed_malaria', equals: 'yes' },
        options: YES_NO,
      },
      {
        id: 'report_same_day',
        type: 'boolean',
        label: 'Did you receive your test report on the same day?',
        showIf: { field: 'diagnosed_malaria', equals: 'yes' },
        options: YES_NO,
      },
      {
        id: 'test_type',
        type: 'single',
        label: 'Which test was performed?',
        showIf: { field: 'diagnosed_malaria', equals: 'yes' },
        options: [
          { value: 'rdt', label: 'RDT (rapid test)' },
          { value: 'microscopy', label: 'Microscopy' },
          { value: 'not_sure', label: 'Not sure' },
        ],
      },
      {
        id: 'medication_period',
        type: 'single',
        label: 'What was the treatment duration?',
        showIf: { field: 'diagnosed_malaria', equals: 'yes' },
        options: [
          { value: '3_days', label: '3 Days' },
          { value: '14_days_pvivax', label: '14 Days (P. vivax)' },
          { value: '28_days_followup', label: '28 Days follow-up' },
          { value: 'not_informed', label: 'Not informed' },
        ],
      },
      {
        id: 'completed_course',
        type: 'single',
        label: 'Was the full course of medicine completed?',
        showIf: { field: 'diagnosed_malaria', equals: 'yes' },
        options: [
          { value: 'yes', label: 'Yes' },
          { value: 'no', label: 'No' },
          { value: 'not_sure', label: 'Not sure' },
        ],
      },
      {
        id: 'mobile_brand',
        type: 'single',
        label: 'Mobile Brand',
        options: MOBILE_BRAND_OPTIONS,
      },
      {
        id: 'qualification',
        type: 'single',
        label: 'Qualification',
        options: QUALIFICATION_OPTIONS,
      },
      { id: 'repellent', type: 'boolean', label: 'Do you use mosquito repellent?', options: YES_NO },
      { id: 'mosquito_net', type: 'boolean', label: 'Do you use a mosquito net?', options: YES_NO },
    ],
  },
  {
    id: 'clinical',
    title: 'Section III — Present Clinical Details',
    fields: [
      { id: 'fever_today', type: 'boolean', label: 'Do you have fever today?', required: true, options: YES_NO },
      {
        id: 'axillary_temperature',
        type: 'temperature',
        label: 'Measured temperature (if known)',
        unit: '°C',
        showIf: { field: 'fever_today', equals: 'yes' },
      },
      {
        id: 'fever_duration',
        type: 'single',
        label: 'Duration of fever',
        showIf: { field: 'fever_today', equals: 'yes' },
        options: [
          { value: '24_hours', label: '24 hours' },
          { value: '1_3_days', label: '1–3 days' },
          { value: 'more_than_3_days', label: 'More than 3 days' },
        ],
      },
      {
        id: 'associated_symptoms',
        type: 'multi',
        label: 'Associated Symptoms',
        showIf: { field: 'fever_today', equals: 'yes' },
        options: [
          { value: 'chills', label: 'Chills/shivering' },
          { value: 'headache', label: 'Headache' },
          { value: 'sweating', label: 'Sweating' },
          { value: 'body_ache', label: 'Body ache' },
          { value: 'nausea_vomiting', label: 'Nausea/vomiting' },
          { value: 'weakness_fatigue', label: 'Weakness/fatigue' },
          { value: 'none', label: 'No other symptoms' },
        ],
      },
      {
        id: 'onset_date',
        type: 'date',
        label: 'Date of onset of current illness',
        showIf: { field: 'fever_today', equals: 'yes' },
      },
      {
        id: 'breathing_difficulty',
        type: 'boolean',
        label: 'Breathing difficulty, chest pain or confusion?',
        showIf: { field: 'fever_today', equals: 'yes' },
        options: YES_NO,
      },
      {
        id: 'able_to_go_testing',
        type: 'single',
        label: 'Are you able to go to the health centre today if advised?',
        showIf: { field: 'fever_today', equals: 'yes' },
        options: [
          { value: 'yes', label: 'Yes' },
          { value: 'no', label: 'No' },
        ],
      },
    ],
  },
  {
    id: 'migration',
    title: 'Section IV — Migration History',
    fields: [
      {
        id: 'duration_in_goa',
        type: 'single',
        label: 'How long have you been in Goa this time?',
        options: DURATION_IN_GOA_OPTIONS,
      },
      { id: 'travelled_outside_3_months', type: 'boolean', label: 'Travelled outside Goa in the last 3 months?', options: YES_NO },
      {
        id: 'states_visited',
        type: 'text',
        label: 'If yes, which state(s) did you visit?',
        showIf: { field: 'travelled_outside_3_months', equals: true },
      },
      {
        id: 'last_stay_home_state',
        type: 'single',
        label: 'Duration of last stay in home state',
        options: [
          { value: '7_days', label: '7 days' },
          { value: '14_days', label: '14 days' },
          { value: 'lte_1_month', label: '≤ 1 Month' },
        ],
      },
      {
        id: 'fever_malaria_before_goa',
        type: 'boolean',
        label: 'Did you have fever or malaria in the last 3 months before coming to Goa?',
        options: YES_NO,
      },
    ],
  },
];

/**
 * Travel Form Fields for recurring Travel feature (Section 9).
 */
export const TRAVEL_RECORD_FIELDS: QuestionField[] = [
  { id: 'planning_travel', type: 'boolean', label: 'Are you planning to travel outside Goa?', required: true, options: YES_NO },
  { id: 'departure_date', type: 'date', label: 'Date of departure' },
  { id: 'return_date', type: 'date', label: 'Expected date of return' },
  { id: 'destination', type: 'text', label: 'Destination city / town' },
  { id: 'state', type: 'text', label: 'Destination state' },
  {
    id: 'had_fever_or_malaria',
    type: 'boolean',
    label: 'During this travel, did you have fever or were you diagnosed with malaria?',
    options: YES_NO,
  },
  {
    id: 'treatment_given',
    type: 'boolean',
    label: 'If yes, was treatment given?',
    showIf: { field: 'had_fever_or_malaria', equals: 'yes' },
    options: YES_NO,
  },
  {
    id: 'completed_course',
    type: 'boolean',
    label: 'If treatment was given, was the full course completed?',
    showIf: { field: 'treatment_given', equals: 'yes' },
    options: YES_NO,
  },
  {
    id: 'treatment_place',
    type: 'text',
    label: 'Place of treatment',
    showIf: { field: 'treatment_given', equals: 'yes' },
  },
];

/**
 * Consent gate.
 */
export const CONSENT_STEP = {
  id: 'consent',
  needsApproval: true,
  title: 'Informed Consent',
  statement:
    'Placeholder consent acknowledgement. Final consent/assent wording must be supplied by the approved ethics process before production use.',
  acknowledgementLabel: 'The worker has given informed consent to participate.',
} as const;

/** Field ids that must be present for a screening to be marked COMPLETE. */
export const REQUIRED_FIELD_IDS: string[] = WORKER_SCREENING_SECTIONS.flatMap((s) =>
  s.fields.filter((f) => f.required).map((f) => f.id),
);

export const ALL_FIELD_IDS: string[] = WORKER_SCREENING_SECTIONS.flatMap((s) =>
  s.fields.map((f) => f.id),
);
