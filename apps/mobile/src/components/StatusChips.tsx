import React from 'react';
import { malariaStatusColors, syncStateColors, transferStatusColors } from '@/theme';
import type { MalariaStatus, SyncState, TransferStatus } from '@m3/shared';
import { Chip } from './ui';

export function MalariaStatusChip({ status }: { status: MalariaStatus }) {
  const c = malariaStatusColors[status];
  return <Chip label={c.label} fg={c.fg} bg={c.bg} />;
}

export function TransferStatusChip({ status }: { status: TransferStatus }) {
  const c = transferStatusColors[status] ?? transferStatusColors.CANCELLED;
  return <Chip label={c.label} fg={c.fg} bg={c.bg} />;
}

export function SyncStateChip({ state }: { state: SyncState }) {
  const c = syncStateColors[state];
  return <Chip label={c.label} fg={c.fg} bg={c.bg} />;
}
