import React from 'react';
import { useTranslation } from 'react-i18next';
import { malariaStatusColors, syncStateColors, transferStatusColors } from '@/theme';
import type { MalariaStatus, SyncState, TransferStatus } from '@m3/shared';
import { Chip } from './ui';

export function MalariaStatusChip({ status }: { status: MalariaStatus }) {
  const { t } = useTranslation();
  const c = malariaStatusColors[status];
  const label = t(`status.malaria_${status.toLowerCase()}`, c.label);
  return <Chip label={label} fg={c.fg} bg={c.bg} />;
}

export function TransferStatusChip({ status }: { status: TransferStatus }) {
  const { t } = useTranslation();
  const c = transferStatusColors[status] ?? transferStatusColors.CANCELLED;
  const label = t(`status.transfer_${status.toLowerCase()}`, c.label);
  return <Chip label={label} fg={c.fg} bg={c.bg} />;
}

export function SyncStateChip({ state }: { state: SyncState }) {
  const { t } = useTranslation();
  const c = syncStateColors[state];
  const label = state === 'SYNCED' ? t('status.synced') : (state === 'PENDING' || (state as string) === 'LOCAL' ? t('status.pendingSync') : (state === 'FAILED' ? t('status.failed') : c.label));
  return <Chip label={label} fg={c.fg} bg={c.bg} />;
}
