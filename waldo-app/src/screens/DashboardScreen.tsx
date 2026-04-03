/**
 * DashboardScreen — "Today" view.
 *
 * Shows:
 * - Nap Score gauge (local CRS, computed on-device from HealthKit)
 * - Morning Wag card (fetched from Supabase day_activity)
 * - Component cards (Sleep, HRV, Circadian, Activity)
 * - Productivity context (if Google connected: meetings, email, tasks)
 * - Sync badge
 * - Refresh button
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CrsGauge } from '@/components/CrsGauge';
import { ComponentCard } from '@/components/ComponentCard';
import { usePipeline } from '@/services/pipeline-provider';
import { useCrsStore } from '@/store/crsStore';
import type { CrsResult } from '@/crs/types';
import {
  fetchTodayActivity, fetchTodayProductivity, fetchSyncSummary,
  type DayActivityData, type ProductivityContext, type SyncSummary,
} from '@/adapters/sync/waldo-queries';

function formatTimeAgo(date: Date | null): string {
  if (!date) return 'Never updated';
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

function MorningWagCard({ text }: { text: string }) {
  return (
    <View style={{
      marginHorizontal: 16, marginBottom: 12,
      backgroundColor: '#FFF7ED', borderRadius: 16,
      borderWidth: 1, borderColor: '#FED7AA',
      padding: 16,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
        <Text style={{ fontSize: 14, marginRight: 6 }}>🌅</Text>
        <Text style={{ fontSize: 11, fontWeight: '600', color: '#9A3412', letterSpacing: 0.5, textTransform: 'uppercase' }}>
          Morning Wag
        </Text>
      </View>
      <Text style={{ fontSize: 15, color: '#1C1917', lineHeight: 24 }}>{text}</Text>
    </View>
  );
}

function ProductivityBanner({ data, sync }: { data: ProductivityContext; sync: SyncSummary }) {
  if (!sync.googleConnected) return null;

  const hasMeetings = data.meetingLoadScore !== null;
  const hasEmail = data.totalEmails !== null;
  const hasTasks = data.pendingTasks !== null;

  if (!hasMeetings && !hasEmail && !hasTasks) return null;

  const mlsColor = (data.meetingLoadScore ?? 0) > 8 ? '#EF4444' : (data.meetingLoadScore ?? 0) > 5 ? '#F59E0B' : '#34D399';

  return (
    <View style={{
      marginHorizontal: 16, marginBottom: 12,
      backgroundColor: '#F8FAFC', borderRadius: 16,
      borderWidth: 1, borderColor: '#E2E8F0',
      padding: 14,
    }}>
      <Text style={{ fontSize: 11, fontWeight: '600', color: '#64748B', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 10 }}>
        Today's Load
      </Text>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {hasMeetings && (
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: mlsColor }}>
              {data.meetingLoadScore?.toFixed(1)}
            </Text>
            <Text style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}>MLS</Text>
            {data.eventCount !== null && (
              <Text style={{ fontSize: 10, color: '#94A3B8' }}>{data.eventCount} meetings</Text>
            )}
          </View>
        )}
        {hasEmail && (
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#334155' }}>
              {data.totalEmails}
            </Text>
            <Text style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}>Emails</Text>
            {data.afterHoursRatio !== null && data.afterHoursRatio > 0 && (
              <Text style={{ fontSize: 10, color: data.afterHoursRatio > 0.3 ? '#EF4444' : '#94A3B8' }}>
                {Math.round((data.afterHoursRatio ?? 0) * 100)}% after hrs
              </Text>
            )}
          </View>
        )}
        {hasTasks && (
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: (data.overdueTasks ?? 0) > 3 ? '#EF4444' : '#334155' }}>
              {data.pendingTasks}
            </Text>
            <Text style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}>Pending</Text>
            {(data.overdueTasks ?? 0) > 0 && (
              <Text style={{ fontSize: 10, color: '#EF4444' }}>{data.overdueTasks} overdue</Text>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

function SleepWarning({ crs }: { crs: CrsResult }) {
  if (crs.sleep.dataAvailable) return null;
  return (
    <View style={{ backgroundColor: '#FFFBEB', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, marginHorizontal: 16, marginBottom: 12, borderWidth: 1, borderColor: '#FDE68A' }}>
      <Text style={{ fontSize: 13, color: '#92400E' }}>
        No sleep data — wear your Watch to sleep tonight for a full Nap Score
      </Text>
    </View>
  );
}

function SyncBadge({ lastSync, provider }: { lastSync: string | null; provider: string }) {
  if (!lastSync) return null;
  const mins = Math.floor((Date.now() - new Date(lastSync).getTime()) / 60000);
  const label = mins < 60 ? `${provider} synced ${mins}m ago` : `${provider} synced ${Math.floor(mins / 60)}h ago`;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#34D399' }} />
      <Text style={{ fontSize: 10, color: '#9CA3AF' }}>{label}</Text>
    </View>
  );
}

function NoDataView({ onRefresh }: { onRefresh: () => void }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
      <Text style={{ fontSize: 64, marginBottom: 16 }}>🐕</Text>
      <Text style={{ fontSize: 24, fontWeight: '700', textAlign: 'center', marginBottom: 8, color: '#1A1A1A' }}>
        Still learning
      </Text>
      <Text style={{ fontSize: 15, color: '#6B7280', textAlign: 'center', lineHeight: 24 }}>
        Wear your Apple Watch overnight and your first Nap Score will appear in the morning.
      </Text>
      <Text style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', marginTop: 12 }}>
        Full accuracy in 7 days.
      </Text>
      <Pressable
        onPress={onRefresh}
        style={{ marginTop: 24, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, backgroundColor: '#F97316' }}
      >
        <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 15 }}>Sync Now</Text>
      </Pressable>
    </View>
  );
}

export function DashboardScreen() {
  const pipeline = usePipeline();
  const { crsResult, isComputing, lastUpdatedAt } = useCrsStore();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Remote data
  const [activity, setActivity] = useState<DayActivityData | null>(null);
  const [productivity, setProductivity] = useState<ProductivityContext | null>(null);
  const [syncSummary, setSyncSummary] = useState<SyncSummary | null>(null);

  const loadRemoteData = useCallback(async () => {
    const [act, prod, sync] = await Promise.all([
      fetchTodayActivity().catch(() => null),
      fetchTodayProductivity().catch(() => null),
      fetchSyncSummary().catch(() => null),
    ]);
    setActivity(act);
    setProductivity(prod);
    setSyncSummary(sync);
  }, []);

  useEffect(() => { loadRemoteData(); }, []);

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    await Promise.all([
      pipeline?.runPipeline('manual_refresh').catch(() => {}),
      loadRemoteData(),
    ]);
    setIsRefreshing(false);
  };

  const crs = crsResult;
  const isLoading = isComputing && !crs;

  const displayZone = !crs || crs.score < 0 ? null
    : crs.zone === 'peak' ? 'peak' as const
    : crs.zone === 'moderate' ? 'moderate' as const
    : 'low' as const;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FAFAF8' }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40, flexGrow: 1 }}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor="#F97316" />
        }
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12 }}>
          <Text style={{ fontSize: 26, fontWeight: '800', color: '#1A1A1A', letterSpacing: -0.5 }}>
            Waldo
          </Text>
          <View style={{ flex: 1 }} />
          <View style={{ alignItems: 'flex-end', gap: 2 }}>
            <Text style={{ fontSize: 12, color: '#9CA3AF' }}>{formatTimeAgo(lastUpdatedAt)}</Text>
            {syncSummary?.calendarLastSync && (
              <SyncBadge lastSync={syncSummary.calendarLastSync} provider="Calendar" />
            )}
          </View>
        </View>

        {isLoading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 }}>
            <ActivityIndicator size="large" color="#F97316" />
            <Text style={{ fontSize: 13, color: '#9CA3AF', marginTop: 12 }}>Reading your health data...</Text>
          </View>
        ) : !crs || crs.score < 0 ? (
          <NoDataView onRefresh={handleRefresh} />
        ) : (
          <>
            {/* Morning Wag */}
            {activity?.morningWag && <MorningWagCard text={activity.morningWag} />}

            {/* CRS Gauge */}
            <View style={{ alignItems: 'center', paddingVertical: 8 }}>
              <CrsGauge score={crs.score} zone={displayZone} size={180} />
            </View>

            {/* Summary line */}
            <Text style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center', marginBottom: 12 }}>
              {crs.componentsWithData}/4 components · ±{crs.confidence} confidence
            </Text>

            {/* Sleep warning */}
            <SleepWarning crs={crs} />

            {/* Productivity context (Google connected) */}
            {productivity && syncSummary && (
              <ProductivityBanner data={productivity} sync={syncSummary} />
            )}

            {/* Component cards — 2×2 grid */}
            <View style={{ paddingHorizontal: 10, marginBottom: 4 }}>
              <View style={{ flexDirection: 'row', marginBottom: 8 }}>
                <ComponentCard label="Sleep" emoji="😴" component={crs.sleep} />
                <ComponentCard label="HRV" emoji="💓" component={crs.hrv} />
              </View>
              <View style={{ flexDirection: 'row' }}>
                <ComponentCard label="Circadian" emoji="☀️" component={crs.circadian} />
                <ComponentCard label="Activity" emoji="🏃" component={crs.activity} />
              </View>
            </View>

            {/* Disclaimer */}
            <Text style={{ fontSize: 11, color: '#D1D5DB', textAlign: 'center', paddingHorizontal: 32, marginTop: 20 }}>
              Not a medical device. Nap Score is for informational purposes only.
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
