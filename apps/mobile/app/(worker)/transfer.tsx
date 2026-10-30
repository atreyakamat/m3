import React, { useCallback, useState } from 'react';
import { View, Text, Alert, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { TransferStatus } from '@m3/shared';
import { Screen, Card, TextField, SelectRow, Button, Body } from '@/components/ui';
import { TransferStatusChip } from '@/components/StatusChips';
import { transferApi, sitesApi, workerApi, type TransferDto, type SiteSummary, type WorkerProfile, ApiError } from '@/api';
import { useSession } from '@/store/session';
import { palette, spacing, fontSize } from '@/theme';

export default function TransferScreen() {
  const { t } = useTranslation();
  const { token } = useSession();
  const [profile, setProfile] = useState<WorkerProfile | null>(null);
  const [requests, setRequests] = useState<TransferDto[]>([]);
  const [search, setSearch] = useState('');
  const [sites, setSites] = useState<SiteSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [p, r] = await Promise.all([workerApi.me(token), transferApi.mine(token)]);
      setProfile(p);
      setRequests(r);
    } catch (e) {
      if (e instanceof ApiError && e.status !== 0) Alert.alert(t('transfer.title'), e.message);
    } finally {
      setLoading(false);
    }
  }, [token, t]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function doSearch(q: string) {
    setSearch(q);
    if (!token) return;
    const res = await sitesApi.search(token, q || undefined);
    setSites(res.items.filter((s) => s.siteId !== profile?.currentSite?.siteId));
  }

  async function request(toSiteId: string) {
    if (!token) return;
    try {
      setBusy(true);
      await transferApi.create(token, { toSiteId });
      setSearch(''); setSites([]);
      await load();
    } catch (e) {
      Alert.alert(t('transfer.title'), e instanceof ApiError ? e.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  async function act(fn: () => Promise<unknown>) {
    try { setBusy(true); await fn(); await load(); }
    catch (e) { Alert.alert(t('transfer.title'), e instanceof ApiError ? e.message : 'Error'); }
    finally { setBusy(false); }
  }

  if (loading) return <Screen><ActivityIndicator color={palette.primary} style={{ marginTop: spacing.xxl }} /></Screen>;

  return (
    <Screen>
      <Card accent={palette.info}>
        <Text style={{ color: palette.textMuted, fontSize: fontSize.sm }}>{t('transfer.from')}</Text>
        <Text style={{ fontSize: fontSize.lg, fontWeight: '600', color: palette.text }}>
          {profile?.currentSite?.name ?? t('dashboard.noSite')}
        </Text>
      </Card>

      {profile?.currentSite ? (
        <Card>
          <Text style={{ fontSize: fontSize.md, fontWeight: '600', color: palette.text, marginBottom: spacing.sm }}>
            {t('transfer.request')}
          </Text>
          <TextField label={t('transfer.chooseDestination')} value={search} onChangeText={doSearch} placeholder={t('site.search')} />
          {sites.map((s) => (
            <SelectRow key={s.siteId} label={s.name} sublabel={`${s.siteId} · ${s.area}`} onPress={() => void request(s.siteId)} />
          ))}
        </Card>
      ) : null}

      <Text style={{ fontSize: fontSize.md, fontWeight: '700', color: palette.text, marginTop: spacing.sm }}>
        {t('transfer.myRequests')}
      </Text>
      {requests.length === 0 ? <Body muted>—</Body> : null}
      {requests.map((r) => {
        const pendingWorker = r.status === ('PENDING_WORKER_RESPONSE' as TransferStatus);
        const open = !['ACCEPTED', 'REJECTED', 'CANCELLED'].includes(r.status);
        return (
          <Card key={r.id}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontWeight: '600', color: palette.text, flex: 1 }}>
                {(r.fromSite?.name ?? '—')} → {r.toSite.name}
              </Text>
              <TransferStatusChip status={r.status as TransferStatus} />
            </View>
            <Body muted>{r.initiatorType === 'CONTRACTOR' ? 'Contractor-initiated' : 'You requested'}</Body>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
              {pendingWorker ? (
                <>
                  <View style={{ flex: 1 }}><Button label={t('transfer.accept')} onPress={() => void act(() => transferApi.accept(token!, r.id))} loading={busy} /></View>
                  <View style={{ flex: 1 }}><Button label={t('transfer.reject')} variant="danger" onPress={() => void act(() => transferApi.reject(token!, r.id))} loading={busy} /></View>
                </>
              ) : open ? (
                <View style={{ flex: 1 }}><Button label={t('transfer.cancel')} variant="ghost" onPress={() => void act(() => transferApi.cancel(token!, r.id))} loading={busy} /></View>
              ) : null}
            </View>
          </Card>
        );
      })}
    </Screen>
  );
}
