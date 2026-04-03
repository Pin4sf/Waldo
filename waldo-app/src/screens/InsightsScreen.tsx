/**
 * InsightsScreen — Waldo's intelligence surface for mobile.
 *
 * Shows:
 * - Today's Morning Wag (fetched from day_activity)
 * - Recent Spots (observations Waldo has made)
 * - Discovered Patterns (cross-day learning)
 * - Evening Review (if available)
 */
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  fetchTodayActivity, fetchRecentSpots, fetchPatterns,
  type DayActivityData, type SpotItem, type PatternItem,
} from '@/adapters/sync/waldo-queries';

const SEVERITY_COLOR: Record<string, string> = {
  positive: '#34D399',
  neutral: '#9CA3AF',
  warning: '#F59E0B',
  critical: '#EF4444',
};

const TYPE_EMOJI: Record<string, string> = {
  health: '💓', behavior: '🔄', environment: '🌿',
  insight: '✦', alert: '⚡', learning: '📖',
};

const PATTERN_ICON: Record<string, string> = {
  weekly: '📅', correlation: '🔗', streak: '🔥', anomaly: '⚠️', recovery: '✅',
};

function SectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 10, marginTop: 20 }}>
      <Text style={{ fontSize: 16, fontWeight: '700', color: '#1A1A1A', flex: 1 }}>{title}</Text>
      {count !== undefined && (
        <Text style={{ fontSize: 12, color: '#9CA3AF' }}>{count}</Text>
      )}
    </View>
  );
}

