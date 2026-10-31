/**
 * Tests for QuestionnaireNavigator — section navigation, date validation,
 * conditional field logic, government ID validation, PIN code lookup,
 * read-only mobile number, and consent gate behaviour.
 */

import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import '@/i18n'; // Initialize i18next
import { QuestionnaireNavigator } from './QuestionnaireNavigator';
import { WORKER_SCREENING_SECTIONS } from '@m3/shared';

// Mock @react-native-community/datetimepicker — not available in Jest environment
jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function renderNavigator(overrides?: Partial<Parameters<typeof QuestionnaireNavigator>[0]>) {
  const onChange = jest.fn();
  const onConsentToggle = jest.fn();
  const onComplete = jest.fn();
  const onSaveDraft = jest.fn();
  const result = render(
    <QuestionnaireNavigator
      answers={{}}
      onChange={onChange}
      consent={false}
      onConsentToggle={onConsentToggle}
      onComplete={onComplete}
      onSaveDraft={onSaveDraft}
      {...overrides}
    />,
  );
  return { ...result, onChange, onConsentToggle, onComplete, onSaveDraft };
}

// ─── Section navigation ───────────────────────────────────────────────────────

describe('QuestionnaireNavigator — section navigation', () => {
  it('shows Section I — Personal Details on first render', () => {
    const { getByText } = renderNavigator();
    expect(getByText('Section I — Personal Details')).toBeTruthy();
  });

  it('shows "Continue →" on the first section, not "Submit"', () => {
    const { getByText, queryByText } = renderNavigator();
    expect(getByText('Continue →')).toBeTruthy();
    expect(queryByText('Submit screening')).toBeNull();
  });

  it('shows progress indicator "Section 1 of 4"', () => {
    const { getByText } = renderNavigator();
    expect(getByText('Section 1 of 4')).toBeTruthy();
  });

  it('does not show Previous button on the first section', () => {
    const { queryByText } = renderNavigator();
    expect(queryByText(/previous/i)).toBeNull();
  });

  it('advances to the next section after pressing Continue with required fields filled', async () => {
    const { getByText } = renderNavigator({
      answers: { full_name: 'Test Worker', gender: 'male', mobile_number: '9876543210' },
    });
    await act(async () => {
      fireEvent.press(getByText('Continue →'));
    });
    expect(getByText('Section II — Past History of Malaria')).toBeTruthy();
    expect(getByText('Section 2 of 4')).toBeTruthy();
  });

  it('does NOT advance if required fields are missing', async () => {
    const { getByText } = renderNavigator({ answers: {} });
    await act(async () => {
      fireEvent.press(getByText('Continue →'));
    });
    // Still on Section I
    expect(getByText('Section I — Personal Details')).toBeTruthy();
  });

  it('does NOT advance if mobile number is less than 10 digits', async () => {
    const { getByText } = renderNavigator({
      answers: { full_name: 'Test Worker', gender: 'male', mobile_number: '98765' },
    });
    await act(async () => {
      fireEvent.press(getByText('Continue →'));
    });
    // Validation fails, stays on Section I
    expect(getByText('Section I — Personal Details')).toBeTruthy();
  });

  it('shows validation error text when required fields are missing', async () => {
    const { getAllByText } = renderNavigator({ answers: {} });
    await act(async () => {
      fireEvent.press(getAllByText('Continue →')[0]);
    });
    const errors = getAllByText('This field is required');
    expect(errors.length).toBeGreaterThan(0);
  });

  it('shows Previous button on the second section', async () => {
    const { getByText } = renderNavigator({
      answers: { full_name: 'Test Worker', gender: 'male', mobile_number: '9876543210' },
    });
    await act(async () => {
      fireEvent.press(getByText('Continue →'));
    });
    expect(getByText('← Previous')).toBeTruthy();
  });

  it('goes back to the previous section when Previous is pressed', async () => {
    const { getByText } = renderNavigator({
      answers: { full_name: 'Test Worker', gender: 'male', mobile_number: '9876543210' },
    });
    await act(async () => {
      fireEvent.press(getByText('Continue →'));
    });
    expect(getByText('Section II — Past History of Malaria')).toBeTruthy();
    await act(async () => {
      fireEvent.press(getByText('← Previous'));
    });
    expect(getByText('Section I — Personal Details')).toBeTruthy();
  });

  it('shows Submit on the last section', async () => {
    const lastSection = [WORKER_SCREENING_SECTIONS[WORKER_SCREENING_SECTIONS.length - 1]];
    const { getByText, queryByText } = renderNavigator({ sections: lastSection });
    expect(getByText('Submit screening')).toBeTruthy();
    expect(queryByText('Continue →')).toBeNull();
  });
});

