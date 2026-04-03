/**
 * ProfileScreen — user info, connected integrations, settings, sign out.
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, Pressable, Switch,
  ActivityIndicator, Linking, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchWaldoProfile, fetchSyncSummary, type WaldoUserProfile, type SyncSummary } from '@/adapters/sync/waldo-queries';
import { supabase, getWaldoUserId } from '@/adapters/sync/supabase-client';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

function SettingRow({
  label, value, sub, onPress, showArrow = false,
}: { label: string; value?: string; sub?: string; onPress?: () => void; showArrow?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 14,
        backgroundColor: pressed && onPress ? '#F5F5F3' : '#FFFFFF',
        borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
      })}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, color: '#1A1A1A', fontWeight: '500' }}>{label}</Text>
        {sub && <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{sub}</Text>}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {value && <Text style={{ fontSize: 14, color: '#6B7280' }}>{value}</Text>}
        {showArrow && <Text style={{ fontSize: 16, color: '#9CA3AF' }}>›</Text>}
      </View>
    </Pressable>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginHorizontal: 16, marginBottom: 20 }}>
      <Text style={{ fontSize: 12, fontWeight: '600', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, marginLeft: 4 }}>
        {title}
      </Text>
      <View style={{ backgroundColor: '#FFFFFF', borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#F3F4F6' }}>
        {children}
      </View>
    </View>
  );
}

function IntegrationRow({ label, status, onConnect }: {
  label: string; status: 'connected' | 'not_connected' | 'expired'; onConnect?: () => void;
}) {
  const dot = status === 'connected' ? '#34D399' : status === 'expired' ? '#F59E0B' : '#D1D5DB';
  const statusLabel = status === 'connected' ? 'Connected' : status === 'expired' ? 'Expired' : 'Not connected';

  return (
    <Pressable
      onPress={status !== 'connected' ? onConnect : undefined}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14,
        backgroundColor: pressed && status !== 'connected' ? '#F5F5F3' : '#FFFFFF',
        borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
      })}
    >
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dot, marginRight: 12 }} />
      <Text style={{ fontSize: 15, color: '#1A1A1A', fontWeight: '500', flex: 1 }}>{label}</Text>
      {status !== 'connected' ? (
        <Text style={{ fontSize: 13, color: '#F97316', fontWeight: '500' }}>Connect →</Text>
      ) : (
        <Text style={{ fontSize: 13, color: '#9CA3AF' }}>{statusLabel}</Text>
      )}
    </Pressable>
  );
}

function timeSince(iso: string | null): string {
  if (!iso) return 'Never synced';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function ProfileScreen() {
  const [profile, setProfile] = useState<WaldoUserProfile | null>(null);
  const [syncs, setSyncs] = useState<SyncSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    Promise.all([fetchWaldoProfile(), fetchSyncSummary()]).then(([p, s]) => {
      setProfile(p);
      setSyncs(s);
      setLoading(false);
    });
  }, []);

  const handleConnectGoogle = async () => {
    const userId = await getWaldoUserId();
    if (!userId) { Alert.alert('Not signed in'); return; }
    const url = `${SUPABASE_URL}/functions/v1/oauth-google/connect?user_id=${userId}&scopes=calendar,gmail,tasks`;
    await Linking.openURL(url);
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign out',
      'You will need to sign in again to access your Waldo.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out', style: 'destructive',
          onPress: async () => {
            setSigningOut(true);
            await supabase.auth.signOut();
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FAFAF8' }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#F97316" />
        </View>
      </SafeAreaView>
    );
  }

  const googleStatus = !syncs?.googleConnected ? 'not_connected' : 'connected';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FAFAF8' }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 16 }}>
        <Text style={{ fontSize: 22, fontWeight: '700', color: '#1A1A1A' }}>Profile</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Avatar + name */}
        <View style={{ alignItems: 'center', paddingBottom: 24 }}>
          <View style={{
            width: 72, height: 72, borderRadius: 36, backgroundColor: '#FFF7ED',
            alignItems: 'center', justifyContent: 'center', marginBottom: 12,
            borderWidth: 2, borderColor: '#FED7AA',
          }}>
            <Text style={{ fontSize: 36 }}>🐕</Text>
          </View>
          <Text style={{ fontSize: 20, fontWeight: '700', color: '#1A1A1A' }}>
            {profile?.name ?? 'Your Waldo'}
          </Text>
          <Text style={{ fontSize: 13, color: '#9CA3AF', marginTop: 4 }}>
            {profile?.timezone ?? 'UTC'}
          </Text>
        </View>

        {/* Identity */}
        <SectionCard title="Identity">
          <SettingRow label="Name" value={profile?.name ?? '—'} />
          <SettingRow label="Wake time" value={profile?.wakeTimeEstimate ?? '07:00'} />
          <SettingRow label="Evening review" value={profile?.preferredEveningTime ?? '21:00'} />
          <SettingRow label="Wearable" value={profile?.wearableType?.replace('_', ' ') ?? 'Unknown'} />
          <SettingRow
            label="Last health sync"
            value={profile?.lastHealthSync ? timeSince(profile.lastHealthSync) : 'Never'}
          />
        </SectionCard>

        {/* Integrations */}
        <SectionCard title="Integrations">
          <IntegrationRow
            label="Google Workspace"
            status={googleStatus}
            onConnect={handleConnectGoogle}
          />
          {syncs?.googleConnected && (
            <>
              <SettingRow
                label="Calendar"
                value={timeSince(syncs.calendarLastSync)}
                sub="Syncs every 30 minutes"
              />
              <SettingRow
                label="Gmail"
                value={timeSince(syncs.gmailLastSync)}
                sub="Volume metrics only — no email content"
              />
            </>
          )}
          <IntegrationRow
            label="Telegram"
            status={profile?.telegramLinked ? 'connected' : 'not_connected'}
          />
        </SectionCard>

        {/* Waldo schedule */}
        <SectionCard title="Waldo Schedule">
          <SettingRow
            label="Morning Wag"
            value={profile?.wakeTimeEstimate ?? '07:00'}
            sub="Daily biological briefing at wake time"
          />
          <SettingRow
            label="Fetch Alerts"
            value="Max 3/day"
            sub="Stress patrol, 2h cooldown between alerts"
          />
          <SettingRow
            label="Evening Review"
            value={profile?.preferredEveningTime ?? '21:00'}
            sub="Daily wind-down and tomorrow's prep"
          />
          <SettingRow
            label="Baseline updater"
            value="4 AM UTC"
            sub="Nightly HRV, sleep, and activity baselines"
          />
        </SectionCard>

        {/* About */}
        <SectionCard title="About">
          <SettingRow label="Version" value="Phase B1" />
          <SettingRow
            label="Medical disclaimer"
            value=""
            sub="Waldo is not a medical device. Nap Score is for informational purposes only."
          />
        </SectionCard>

        {/* Sign out */}
        <View style={{ marginHorizontal: 16 }}>
          <Pressable
            onPress={handleSignOut}
            disabled={signingOut}
            style={({ pressed }) => ({
              borderRadius: 14, paddingVertical: 16, alignItems: 'center',
              backgroundColor: pressed ? '#FEE2E2' : '#FFFFFF',
              borderWidth: 1, borderColor: '#FECACA',
            })}
          >
            <Text style={{ fontSize: 15, fontWeight: '600', color: '#EF4444' }}>
              {signingOut ? 'Signing out...' : 'Sign out'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