function MorningWagCard({ text }: { text: string }) {
  return (
    <View style={{
      marginHorizontal: 16, marginBottom: 8,
      backgroundColor: '#FFF7ED', borderRadius: 16, borderWidth: 1, borderColor: '#FED7AA',
      padding: 16,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
        <Text style={{ fontSize: 16, marginRight: 6 }}>🌅</Text>
        <Text style={{ fontSize: 12, fontWeight: '600', color: '#9A3412', letterSpacing: 0.5, textTransform: 'uppercase' }}>
          Morning Wag
        </Text>
      </View>
      <Text style={{ fontSize: 15, color: '#1C1917', lineHeight: 24 }}>{text}</Text>
    </View>
  );
}

function EveningCard({ text }: { text: string }) {
  return (
    <View style={{
      marginHorizontal: 16, marginBottom: 8,
      backgroundColor: '#F0F9FF', borderRadius: 16, borderWidth: 1, borderColor: '#BAE6FD',
      padding: 16,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
        <Text style={{ fontSize: 16, marginRight: 6 }}>🌙</Text>
        <Text style={{ fontSize: 12, fontWeight: '600', color: '#075985', letterSpacing: 0.5, textTransform: 'uppercase' }}>
          Evening Review
        </Text>
      </View>
      <Text style={{ fontSize: 15, color: '#1C1917', lineHeight: 24 }}>{text}</Text>
    </View>
  );
}

function SpotCard({ spot }: { spot: SpotItem }) {
  const color = SEVERITY_COLOR[spot.severity] ?? '#9CA3AF';
  const emoji = TYPE_EMOJI[spot.type] ?? '•';

  return (
    <View style={{
      marginHorizontal: 16, marginBottom: 8,
      backgroundColor: '#FFFFFF', borderRadius: 14,
      borderLeftWidth: 3, borderLeftColor: color,
      padding: 14,
      shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <Text style={{ fontSize: 14 }}>{emoji}</Text>
        <Text style={{ fontSize: 13, fontWeight: '600', color: '#1A1A1A', flex: 1 }}>{spot.title}</Text>
        <Text style={{ fontSize: 11, color: '#9CA3AF' }}>{spot.date.slice(5).replace('-', '/')}</Text>
      </View>
      {spot.detail ? (
        <Text style={{ fontSize: 12, color: '#6B7280', lineHeight: 18 }}>{spot.detail}</Text>
      ) : null}
    </View>
  );
}

function PatternCard({ pattern }: { pattern: PatternItem }) {
  const confidenceNum = typeof pattern.confidence === 'number' ? pattern.confidence : parseFloat(String(pattern.confidence)) || 0;
  const confPct = Math.round(confidenceNum <= 1 ? confidenceNum * 100 : confidenceNum);
  const icon = PATTERN_ICON[pattern.type] ?? '🔗';

  return (
    <View style={{
      marginHorizontal: 16, marginBottom: 8,
      backgroundColor: '#FFFFFF', borderRadius: 14,
      padding: 14,
      shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
        <Text style={{ fontSize: 18, marginTop: 1 }}>{icon}</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 13, color: '#1A1A1A', lineHeight: 20, fontWeight: '500' }}>
            {pattern.summary}
          </Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
            <Text style={{ fontSize: 11, color: '#9CA3AF' }}>{pattern.type}</Text>
            <Text style={{ fontSize: 11, color: '#9CA3AF' }}>·</Text>
            <Text style={{ fontSize: 11, color: confPct >= 70 ? '#34D399' : '#F59E0B' }}>{confPct}% confident</Text>
            <Text style={{ fontSize: 11, color: '#9CA3AF' }}>·</Text>
            <Text style={{ fontSize: 11, color: '#9CA3AF' }}>{pattern.evidenceCount} weeks</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

export function InsightsScreen() {
  const [activity, setActivity] = useState<DayActivityData | null>(null);
  const [spots, setSpots] = useState<SpotItem[]>([]);
  const [patterns, setPatterns] = useState<PatternItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    const [act, sp, pt] = await Promise.all([
      fetchTodayActivity(),
      fetchRecentSpots(14),
      fetchPatterns(),
    ]);
    setActivity(act);
    setSpots(sp);
    setPatterns(pt);
  };

  useEffect(() => {
    loadData().finally(() => setLoading(false));
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const hasAnyContent = activity?.morningWag || activity?.eveningReview || spots.length > 0 || patterns.length > 0;

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FAFAF8' }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#F97316" />
          <Text style={{ fontSize: 13, color: '#9CA3AF', marginTop: 12 }}>Loading insights...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FAFAF8' }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12 }}>
        <Text style={{ fontSize: 22, fontWeight: '700', color: '#1A1A1A' }}>Insights</Text>
        <Text style={{ fontSize: 13, color: '#9CA3AF', marginTop: 2 }}>What Waldo noticed</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#F97316" />}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {!hasAnyContent && (
          <View style={{ alignItems: 'center', justifyContent: 'center', paddingTop: 60, paddingHorizontal: 32 }}>
            <Text style={{ fontSize: 48, marginBottom: 16 }}>✦</Text>
            <Text style={{ fontSize: 18, fontWeight: '600', textAlign: 'center', marginBottom: 8, color: '#1A1A1A' }}>
              Still collecting observations
            </Text>
            <Text style={{ fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 22 }}>
              Insights appear after a few days of data. Make sure your Apple Watch is syncing.
            </Text>
          </View>
        )}

        {/* Morning Wag */}
        {activity?.morningWag && (
          <>
            <SectionHeader title="Today's Brief" />
            <MorningWagCard text={activity.morningWag} />
          </>
        )}

        {/* Evening Review */}
        {activity?.eveningReview && (
          <>
            <SectionHeader title="Evening Review" />
            <EveningCard text={activity.eveningReview} />
          </>
        )}

        {/* Today's spots from day_activity */}
        {(activity?.spots ?? []).length > 0 && (
          <>
            <SectionHeader title="Spotted Today" count={(activity?.spots ?? []).length} />
            {(activity?.spots ?? []).map(spot => (
              <SpotCard key={spot.id} spot={spot as SpotItem} />
            ))}
          </>
        )}

        {/* Recent spots */}
        {spots.length > 0 && (
          <>
            <SectionHeader title="Recent Observations" count={spots.length} />
            {spots.slice(0, 10).map(spot => <SpotCard key={spot.id} spot={spot} />)}
          </>
        )}

        {/* Patterns */}
        {patterns.length > 0 && (
          <>
            <SectionHeader title="Discovered Patterns" count={patterns.length} />
            {patterns.map(pattern => <PatternCard key={pattern.id} pattern={pattern} />)}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