// ─── Section I Requirements ───────────────────────────────────────────────────

describe('QuestionnaireNavigator — Section I specialized inputs', () => {
  it('renders registered mobile number as read-only', () => {
    const { getByText, getAllByText } = renderNavigator({
      answers: { mobile_number: '9800000001' },
    });
    expect(getByText('9800000001')).toBeTruthy();
    expect(getAllByText(/Read-only/i).length).toBeGreaterThan(0);
  });

  it('displays Aadhaar input when Aadhaar ID type is active', () => {
    const { getByText } = renderNavigator({
      answers: { gov_id_type: 'aadhaar' },
    });
    expect(getByText(/Aadhaar Number \(12 digits\)/i)).toBeTruthy();
  });

  it('displays active construction site address when staying on site premises', () => {
    const { getByText } = renderNavigator({
      answers: { present_address_type: 'site_premises' },
      siteAddress: 'Candolim Tower Project · Bardez',
    });
    expect(getByText('Candolim Tower Project · Bardez')).toBeTruthy();
  });

  it('displays Goa district selector when staying at another location', () => {
    const { getByText } = renderNavigator({
      answers: { present_address_type: 'other_location' },
    });
    expect(getByText('North Goa')).toBeTruthy();
    expect(getByText('South Goa')).toBeTruthy();
  });
});

// ─── Conditional fields ───────────────────────────────────────────────────────

describe('QuestionnaireNavigator — conditional fields', () => {
  const malariaSection = [WORKER_SCREENING_SECTIONS.find((s) => s.id === 'malaria_history')!];

  it('hides "how many times in last 2 years" when diagnosed_malaria is not "yes"', () => {
    const { queryByText } = renderNavigator({
      answers: { diagnosed_malaria: 'no' },
      sections: malariaSection,
    });
    expect(queryByText(/how many times in the last 2 years/i)).toBeNull();
  });

  it('shows "how many times in last 2 years" when diagnosed_malaria is "yes"', () => {
    const { getByText } = renderNavigator({
      answers: { diagnosed_malaria: 'yes' },
      sections: malariaSection,
    });
    expect(getByText(/how many times in the last 2 years/i)).toBeTruthy();
  });

  const clinicalSection = [WORKER_SCREENING_SECTIONS.find((s) => s.id === 'clinical')!];

  it('hides measured temperature when fever_today is not "yes"', () => {
    const { queryByText } = renderNavigator({
      answers: {},
      sections: clinicalSection,
    });
    expect(queryByText(/measured temperature/i)).toBeNull();
  });

  it('shows measured temperature when fever_today is "yes"', () => {
    const { getByText } = renderNavigator({
      answers: { fever_today: 'yes' },
      sections: clinicalSection,
    });
    expect(getByText(/measured temperature/i)).toBeTruthy();
  });
});

// ─── Consent gate ─────────────────────────────────────────────────────────────

describe('QuestionnaireNavigator — consent gate', () => {
  const lastSection = [WORKER_SCREENING_SECTIONS[WORKER_SCREENING_SECTIONS.length - 1]];

  it('renders the consent gate on the last section', () => {
    const { getByText } = renderNavigator({ sections: lastSection });
    expect(getByText('Informed Consent')).toBeTruthy();
    expect(getByText(/the worker has given informed consent/i)).toBeTruthy();
  });

  it('does NOT call onComplete when consent is not given', async () => {
    const { getByText, onComplete } = renderNavigator({
      consent: false,
      sections: lastSection,
    });
    await act(async () => {
      fireEvent.press(getByText('Submit screening'));
    });
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('calls onComplete when consent is given and fields valid', async () => {
    const { getByText, onComplete } = renderNavigator({
      consent: true,
      answers: { duration_in_goa: '1_6_months' },
      sections: lastSection,
    });
    await act(async () => {
      fireEvent.press(getByText('Submit screening'));
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
