import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen, Card, TextField, SelectRow, Body, Button } from '@/components/ui';
import { sitesApi, workerApi, type LocationNodeDto, type SiteSummary, ApiError } from '@/api';
import { useSession } from '@/store/session';
import { palette, spacing, fontSize } from '@/theme';

const LEVELS = ['STATE', 'DISTRICT', 'TALUKA', 'AREA'] as const;

export default function SiteScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { token } = useSession();
  const [levelIdx, setLevelIdx] = useState(0);
  const [nodes, setNodes] = useState<LocationNodeDto[]>([]);
  const [path, setPath] = useState<LocationNodeDto[]>([]);
  const [areaId, setAreaId] = useState<string | null>(null);
  const [sites, setSites] = useState<SiteSummary[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  async function loadLevel(idx: number, parentId?: string) {
    if (!token) return;
    setLoading(true);
    try {
      setNodes(await sitesApi.locations(token, LEVELS[idx], parentId));
    } catch (e) {
      if (e instanceof ApiError) Alert.alert(t('site.title'), e.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadSites(area: string | null, q: string) {
    if (!token) return;
    setLoading(true);
    try {
      const res = await sitesApi.search(token, q || undefined, area || undefined);
      setSites(res.items);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadLevel(0); }, [token]);

  function pickNode(node: LocationNodeDto) {
    const nextIdx = levelIdx + 1;
    const newPath = [...path.slice(0, levelIdx), node];
    setPath(newPath);
    if (node.level === 'AREA') {
      setAreaId(node.id);
      void loadSites(node.id, '');
    } else {
      setLevelIdx(nextIdx);
      void loadLevel(nextIdx, node.id);
    }
  }

  async function selectSite(siteId: string) {
    if (!token) return;
    try {
      await workerApi.selectSite(token, siteId);
      Alert.alert(t('site.title'), t('site.select'));
      router.replace('/(worker)/dashboard');
    } catch (e) {
      Alert.alert(t('site.title'), e instanceof ApiError ? e.message : 'Error');
    }
  }

  return (
    <Screen>
      <Card accent={palette.secondary}>
        <Body muted>{path.map((p) => p.name).join('  ›  ') || t('site.title')}</Body>
      </Card>

      <TextField
        label={t('site.search')}
        value={search}
        onChangeText={(v) => { setSearch(v); void loadSites(areaId, v); }}
        placeholder="Site name or ID"
      />

      {loading ? <ActivityIndicator color={palette.primary} /> : null}

      {/* Search results or area sites take priority */}
      {(areaId || search) ? (
        <View>
          <Text style={{ fontSize: fontSize.md, fontWeight: '600', color: palette.text, marginBottom: spacing.sm }}>
            {t('nav.site')}
          </Text>
          {sites.length === 0 && !loading ? <Body muted>—</Body> : null}
          {sites.map((s) => (
            <SelectRow key={s.siteId} label={s.name} sublabel={`${s.siteId} · ${s.area}`} onPress={() => void selectSite(s.siteId)} />
          ))}
        </View>
      ) : (
        <View>
          <Text style={{ fontSize: fontSize.md, fontWeight: '600', color: palette.text, marginBottom: spacing.sm }}>
            {t(`site.${LEVELS[levelIdx].toLowerCase()}`)}
          </Text>
          {nodes.map((n) => (
            <SelectRow key={n.id} label={n.name} onPress={() => pickNode(n)} />
          ))}
        </View>
      )}

      {levelIdx > 0 || areaId ? (
        <Button
          label={t('common.back')}
          variant="ghost"
          onPress={() => {
            if (areaId) { setAreaId(null); setSites([]); return; }
            const idx = Math.max(0, levelIdx - 1);
            setLevelIdx(idx);
            void loadLevel(idx, idx === 0 ? undefined : path[idx - 1]?.id);
          }}
        />
      ) : null}
    </Screen>
  );
}
