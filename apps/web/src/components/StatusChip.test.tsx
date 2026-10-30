import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MalariaStatusChip, TransferStatusChip } from './StatusChip';

describe('MalariaStatusChip', () => {
  it('renders NO_RESULT as "No result recorded" (never negative)', () => {
    render(<MalariaStatusChip status="NO_RESULT" />);
    expect(screen.getByText('No result recorded')).toBeInTheDocument();
  });

  it('renders POSITIVE label', () => {
    render(<MalariaStatusChip status="POSITIVE" />);
    expect(screen.getByText('Positive')).toBeInTheDocument();
  });
});

describe('TransferStatusChip', () => {
  it('renders a pending worker-response label', () => {
    render(<TransferStatusChip status="PENDING_WORKER_RESPONSE" />);
    expect(screen.getByText('Pending your response')).toBeInTheDocument();
  });
});
