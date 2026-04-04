import React, { useState } from 'react';
import {
  ActivityIndicator, Dimensions, Modal, Pressable,
  ScrollView, StyleSheet, Text, View, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AdjustmentCard }  from '@/components/AdjustmentCard';
import { HealthStatCard }  from '@/components/HealthStatCard';
import { MorningWagCard }  from '@/components/MorningWagCard';
import { NapScoreGauge }   from '@/components/NapScoreGauge';
import { SpotCard }        from '@/components/SpotCard';
import { WaldoIllustration, type WaldoState } from '@/components/WaldoIllustration';
import { colors, fonts, fontSize, spacing, borderRadius } from '@/theme';
import { useDashboardData, useAvailableDates, type Zone } from '@/hooks/useWaldoData';

let Haptics: { impactAsync: (n: number) => void } | null = null;
if (Platform.OS !== 'web') { try { Haptics = require('expo-haptics'); } catch {} }

const { width: W } = Dimensions.get('window');

const HERO: Record<Zone, { title: string; body: string; state: WaldoState }> = {
  peak:     { title: 'Ready for the hard thing.',  body: 'Signal unusually clean this morning. Waldo is keeping the runway clear.',   state: 'good' },
  steady:   { title: 'A good working day.',         body: 'Nothing dramatic. Keep the important block intact, let admin work stay light.', state: 'watching' },
  flagging: { title: 'A protective start.',         body: 'Running lower than usual. The heavier work moved later.',                    state: 'flagging' },
  depleted: { title: 'Keep today gentle.',          body: 'Waldo has already pulled the sharper work back.',                           state: 'rough-night' },
};

