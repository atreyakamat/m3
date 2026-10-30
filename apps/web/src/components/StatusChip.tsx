import type { MalariaStatus, TransferStatus, SyncState } from '@m3/shared';
import { malariaStatusColors, transferStatusColors, syncStateColors } from '../lib/tokens';
import { Chip } from './ui';

export function MalariaStatusChip({ status }: { status: MalariaStatus }) {
  const c = malariaStatusColors[status];
  return (
    <Chip fg={c.fg} bg={c.bg}>
      {c.label}
    </Chip>
  );
}

export function TransferStatusChip({ status }: { status: TransferStatus }) {
  const c = transferStatusColors[status];
  return (
    <Chip fg={c.fg} bg={c.bg}>
      {c.label}
    </Chip>
  );
}

export function SyncStateChip({ state }: { state: SyncState }) {
  const c = syncStateColors[state];
  return (
    <Chip fg={c.fg} bg={c.bg}>
      {c.label}
    </Chip>
  );
}
