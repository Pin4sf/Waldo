import React, { useState, useRef } from 'react';
import {
  StyleSheet, Text, View, ScrollView, Pressable, ActivityIndicator,
  RefreshControl, Alert, Modal, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts, spacing, borderRadius, fontSize } from '@/theme';
import { WaldoIllustration } from '@/components/WaldoIllustration';
import { IntegrationCard } from '@/components/ui/IntegrationCard';
import { useProfileData } from '@/hooks/useWaldoData';
import {
  openGoogleConnect, triggerSync, DEMO_USER_ID,
  getActiveUserId, setActiveUserId, supabase,
} from '@/lib/supabase';
import { logout } from '@/lib/auth';

const CHRONOTYPE: Record<string, string> = { early:'Early bird', normal:'Normal', late:'Night owl' };
const TRIGGER:    Record<string, string> = {
  morning_wag:'Morning Wag', fetch_alert:'Fetch Alert',
  evening_review:'Evening Review', conversational:'Chat', baseline_update:'Baselines',
};
const STATUS_DOT: Record<string, string> = {
  sent:'#34D399', fallback:'#F59E0B', suppressed:'#9CA3AF', failed:'#EF4444',
};

function timeSince(iso: string | null): string {
  if (!iso) return 'Never';
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return d === 0 ? 'Today' : d === 1 ? 'Yesterday' : `${d}d ago`;
}

function Row({ label, value, sub, dim }: { label: string; value: string; sub?: string; dim?: boolean }) {
  return (
    <View style={st.row}>
      <Text style={st.rowLabel}>{label}</Text>
      <View style={{ alignItems:'flex-end' }}>
        <Text style={[st.rowVal, dim && { color:colors.textMuted }]}>{value}</Text>
        {sub ? <Text style={st.rowSub}>{sub}</Text> : null}
      </View>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={st.section}>
      <Text style={st.secTitle}>{title}</Text>
      <View style={st.secCard}>{children}</View>
    </View>
  );
}

interface UserRow { id: string; name: string; timezone: string; is_admin: boolean }

