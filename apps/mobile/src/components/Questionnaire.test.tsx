import React from 'react';
import { render } from '@testing-library/react-native';
import { Questionnaire } from './Questionnaire';
import { WORKER_SCREENING_SECTIONS } from '@m3/shared';

describe('Questionnaire renderer', () => {
  it('renders the personal-details section fields from the shared definition', () => {
    const personal = WORKER_SCREENING_SECTIONS.filter((s) => s.id === 'personal');
    const { getByText } = render(
      <Questionnaire answers={{}} onChange={() => undefined} sections={personal} />,
    );
    expect(getByText('Section I — Personal Details')).toBeTruthy();
    expect(getByText('Full name (as per ID) *')).toBeTruthy();
  });

  it('respects showIf — hides a conditional field until its trigger matches', () => {
    const clinical = WORKER_SCREENING_SECTIONS.filter((s) => s.id === 'clinical');
    const hidden = render(<Questionnaire answers={{}} onChange={() => undefined} sections={clinical} />);
    // axillary temperature only shows when fever_today === 'yes'
    expect(hidden.queryByText(/measured temperature/i)).toBeNull();

    const shown = render(
      <Questionnaire answers={{ fever_today: 'yes' }} onChange={() => undefined} sections={clinical} />,
    );
    expect(shown.queryByText(/measured temperature/i)).toBeTruthy();
  });
});
