import React from 'react';
import {
  ActivityIndicator, Dimensions, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts, fontSize, spacing, borderRadius } from '@/theme';
import { useTimelineData, useConstellationData } from '@/hooks/useWaldoData';

const { width: W } = Dimensions.get('window');
const BAR_MAX_H = 120;

export default function InsightsScreen() {
  const { days, loading: tlLoading, weeklyRead } = useTimelineData();
  const { nodes, patterns, loading: cnLoading }  = useConstellationData();
  const loading = tlLoading || cnLoading;

  const zoneColor: Record<string, string> = {
    peak: colors.zone.peak, steady: colors.zone.steady,
    flagging: colors.zone.flagging, depleted: colors.zone.depleted,
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { justifyContent:'center', alignItems:'center' }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Intelligence</Text>
          <Text style={styles.title}>The Constellation.</Text>
        </View>

        {/* 30-day bar chart */}
        {days.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.secTitle}>30-day Nap Score</Text>
            <View style={styles.chartCard}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chartRow}>
                {days.map(d => {
                  const barH = Math.max(4, (d.score / 100) * BAR_MAX_H);
                  return (
                    <View key={d.date} style={styles.barWrap}>
                      <Text style={styles.barScore}>{d.score}</Text>
                      <View style={[styles.bar, { height: barH, backgroundColor: zoneColor[d.zone] ?? colors.surfaceInset }]} />
                      <Text style={styles.barDay}>{d.dayLabel}</Text>
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        )}

        {/* Weekly read */}
        {weeklyRead.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.secTitle}>What Waldo sees</Text>
            <View style={styles.readCard}>
              <Text style={styles.readText}>{weeklyRead}</Text>
            </View>
          </View>
        )}

        {/* Patterns */}
        {patterns.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.secTitle}>Patterns · {patterns.length} confirmed</Text>
            {patterns.map((p, i) => {
              const conf   = Math.round(((p['confidence'] as number | undefined) ?? 0) * 100);
              const evid   = (p['evidence_count'] as number | undefined) ?? 0;
              const summ   = (p['summary'] as string | undefined) ?? '';
              const detail = (p['detail'] as string | undefined) ?? '';
              return (
                <View key={String(p['id'] ?? i)} style={styles.patternCard}>
                  <View style={styles.patternHeader}>
                    <Text style={styles.patternConf}>{conf}% confidence</Text>
                    <Text style={styles.patternEvidence}>{evid} observations</Text>
                  </View>
                  <Text style={styles.patternSummary}>{summ}</Text>
                  {detail.length > 0 && <Text style={styles.patternDetail}>{detail}</Text>}
                </View>
              );
            })}
          </View>
        )}

        {/* Spots grid */}
        {nodes.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.secTitle}>Spots · {nodes.length} observations</Text>
            <View style={styles.spotsGrid}>
              {nodes.slice(0, 20).map(n => {
                const bgColor =
                  n.severity === 'critical' ? colors.zone.flagging :
                  n.severity === 'warning'  ? colors.zone.steady :
                  n.severity === 'positive' ? colors.zone.peak :
                  colors.surfaceInset;
                const txColor =
                  n.severity === 'critical' ? colors.zoneText.flagging :
                  n.severity === 'warning'  ? colors.zoneText.steady :
                  n.severity === 'positive' ? colors.zoneText.peak :
                  colors.textSecondary;
                return (
                  <View key={n.id} style={[styles.spotBubble, { backgroundColor: bgColor }]}>
                    <Text style={[styles.spotLabel, { color: txColor }]} numberOfLines={2}>{n.label}</Text>
                    <Text style={[styles.spotDate, { color: txColor }]}>{n.date}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {nodes.length === 0 && patterns.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🐾</Text>
            <Text style={styles.emptyTitle}>The Constellation is forming.</Text>
            <Text style={styles.emptyBody}>
              Waldo needs about 7 days of data to start connecting patterns. Check back soon.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:           { flex:1, backgroundColor:colors.background },
  content:        { paddingBottom:40 },
  header:         { paddingHorizontal:spacing.lg, paddingTop:spacing.md, paddingBottom:spacing.md },
  eyebrow:        { color:colors.textMuted, fontFamily:fonts.dmSansMedium, fontSize:fontSize.sm, marginBottom:2 },
  title:          { color:colors.textPrimary, fontFamily:fonts.corben, fontSize:30, lineHeight:36 },
  section:        { marginTop:spacing.lg },
  secTitle:       { color:colors.textPrimary, fontFamily:fonts.corben, fontSize:20, lineHeight:26, paddingHorizontal:spacing.lg, marginBottom:spacing.sm },
  // Bar chart
  chartCard:      { backgroundColor:colors.surface, marginHorizontal:spacing.lg, borderRadius:borderRadius.xl, padding:spacing.md, borderWidth:1, borderColor:colors.border },
  chartRow:       { alignItems:'flex-end', gap:4, paddingBottom:2 },
  barWrap:        { alignItems:'center', gap:2 },
  barScore:       { fontFamily:fonts.dmSansMedium, fontSize:8, color:colors.textMuted },
  bar:            { width:12, borderRadius:4 },
  barDay:         { fontFamily:fonts.dmSans, fontSize:9, color:colors.textMuted },
  // Weekly read
  readCard:       { backgroundColor:colors.surfaceRaised, marginHorizontal:spacing.lg, borderRadius:borderRadius.xl, padding:spacing.lg, borderWidth:1, borderColor:colors.border },
  readText:       { fontFamily:fonts.dmSans, fontSize:fontSize.md, color:colors.textSecondary, lineHeight:26 },
  // Patterns
  patternCard:    { backgroundColor:colors.surfaceRaised, marginHorizontal:spacing.lg, marginBottom:spacing.sm, borderRadius:borderRadius.lg, padding:spacing.md, borderWidth:1, borderColor:colors.border },
  patternHeader:  { flexDirection:'row', justifyContent:'space-between', marginBottom:spacing.xs },
  patternConf:    { fontFamily:fonts.dmSansMedium, fontSize:fontSize.xs, color:colors.accent },
  patternEvidence:{ fontFamily:fonts.dmSans, fontSize:fontSize.xs, color:colors.textMuted },
  patternSummary: { fontFamily:fonts.corben, fontSize:fontSize.md, color:colors.textPrimary, lineHeight:24, marginBottom:4 },
  patternDetail:  { fontFamily:fonts.dmSans, fontSize:fontSize.sm, color:colors.textSecondary, lineHeight:22 },
  // Spots grid
  spotsGrid:      { flexDirection:'row', flexWrap:'wrap', gap:spacing.xs, paddingHorizontal:spacing.lg },
  spotBubble:     { borderRadius:borderRadius.lg, padding:spacing.sm, width:(W - spacing.lg * 2 - spacing.xs) / 2 - 1, minHeight:80 },
  spotLabel:      { fontFamily:fonts.dmSansMedium, fontSize:fontSize.sm, lineHeight:20, marginBottom:4 },
  spotDate:       { fontFamily:fonts.dmSans, fontSize:fontSize.xs },
  // Empty
  empty:          { alignItems:'center', paddingHorizontal:spacing.xxl, paddingTop:60 },
  emptyEmoji:     { fontSize:48, marginBottom:spacing.md },
  emptyTitle:     { fontFamily:fonts.corben, fontSize:fontSize.lg, color:colors.textPrimary, textAlign:'center', marginBottom:spacing.sm },
  emptyBody:      { fontFamily:fonts.dmSans, fontSize:fontSize.md, color:colors.textMuted, textAlign:'center', lineHeight:24 },
});