export default function ProfileScreen() {
  const { profile, syncStatuses, memory, agentLogs, loading, reload } = useProfileData();
  const [refreshing, setRefreshing] = useState(false);
  const [syncing,    setSyncing]    = useState<string | null>(null);

  // Super admin: 5-tap the illustration to unlock
  const tapCount = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [showPicker,    setShowPicker]    = useState(false);
  const [allUsers,      setAllUsers]      = useState<UserRow[]>([]);
  const [activeId,      setActiveId]      = useState(getActiveUserId());

  function handleLogoTap() {
    tapCount.current += 1;
    if (tapTimer.current) clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => { tapCount.current = 0; }, 1500);
    if (tapCount.current >= 5) {
      tapCount.current = 0;
      setAdminUnlocked(true);
      supabase.from('users').select('id, name, timezone, is_admin')
        .eq('active', true).order('name')
        .then(({ data }) => setAllUsers((data ?? []) as UserRow[]));
    }
  }

  function switchUser(id: string) {
    setActiveUserId(id);
    setActiveId(id);
    setShowPicker(false);
    reload();
  }

  const handleRefresh = async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  };

  const handleSync = async (provider: string) => {
    setSyncing(provider);
    await triggerSync(provider, DEMO_USER_ID);
    await new Promise(r => setTimeout(r, 2500));
    await reload();
    setSyncing(null);
  };

  const handleConnect = () => Alert.alert(
    'Connect Google Workspace',
    'Waldo will access your Calendar, Gmail volume, and Tasks to give you a complete picture of your day.',
    [{ text:'Cancel', style:'cancel' }, { text:'Connect', onPress:() => openGoogleConnect(DEMO_USER_ID) }],
  );

  const totalCost     = agentLogs.reduce((s, l) => s + l.estimatedCostUsd, 0);
  const googleConnect = syncStatuses.some(s => s.connected);

  if (loading) {
    return (
      <SafeAreaView style={st.safe}>
        <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={st.safe}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom:spacing.xxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} />}
      >
        <View style={{ paddingHorizontal:spacing.md, paddingTop:spacing.xs, paddingBottom:spacing.md }}>
          <Text style={{ fontFamily:fonts.corben, fontSize:fontSize.lg, color:colors.textPrimary }}>Profile</Text>
        </View>

        {/* Hero — tap 5x to unlock admin */}
        <Pressable onPress={handleLogoTap} style={st.hero}>
          <WaldoIllustration state="watching" size="md" />
          <Text style={st.heroName}>{profile?.name ?? 'Your Waldo'}</Text>
          <Text style={st.heroSub}>{profile?.timezone ?? 'UTC'}</Text>
          {adminUnlocked && (
            <View style={{ marginTop:spacing.xs, backgroundColor:colors.accentSoft, borderRadius:borderRadius.full, paddingHorizontal:spacing.sm, paddingVertical:3 }}>
              <Text style={{ fontFamily:fonts.dmSansMedium, fontSize:fontSize.xs, color:colors.accent }}>⚡ Admin Mode</Text>
            </View>
          )}
        </Pressable>

        {/* Admin switcher */}
        {adminUnlocked && (
          <View style={st.section}>
            <Text style={st.secTitle}>Super Admin</Text>
            <View style={st.secCard}>
              <Pressable onPress={() => setShowPicker(true)} style={({ pressed }) => [st.row, { opacity:pressed ? 0.7 : 1 }]}>
                <Text style={st.rowLabel}>Viewing as</Text>
                <View style={{ flexDirection:'row', alignItems:'center', gap:6 }}>
                  <Text style={[st.rowVal, { color:colors.accent }]}>
                    {allUsers.find(u => u.id === activeId)?.name ?? profile?.name ?? 'Default'}
                  </Text>
                  <Text style={{ color:colors.textMuted, fontSize:16 }}>›</Text>
                </View>
              </Pressable>
              <View style={st.divider} />
              <Pressable onPress={() => { switchUser(DEMO_USER_ID); setAdminUnlocked(false); }}
                style={({ pressed }) => [st.row, { opacity:pressed ? 0.7 : 1 }]}>
                <Text style={[st.rowLabel, { color:colors.textMuted }]}>Reset to demo user</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* User picker modal */}
        <Modal visible={showPicker} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowPicker(false)}>
          <SafeAreaView style={{ flex:1, backgroundColor:colors.background }}>
            <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding:spacing.md }}>
              <Text style={{ fontFamily:fonts.corben, fontSize:fontSize.lg, color:colors.textPrimary }}>Switch User</Text>
              <Pressable onPress={() => setShowPicker(false)}>
                <Text style={{ fontSize:18, color:colors.textMuted }}>Done</Text>
              </Pressable>
            </View>
            <FlatList
              data={allUsers}
              keyExtractor={u => u.id}
              contentContainerStyle={{ padding:spacing.md }}
              renderItem={({ item }) => (
                <Pressable onPress={() => switchUser(item.id)}
                  style={({ pressed }) => ({
                    flexDirection:'row', alignItems:'center', justifyContent:'space-between',
                    padding:spacing.md, marginBottom:spacing.xs,
                    backgroundColor: item.id === activeId ? colors.accentSoft : colors.surfaceRaised,
                    borderRadius:borderRadius.md, opacity:pressed ? 0.7 : 1,
                  })}>
                  <View>
                    <Text style={{ fontFamily:fonts.dmSansMedium, fontSize:fontSize.md, color:colors.textPrimary }}>
                      {item.name}{item.is_admin ? ' ⚡' : ''}
                    </Text>
                    <Text style={{ fontFamily:fonts.dmSans, fontSize:fontSize.xs, color:colors.textMuted }}>{item.timezone}</Text>
                  </View>
                  {item.id === activeId && <Text style={{ color:colors.accent, fontFamily:fonts.dmSansMedium, fontSize:fontSize.sm }}>Viewing</Text>}
                </Pressable>
              )}
            />
          </SafeAreaView>
        </Modal>

        {/* Identity */}
        <Section title="Identity">
          <Row label="Wake time"       value={profile?.wakeTimeEstimate ?? '07:00'} />
          <View style={st.divider} />
          <Row label="Evening review"  value={profile?.preferredEveningTime ?? '21:00'} />
          <View style={st.divider} />
          <Row label="Chronotype"      value={CHRONOTYPE[profile?.chronotype ?? 'normal'] ?? 'Normal'} />
          <View style={st.divider} />
          <Row label="Wearable"        value={profile?.wearableType?.replace('_', ' ') ?? 'Unknown'} />
          <View style={st.divider} />
          <Row label="Last health sync" value={timeSince(profile?.lastHealthSync ?? null)} dim={!profile?.lastHealthSync} />
          <View style={st.divider} />
          <Row label="Telegram"        value={profile?.telegramLinked ? 'Linked' : 'Not linked'} dim={!profile?.telegramLinked} />
        </Section>

        {/* Integrations */}
        <Section title="Integrations">
          {syncStatuses.map(e => (
            <IntegrationCard key={e.provider} entry={e}
              onSync={() => handleSync(e.provider)} onConnect={handleConnect}
              syncing={syncing === e.provider} />
          ))}
          {!googleConnect && (
            <Text style={{ fontFamily:fonts.dmSans, fontSize:fontSize.xs, color:colors.textMuted, lineHeight:18, marginTop:spacing.xs }}>
              Connect Google to unlock calendar context, email load awareness, and task pressure in every Morning Wag.
            </Text>
          )}
        </Section>

        {/* What Waldo knows */}
        {memory.length > 0 && (
          <Section title={`What Waldo knows · ${memory.length} entries`}>
            <View style={{ flexDirection:'row', flexWrap:'wrap', gap:spacing.xs, paddingVertical:spacing.xs }}>
              {memory.map(m => (
                <View key={m.key} style={st.memTag}>
                  <Text style={{ fontFamily:fonts.dmSans, fontSize:fontSize.xs, color:colors.textMuted, flexShrink:0 }}>
                    {m.key.replace(/_/g, ' ')}
                  </Text>
                  <Text numberOfLines={1} ellipsizeMode="tail"
                    style={{ fontFamily:fonts.dmSansMedium, fontSize:fontSize.xs, color:colors.textPrimary, flexShrink:1 }}>
                    {m.value}
                  </Text>
                </View>
              ))}
            </View>
          </Section>
        )}

        {/* Agent activity */}
        {agentLogs.length > 0 && (
          <Section title={`Recent activity · $${totalCost.toFixed(4)} total`}>
            {agentLogs.map((log, i) => (
              <View key={log.traceId}>
                {i > 0 && <View style={st.divider} />}
                <View style={st.logRow}>
                  <View style={{ flex:1, flexDirection:'row', alignItems:'center', gap:8 }}>
                    <View style={[st.logDot, { backgroundColor:STATUS_DOT[log.deliveryStatus] ?? '#9CA3AF' }]} />
                    <Text style={{ fontFamily:fonts.dmSansMedium, fontSize:fontSize.sm, color:colors.textPrimary }}>
                      {TRIGGER[log.triggerType] ?? log.triggerType}
                    </Text>
                  </View>
                  <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
                    <Text style={st.logMeta}>{log.totalTokens} tok</Text>
                    <Text style={st.logMeta}>{log.latencyMs}ms</Text>
                    <Text style={st.logMeta}>{new Date(log.createdAt).toLocaleTimeString('en', { hour:'2-digit', minute:'2-digit' })}</Text>
                  </View>
                </View>
              </View>
            ))}
          </Section>
        )}

        {/* Waldo's schedule */}
        <Section title="Waldo's schedule">
          <Row label="Morning Wag"            value={profile?.wakeTimeEstimate ?? '07:00'}  sub="Daily biological briefing" />
          <View style={st.divider} />
          <Row label="Fetch Alerts"           value="Max 3/day"                              sub="2h cooldown between alerts" />
          <View style={st.divider} />
          <Row label="Evening Review"         value={profile?.preferredEveningTime ?? '21:00'} sub="Daily wind-down" />
          <View style={st.divider} />
          <Row label="Baseline update"        value="4 AM UTC"                               sub="Nightly HRV & sleep compute" />
          <View style={st.divider} />
          <Row label="Intelligence compaction" value="Sunday 8 PM UTC"                       sub="Weekly pattern learning" />
        </Section>

        {/* Sign out */}
        <Pressable
          onPress={() => Alert.alert(
            'Sign out', 'You\'ll need to set up Waldo again on this device.',
            [{ text:'Cancel', style:'cancel' }, { text:'Sign out', style:'destructive', onPress: logout }],
          )}
          style={({ pressed }) => ({
            marginHorizontal:spacing.md, marginBottom:spacing.md,
            borderRadius:borderRadius.lg, paddingVertical:16, alignItems:'center',
            backgroundColor: pressed ? '#FEE2E2' : colors.surface,
            borderWidth:1, borderColor:'#FECACA',
          })}>
          <Text style={{ fontFamily:fonts.dmSansMedium, fontSize:fontSize.md, color:'#991B1B' }}>Sign out</Text>
        </Pressable>

        <Text style={st.disclaimer}>Not a medical device. Nap Score is for informational purposes only.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe:        { flex:1, backgroundColor:colors.background },
  hero:        { alignItems:'center', paddingVertical:spacing.md, gap:spacing.xs },
  heroName:    { fontFamily:fonts.corben, fontSize:fontSize.lg, color:colors.textPrimary, marginTop:spacing.xs },
  heroSub:     { fontFamily:fonts.dmSans, fontSize:fontSize.sm, color:colors.textMuted },
  section:     { marginHorizontal:spacing.md, marginBottom:spacing.md },
  secTitle:    { fontFamily:fonts.dmSansMedium, fontSize:fontSize.xs, color:colors.textMuted, textTransform:'uppercase', letterSpacing:0.8, marginBottom:spacing.xs, marginLeft:2 },
  secCard:     { backgroundColor:colors.surfaceRaised, borderRadius:borderRadius.lg, paddingHorizontal:spacing.md, paddingVertical:spacing.sm, borderWidth:1, borderColor:colors.border },
  row:         { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingVertical:spacing.xs },
  rowLabel:    { fontFamily:fonts.dmSansMedium, fontSize:fontSize.sm, color:colors.textPrimary },
  rowVal:      { fontFamily:fonts.dmSans, fontSize:fontSize.sm, color:colors.textSecondary, textAlign:'right' },
  rowSub:      { fontFamily:fonts.dmSans, fontSize:fontSize.xs, color:colors.textMuted, textAlign:'right', marginTop:2 },
  divider:     { height:1, backgroundColor:colors.border },
  memTag:      { backgroundColor:colors.surfaceInset, borderRadius:borderRadius.sm, paddingHorizontal:spacing.xs, paddingVertical:4, flexDirection:'row', gap:4, alignItems:'center', flexShrink:1 },
  logRow:      { flexDirection:'row', alignItems:'center', paddingVertical:8 },
  logDot:      { width:7, height:7, borderRadius:4 },
  logMeta:     { fontFamily:fonts.dmSans, fontSize:fontSize.xs, color:colors.textMuted },
  disclaimer:  { fontFamily:fonts.dmSans, fontSize:fontSize.xs, color:colors.textMuted, textAlign:'center', paddingHorizontal:spacing.xl, marginTop:spacing.xs, lineHeight:18 },
});
