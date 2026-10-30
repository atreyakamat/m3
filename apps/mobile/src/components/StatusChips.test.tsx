import React from 'react';
import { render } from '@testing-library/react-native';
import { MalariaStatusChip, TransferStatusChip } from './StatusChips';

describe('status chips', () => {
  it('renders the malaria status label (never infers negative)', () => {
    const { getByText } = render(<MalariaStatusChip status="NO_RESULT" />);
    expect(getByText('No result recorded')).toBeTruthy();
  });

  it('renders a positive malaria chip', () => {
    const { getByText } = render(<MalariaStatusChip status="POSITIVE" />);
    expect(getByText('Positive')).toBeTruthy();
  });

  it('renders a transfer status label', () => {
    const { getByText } = render(<TransferStatusChip status="PENDING_CURRENT_CONTRACTOR" />);
    expect(getByText('Pending current contractor')).toBeTruthy();
  });
});
