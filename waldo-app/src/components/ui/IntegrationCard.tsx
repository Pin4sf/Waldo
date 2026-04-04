import React from 'react';
import { StyleSheet, Text, View, Pressable, ActivityIndicator } from 'react-native';
import { colors, fonts, spacing, borderRadius, fontSize } from '@/theme';
import type { SyncStatusEntry } from '@/lib/supabase';

interface Props {
  entry: SyncStatusEntry;
  onSync?: () => void;
  onConnect?: () => void;
  syncing?: boolean;
}

function timeSince(iso: string | null): string {
  if (!iso) return 'Never';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const STATUS_DOT: Record<SyncStatusEntry['status'], string> = {
  ok:            '#34D399',
  pending:       '#F59E0B',
  error:         '#EF4444',
  token_expired: '#F59E0B',
  no_token:      '#D1D5DB',
  not_connected: '#D1D5DB',
};

export function IntegrationCard({ entry, onSync, onConnect, syncing }: Props) {
  const dotColor   = STATUS_DOT[entry.status] ?? '#D1D5DB';
  const isConnected = entry.connected;
  const isOk        = entry.status === 'ok';

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={[styles.dot, { backgroundColor: dotColor }]} />
        <View style={styles.info}>
          <Text style={styles.label}>{entry.label}</Text>
          {isConnected ? (
            <Text style={styles.sub}>
              {isOk ? `Synced ${timeSince(entry.lastSyncAt)}` : entry.status.replace('_', ' ')}
              {entry.recordsSynced > 0 && isOk ? ` · ${entry.recordsSynced} records` : ''}
            </Text>
          ) : (
            <Text style={styles.sub}>Not connected</Text>
          )}
          {!!entry.lastError && (
            <Text style={[styles.sub, { color: '#EF4444' }]} numberOfLines={1}>{entry.lastError}</Text>
          )}
        </View>
        {isConnected ? (
          <Pressable onPress={onSync} disabled={syncing}
            style={({ pressed }) => [styles.btn, pressed && { opacity: 0.6 }]}>
            {syncing
              ? <ActivityIndicator size="small" color={colors.textMuted} />
              : <Text style={styles.btnText}>Sync</Text>
            }
          </Pressable>
        ) : (
          <Pressable onPress={onConnect}
            style={({ pressed }) => [styles.btnAccent, pressed && { opacity: 0.7 }]}>
            <Text style={styles.btnAccentText}>Connect</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card:         { backgroundColor: colors.surfaceRaised, borderRadius: borderRadius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginBottom: spacing.xs, borderWidth: 1, borderColor: colors.border },
  row:          { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot:          { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  info:         { flex: 1, gap: 2 },
  label:        { fontFamily: fonts.dmSansMedium, fontSize: fontSize.sm, color: colors.textPrimary },
  sub:          { fontFamily: fonts.dmSans, fontSize: fontSize.xs, color: colors.textMuted },
  btn:          { paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: borderRadius.sm, backgroundColor: colors.surfaceInset, minWidth: 52, alignItems: 'center' },
  btnText:      { fontFamily: fonts.dmSansMedium, fontSize: fontSize.xs, color: colors.textSecondary },
  btnAccent:    { paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: borderRadius.sm, backgroundColor: colors.accentSoft, minWidth: 72, alignItems: 'center' },
  btnAccentText:{ fontFamily: fonts.dmSansMedium, fontSize: fontSize.xs, color: colors.accent },
});