export default function DashboardScreen() {
  const { dates }       = useAvailableDates();
  const [selected, setSelected] = useState<string | undefined>(undefined);
  const [showPicker, setShowPicker] = useState(false);

  const {
    napScore, zone, date, morningWag, spots, adjustments,
    healthStats, loading, crsComponents, stressEvents,
  } = useDashboardData(selected);

  const hero        = HERO[zone];
  const dateDisplay = date
    ? new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' })
    : '';

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={[styles.muted, { marginTop:12 }]}>Still learning your patterns…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => { setShowPicker(true); Haptics?.impactAsync(0); }}
            style={({ pressed }) => [styles.datePicker, pressed && { opacity:0.7 }]}>
            <Text style={styles.eyebrow}>{dateDisplay}</Text>
            <Text style={[styles.eyebrow, { color:colors.accent }]}> ▾</Text>
          </Pressable>
          <Text style={styles.headline}>Already on it.</Text>
        </View>

        {/* Date strip */}
        {dates.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
            {dates.slice(0, 40).map(d => {
              const sel = d.date === date;
              const sz  = sel ? 14 : 10;
              return (
                <Pressable key={d.date} onPress={() => { setSelected(d.date); Haptics?.impactAsync(0); }} style={styles.dotWrap}>
                  <View style={[styles.dot, { width:sz, height:sz, borderRadius:sz/2, backgroundColor:colors.zone[d.zone] }, sel && styles.dotSel]} />
                  {sel && <Text style={styles.dotLabel}>{d.score}</Text>}
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {/* Hero card */}
        <View style={[styles.hero, { backgroundColor:colors.zone[zone] }]}>
          <View style={{ marginBottom:spacing.sm }}>
            <Text style={styles.heroKicker}>Today's read</Text>
            <Text style={styles.heroTitle}>{hero.title}</Text>
            <Text style={styles.heroBody}>{hero.body}</Text>
          </View>
          <View style={{ alignItems:'center', flexDirection:'row', justifyContent:'space-evenly', marginTop:spacing.sm }}>
            <WaldoIllustration state={hero.state} size="lg" />
            <NapScoreGauge score={napScore} size="lg" />
          </View>
        </View>

        {/* CRS component bars */}
        {crsComponents && (
          <View style={styles.componentRow}>
            {([
              { label:'Sleep',     score:crsComponents.sleep,     weight:'35%' },
              { label:'HRV',       score:crsComponents.hrv,       weight:'25%' },
              { label:'Circadian', score:crsComponents.circadian, weight:'25%' },
              { label:'Activity',  score:crsComponents.activity,  weight:'15%' },
            ]).map(c => (
              <View key={c.label} style={styles.componentItem}>
                <Text style={styles.componentScore}>{c.score}</Text>
                <View style={styles.componentTrack}>
                  <View style={[styles.componentFill, {
                    width:`${Math.min(c.score, 100)}%` as any,
                    backgroundColor: c.score >= 80 ? colors.zone.peak : c.score >= 60 ? colors.zone.steady : c.score >= 40 ? colors.zone.flagging : colors.zone.depleted,
                  }]} />
                </View>
                <Text style={styles.componentLabel}>{c.label}{'\n'}({c.weight})</Text>
              </View>
            ))}
          </View>
        )}

        {/* Morning Wag */}
        <MorningWagCard message={morningWag.message} score={morningWag.score} time={morningWag.time} />

        {/* Adjustments */}
        {adjustments.length > 0 && (
          <View style={styles.section}>
            <View style={styles.secHeader}>
              <Text style={styles.secTitle}>What Waldo did</Text>
              <Text style={styles.secMeta}>{adjustments.length} moves</Text>
            </View>
            <View style={{ paddingHorizontal:spacing.lg }}>
              {adjustments.map(a => <AdjustmentCard key={a.id} action={a.action} reason={a.reason} undoable={a.undoable} />)}
            </View>
          </View>
        )}

        {/* Signal details */}
        <View style={styles.section}>
          <View style={styles.secHeader}>
            <Text style={styles.secTitle}>Signal details</Text>
            {stressEvents > 0 && <Text style={[styles.secMeta, { color:colors.zoneText.flagging }]}>{stressEvents} stress events</Text>}
          </View>
          <View style={styles.statsGrid}>
            {healthStats.map(s => (
              <View key={s.id} style={{ width:(W - spacing.lg * 2 - spacing.xs) / 2 - 1 }}>
                <HealthStatCard label={s.label} value={typeof s.value === 'number' ? s.value : parseFloat(String(s.value))} unit={s.unit} trend={s.trend} context={s.context} />
              </View>
            ))}
          </View>
        </View>

        {/* Spots */}
        {spots.length > 0 && (
          <View style={styles.section}>
            <View style={styles.secHeader}>
              <Text style={styles.secTitle}>Spots</Text>
              <Text style={styles.secMeta}>{spots.length} observations</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal:spacing.lg, gap:spacing.sm }}>
              {spots.map(s => <SpotCard key={s.id} body={s.body} date={s.date} title={s.title} type={s.type} />)}
            </ScrollView>
          </View>
        )}
      </ScrollView>

      {/* Date Picker Modal */}
      <Modal visible={showPicker} animationType="slide" transparent>
        <Pressable style={styles.overlay} onPress={() => setShowPicker(false)}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>Select a date</Text>
            <ScrollView style={{ maxHeight:380 }} showsVerticalScrollIndicator={false}>
              {dates.slice(0, 40).map(d => (
                <Pressable key={d.date}
                  style={({ pressed }) => [styles.dateOpt, d.date === date && styles.dateOptActive, pressed && { opacity:0.7 }]}
                  onPress={() => { setSelected(d.date); setShowPicker(false); }}>
                  <View style={[{ width:10, height:10, borderRadius:5 }, { backgroundColor:colors.zone[d.zone] }]} />
                  <Text style={{ flex:1, fontFamily:fonts.dmSans, fontSize:fontSize.md, color:colors.textPrimary }}>
                    {new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' })}
                  </Text>
                  <Text style={{ fontFamily:fonts.corben, fontSize:fontSize.md, color:colors.textMuted }}>{d.score}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:           { flex:1, backgroundColor:colors.background },
  center:         { justifyContent:'center', alignItems:'center' },
  scroll:         { flex:1, backgroundColor:colors.background },
  content:        { paddingBottom:40 },
  muted:          { color:colors.textMuted, fontFamily:fonts.dmSans, fontSize:fontSize.sm, textAlign:'center' },
  header:         { paddingHorizontal:spacing.lg, paddingTop:spacing.md },
  datePicker:     { flexDirection:'row', alignItems:'center', marginBottom:spacing.xs },
  eyebrow:        { color:colors.textMuted, fontFamily:fonts.dmSansMedium, fontSize:fontSize.sm },
  headline:       { color:colors.textPrimary, fontFamily:fonts.corben, fontSize:38, lineHeight:44, marginBottom:spacing.xs },
  strip:          { paddingHorizontal:spacing.lg, paddingVertical:spacing.sm, gap:6, alignItems:'center' },
  dotWrap:        { alignItems:'center', minWidth:18 },
  dot:            { borderWidth:1, borderColor:'rgba(26,26,26,0.08)' },
  dotSel:         { borderWidth:2, borderColor:colors.textPrimary },
  dotLabel:       { fontFamily:fonts.dmSansMedium, fontSize:9, color:colors.textPrimary, marginTop:2 },
  hero:           { borderRadius:borderRadius.xxl, marginHorizontal:spacing.lg, marginTop:spacing.md, overflow:'hidden', paddingHorizontal:spacing.lg, paddingTop:spacing.lg, paddingBottom:spacing.md },
  heroKicker:     { color:colors.textSecondary, fontFamily:fonts.dmSansMedium, fontSize:fontSize.sm, marginBottom:spacing.xxs },
  heroTitle:      { color:colors.textPrimary, fontFamily:fonts.corben, fontSize:30, lineHeight:36, marginBottom:spacing.xs },
  heroBody:       { color:colors.textSecondary, fontFamily:fonts.dmSans, fontSize:fontSize.md, lineHeight:24 },
  componentRow:   { flexDirection:'row', marginHorizontal:spacing.lg, marginTop:spacing.md, gap:spacing.xs },
  componentItem:  { flex:1, alignItems:'center' },
  componentScore: { fontFamily:fonts.corben, fontSize:fontSize.md, color:colors.textPrimary, marginBottom:2 },
  componentTrack: { width:'100%', height:4, backgroundColor:colors.trackColor, borderRadius:2, overflow:'hidden' },
  componentFill:  { height:'100%', borderRadius:2 },
  componentLabel: { fontFamily:fonts.dmSans, fontSize:9, color:colors.textMuted, marginTop:2, textAlign:'center' },
  section:        { marginTop:spacing.xl },
  secHeader:      { alignItems:'flex-end', flexDirection:'row', justifyContent:'space-between', marginBottom:spacing.md, paddingHorizontal:spacing.lg },
  secTitle:       { color:colors.textPrimary, fontFamily:fonts.corben, fontSize:24, lineHeight:30 },
  secMeta:        { color:colors.textMuted, fontFamily:fonts.dmSans, fontSize:fontSize.sm, maxWidth:120, textAlign:'right' },
  statsGrid:      { flexDirection:'row', flexWrap:'wrap', gap:spacing.xs, paddingHorizontal:spacing.lg },
  overlay:        { flex:1, backgroundColor:'rgba(0,0,0,0.4)', justifyContent:'flex-end' },
  sheet:          { backgroundColor:colors.background, borderTopLeftRadius:borderRadius.xxl, borderTopRightRadius:borderRadius.xxl, padding:spacing.lg, paddingBottom:40, maxHeight:'60%' },
  handle:         { width:36, height:4, backgroundColor:colors.border, borderRadius:2, alignSelf:'center', marginBottom:spacing.md },
  sheetTitle:     { fontFamily:fonts.corben, fontSize:fontSize.lg, color:colors.textPrimary, marginBottom:spacing.md },
  dateOpt:        { flexDirection:'row', alignItems:'center', paddingVertical:spacing.sm, borderBottomWidth:1, borderBottomColor:colors.border, gap:spacing.sm },
  dateOptActive:  { backgroundColor:colors.accentSoft, borderRadius:borderRadius.md, paddingHorizontal:spacing.sm },
});
