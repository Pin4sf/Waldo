import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, type Zone, getZoneLabel } from '@/theme';

interface ZonePillProps {
  zone: Zone;
}

export function ZonePill({ zone }: ZonePillProps) {
  return (
    <View style={[styles.pill, { backgroundColor: colors.zone[zone] }]}>
      <View style={[styles.dot, { backgroundColor: colors.zoneText[zone] }]} />
      <Text style={[styles.label, { color: colors.zoneText[zone] }]}>
        {getZoneLabel(zone)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignItems: 'center',
    alignSelf: 'center',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  dot: { borderRadius: 3, height: 6, width: 6 },
  label: { fontFamily: fonts.dmSansMedium, fontSize: 13 },
});
