/**
 * M3 Worker Initial Screening — versioned form definition.
 *
 * Transcribed from "Questionnaire Updated 1 Sept 2026.docx", Worker Sections
 * I–V. Do NOT invent or alter questions/answer options. Where the approved
 * source is ambiguous or defers a decision (consent wording, preferred-language
 * set), it is flagged with `needsApproval` / notes rather than fabricated.
 */

export const QUESTIONNAIRE_VERSION = 'worker-screening-2026-09-01';

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

const YES_NO: FieldOption[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
];
const YES_NO_DK: FieldOption[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'dont_know', label: "Don't know" },
];
const YES_NO_NOTSURE: FieldOption[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'not_sure', label: 'Not sure' },
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
      { id: 'mobile_number', type: 'text', label: 'Mobile number', required: true },
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
      { id: 'present_address', type: 'textarea', label: 'Present Address' },
      { id: 'permanent_address', type: 'textarea', label: 'Permanent Address (Home Town)' },
      {
        id: 'preferred_language',
        type: 'single',
        label: 'Preferred language for the app',
        note: 'Source lists Hindi/English/Bengali/Other; platform i18n also supports Marathi. Confirm the official set.',
        needsApproval: true,
        options: [
          { value: 'hi', label: 'Hindi' },
          { value: 'en', label: 'English' },
          { value: 'bn', label: 'Bengali' },
          { value: 'other', label: 'Other', allowsOther: true },
        ],
      },
    ],
  },
  {
    id: 'malaria_history',
    title: 'Section II — Past History of Malaria',
    fields: [
      { id: 'diagnosed_malaria', type: 'tristate', label: 'Diagnosed with malaria?', options: YES_NO_DK },
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
        options: [
          { value: 'lte_1_year', label: '≤ 1 Year' },
          { value: '1_2_years', label: '1–2 Years' },
          { value: 'dont_know', label: "Don't know" },
        ],
      },
      {
        id: 'treatment_place',
        type: 'single',
        label: 'Place where you received treatment for last malaria',
        options: [
          { value: 'uhc_phc', label: 'UHC / PHC' },
          { value: 'private_clinic', label: 'Private clinic' },
          { value: 'govt_hospital', label: 'Govt. Hospital' },
          { value: 'pharmacy', label: 'Pharmacy' },
          { value: 'other', label: 'Others', allowsOther: true },
        ],
      },
      { id: 'diagnosis_test_performed', type: 'boolean', label: 'Diagnosis test performed?', options: YES_NO },
      { id: 'report_same_day', type: 'boolean', label: 'Did you receive your test report on the same day?', options: YES_NO },
      {
        id: 'test_type',
        type: 'single',
        label: 'Test type',
        options: [
          { value: 'rdt', label: 'RDT (rapid test)' },
          { value: 'microscopy', label: 'Microscopy' },
          { value: 'not_sure', label: 'Not sure' },
        ],
      },
      {
        id: 'medication_period',
        type: 'single',
        label: 'Medication / Treatment given period',
        options: [
          { value: '3_days', label: '3 Days' },
          { value: '14_days_pvivax', label: '14 Days (P. vivax)' },
          { value: '28_days_followup', label: '28 Days follow-up' },
          { value: 'not_informed', label: "Not informed / Don't know" },
        ],
      },
      { id: 'completed_course', type: 'tristate', label: 'Completed full course of medicines?', options: YES_NO_NOTSURE },
      { id: 'mobile_brand', type: 'text', label: 'Mobile Brand' },
      { id: 'qualification', type: 'text', label: 'Qualification' },
      { id: 'repellent', type: 'boolean', label: 'Repellent', options: YES_NO },
      { id: 'mosquito_net', type: 'boolean', label: 'Mosquito Net', options: YES_NO },
    ],
  },
  {
    id: 'clinical',
    title: 'Section III — Present Clinical Details',
    fields: [
      { id: 'fever_today', type: 'tristate', label: 'Do you have fever today?', required: true, options: YES_NO_NOTSURE },
      {
        id: 'axillary_temperature',
        type: 'temperature',
        label: 'If yes, measured temperature (if known)',
        unit: '°C',
        note: 'Axillary temperature — emphasised by the research proposal.',
        showIf: { field: 'fever_today', equals: 'yes' },
      },
      {
        id: 'fever_duration',
        type: 'single',
        label: 'Duration of fever',
        options: [
          { value: '24_hours', label: '24 hours' },
          { value: '1_3_days', label: '1–3 days' },
          { value: 'more_than_3_days', label: 'More than 3 days' },
          { value: 'not_required', label: 'Not required' },
        ],
      },
      {
        id: 'associated_symptoms',
        type: 'multi',
        label: 'Associated Symptoms',
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
      { id: 'onset_date', type: 'date', label: 'Time of onset of current illness (date)' },
      { id: 'breathing_difficulty', type: 'boolean', label: 'Any breathing difficulty, chest pain or confusion?', options: YES_NO },
      {
        id: 'able_to_go_testing',
        type: 'single',
        label: 'Are you able to go for testing to the health centre today if advised?',
        options: [
          { value: 'yes', label: 'Yes' },
          { value: 'no', label: 'No' },
          { value: 'not_required', label: 'Not required' },
        ],
      },
    ],
  },
  {
    id: 'migration',
    title: 'Section IV — Migration and Travel History',
    fields: [
      {
        id: 'duration_in_goa',
        type: 'single',
        label: 'How long have you been in Goa this time?',
        options: [
          { value: 'lte_1_month', label: '≤ 1 month' },
          { value: '1_6_month', label: '1–6 month' },
          { value: 'gte_6_month', label: '≥ 6 month' },
        ],
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
        type: 'tristate',
        label: 'Did you have fever or malaria in the last 3 months before coming to Goa?',
        options: YES_NO_DK,
      },
    ],
  },
  {
    id: 'travel',
    title: 'Section V — Travel in and outside Goa',
    fields: [
      { id: 'planning_visit_outside', type: 'boolean', label: 'Are you planning to visit outside Goa?', options: YES_NO },
      { id: 'departure_date', type: 'date', label: 'Date of departure (Out of Goa)', showIf: { field: 'planning_visit_outside', equals: true } },
      { id: 'return_date', type: 'date', label: 'Date of return back (Into Goa)', showIf: { field: 'planning_visit_outside', equals: true } },
      { id: 'places_visited', type: 'text', label: 'Place(s) / State(s) visited' },
      { id: 'fever_during_travel', type: 'boolean', label: 'During this travel outside Goa, did you have fever or were you diagnosed with malaria?', options: YES_NO },
      { id: 'treatment_given_travel', type: 'boolean', label: 'If yes (fever/malaria), was treatment given?', options: YES_NO, showIf: { field: 'fever_during_travel', equals: true } },
      { id: 'full_course_completed_travel', type: 'boolean', label: 'If treatment given, was the full course of medicines completed?', options: YES_NO, showIf: { field: 'treatment_given_travel', equals: true } },
      { id: 'place_of_treatment_travel', type: 'text', label: 'Place of treatment (if any)' },
    ],
  },
];

/**
 * Consent gate. The exact consent/assent wording and evidence required by the
 * ethics approval are NOT yet supplied, so this is a configurable placeholder
 * acknowledgement that must be approved before production use — it is not
 * fabricated consent language.
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
