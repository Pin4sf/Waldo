/**
 * ComponentCard — displays a single CRS component (sleep/HRV/circadian/activity).
 * Shows score, label, and availability state.
 */

import React from 'react';
import { View, Text } from 'react-native';
import type { ComponentScore } from '@/crs/types';

interface ComponentCardProps {
  label: string;
  emoji: string;
  component: ComponentScore;
}

export function ComponentCard({ label, emoji, component }: ComponentCardProps) {
  const score = component.score;
  const available = component.dataAvailable;

  const barColor = !available
    ? '#E5E5E3'
    : score >= 80 ? '#22C55E'
    : score >= 60 ? '#84CC16'
    : score >= 40 ? '#F97316'
    : '#EF4444';

  const textColor = !available ? '#9CA3AF' : '#1A1A1A';

  return (
    <View className="bg-white rounded-2xl p-4 flex-1 mx-1.5">
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-base">{emoji}</Text>
        <Text
          className="text-lg font-bold"
          style={{ color: available ? barColor : '#9CA3AF' }}
        >
          {available ? score : '—'}
        </Text>
      </View>

      {/* Score bar */}
      <View className="h-1.5 rounded-full bg-border mb-2">
        <View
          className="h-1.5 rounded-full"
          style={{
            width: `${available ? score : 0}%`,
            backgroundColor: barColor,
          }}
        />
      </View>

      <Text className="text-xs font-medium" style={{ color: textColor }}>
        {label}
      </Text>

      {!available && (
        <Text className="text-xs text-muted mt-0.5">No data</Text>
      )}
    </View>
  );
}
