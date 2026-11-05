import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Card, Body, Button } from '@/components/ui';
import { AudioGuidanceButton } from '@/components/AudioGuidanceButton';
import {
  healthWorkerApi,
  type HealthWorkerSearchWorker,
  type HealthWorkerSearchHousehold,
} from '@/api';
import { useSession } from '@/store/session';
import { palette, spacing, radius, fontSize, fontWeight, shadow } from '@/theme';

export default function WorkerSearchScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { token } = useSession();

  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [workers, setWorkers] = useState<HealthWorkerSearchWorker[]>([]);
  const [households, setHouseholds] = useState<HealthWorkerSearchHousehold[]>([]);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!token) return;
    const q = query.trim();
    if (!q) {
      Alert.alert(t('common.notice', 'Notice'), t('healthWorker.enterSearchQuery', 'Please enter a name, phone number, Worker ID, or QR code.'));
      return;
    }

    setLoading(true);
    try {
      const res = await healthWorkerApi.search(token, q);
      setWorkers(res.workers);
      setHouseholds(res.householdMembers);
      setSearched(true);
    } catch (e: any) {
      Alert.alert(t('common.error', 'Error'), e?.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={['bottom']}>
      <View style={{ padding: spacing.md, flex: 1 }}>
        {/* Search Input Box */}
        <View style={styles.searchBar}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('healthWorker.searchPlaceholder', 'Enter Worker ID, Name, Phone, or QR code...')}
            placeholderTextColor={palette.textMuted}
            style={styles.input}
            returnKeyType="search"
            onSubmitEditing={handleSearch}
            autoCapitalize="none"
          />
          <Pressable
            onPress={handleSearch}
            style={styles.searchBtn}
            accessibilityRole="button"
            accessibilityLabel="Search"
          >
            <Text style={styles.searchBtnText}>{t('common.search', 'Search')}</Text>
          </Pressable>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
          <Text style={styles.hintText}>
            {t('healthWorker.searchTip', 'Search by M3-XXXXXX code, 10-digit mobile number, or family member name')}
          </Text>
          <AudioGuidanceButton
            text="Worker and Household search. Type a name, phone number, or worker code and tap search to find surveillance records."
            size="small"
          />
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={palette.primary} />
          </View>
        ) : (
          <FlatList
            data={workers}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: spacing.xl }}
            ListHeaderComponent={() => (
              <>
                {searched && workers.length === 0 && households.length === 0 ? (
                  <Card style={{ marginVertical: spacing.md, alignItems: 'center', padding: spacing.lg }}>
                    <Text style={{ fontSize: 32, marginBottom: spacing.xs }}>🔎</Text>
                    <Text style={{ fontSize: fontSize.md, fontWeight: fontWeight.bold, color: palette.text }}>
                      {t('healthWorker.noResultsFound', 'No matching records found')}
                    </Text>
                    <Body style={{ textAlign: 'center', marginTop: spacing.xs }}>
                      {t('healthWorker.noResultsDesc', 'Verify spelling or register new worker during field visit.')}
                    </Body>
                  </Card>
                ) : null}

                {households.length > 0 ? (
                  <View style={{ marginBottom: spacing.md }}>
                    <Text style={styles.subHeader}>
                      {t('healthWorker.householdResults', 'Registered Family & Roommates')} ({households.length})
                    </Text>
                    {households.map((hh) => (
                      <Card key={hh.id} style={styles.resultCard}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.workerName}>{hh.fullName || 'Family Member'}</Text>
                            <Text style={styles.codeText}>{hh.memberCode} · {hh.relationship}</Text>
                            <Text style={styles.subText}>
                              {t('healthWorker.primaryWorker', 'Primary Worker')}: {hh.primaryWorker.name} ({hh.primaryWorker.workerCode})
                            </Text>
                          </View>
                          <Pressable
                            onPress={() => router.push(`/(health-worker)/screening?memberId=${hh.id}&memberName=${encodeURIComponent(hh.fullName || '')}`)}
                            style={styles.cardActionBtn}
                            accessibilityRole="button"
                          >
                            <Text style={styles.cardActionBtnText}>{t('healthWorker.screen', 'Screen')}</Text>
                          </Pressable>
                        </View>
                      </Card>
                    ))}
                  </View>
                ) : null}

                {workers.length > 0 ? (
                  <Text style={styles.subHeader}>
                    {t('healthWorker.workerResults', 'Migrant Workers')} ({workers.length})
                  </Text>
                ) : null}
              </>
            )}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => router.push(`/(health-worker)/worker-detail?workerId=${item.id}`)}
                style={styles.resultCard}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                      <Text style={styles.workerName}>{item.name}</Text>
                      <View style={[
                        styles.statusPill,
                        item.screeningStatus === 'COMPLETE' ? { backgroundColor: '#DCFCE7' } : { backgroundColor: '#FEF3C7' },
                      ]}>
                        <Text style={[
                          styles.statusPillText,
                          item.screeningStatus === 'COMPLETE' ? { color: '#166534' } : { color: '#92400E' },
                        ]}>
                          {item.screeningStatus === 'COMPLETE' ? 'Screened' : 'Unscreened'}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.codeText}>{item.workerCode} · 📱 {item.phone}</Text>
                    <Text style={styles.subText}>
                      🏗️ {item.currentSite || t('healthWorker.noActiveSite', 'No active construction site')}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 18, color: palette.textMuted }}>➔</Text>
                </View>
              </Pressable>
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  input: {
    flex: 1,
    height: 48,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.md,
    color: palette.text,
  },
  searchBtn: {
    backgroundColor: palette.primary,
    height: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 80,
  },
  searchBtnText: {
    color: '#FFFFFF',
    fontWeight: fontWeight.bold,
    fontSize: fontSize.md,
  },
  hintText: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  subHeader: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: palette.text,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginVertical: spacing.xs,
  },
  resultCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    minHeight: 56,
    ...shadow.card,
  },
  workerName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: palette.text,
  },
  codeText: {
    fontSize: fontSize.sm,
    color: palette.primary,
    fontWeight: fontWeight.medium,
    marginTop: 2,
  },
  subText: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    marginTop: 3,
  },
  statusPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
  },
  cardActionBtn: {
    backgroundColor: palette.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.sm,
    minHeight: 48,
    justifyContent: 'center',
  },
  cardActionBtnText: {
    color: '#FFFFFF',
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
  },
});
