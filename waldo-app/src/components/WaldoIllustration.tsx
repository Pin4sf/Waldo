/**
 * WaldoIllustration — animated dalmatian mascot.
 * Uses emoji + brand-colored animated container.
 * SVG assets are pending design delivery; this animated version is
 * production-quality for Expo Go and early beta.
 */
import React, { useEffect } from 'react';
import { Text, View, StyleSheet, useColorScheme } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withSpring, withRepeat, withSequence, withTiming, Easing,
} from 'react-native-reanimated';
import { colors } from '@/theme';

export type WaldoState =
  | 'watching' | 'thinking-working' | 'good' | 'good-sleep'
  | 'good-week' | 'flagging' | 'rough-night' | 'on-it';

interface WaldoIllustrationProps {
  state?: WaldoState;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const STATE_EMOJI: Record<WaldoState, string> = {
  'watching':        '🐕',
  'thinking-working':'🐕‍🦺',
  'good':            '🐾',
  'good-sleep':      '😴',
  'good-week':       '⭐',
  'flagging':        '🐾',
  'rough-night':     '💤',
  'on-it':           '🐕',
};

const STATE_BG: Record<WaldoState, string> = {
  'watching':        colors.zone.steady,
  'thinking-working':colors.zone.steady,
  'good':            colors.zone.peak,
  'good-sleep':      colors.zone.peak,
  'good-week':       colors.zone.peak,
  'flagging':        colors.zone.flagging,
  'rough-night':     colors.zone.depleted,
  'on-it':           colors.zone.steady,
};

const SIZE_MAP = {
  sm: { container: 52,  emoji: 28, border: 2 },
  md: { container: 96,  emoji: 48, border: 2 },
  lg: { container: 160, emoji: 80, border: 3 },
  xl: { container: 220, emoji: 110, border: 3 },
};

export function WaldoIllustration({ state = 'watching', size = 'md' }: WaldoIllustrationProps) {
  const cfg         = SIZE_MAP[size];
  const scale       = useSharedValue(1);
  const translateY  = useSharedValue(0);
  const entryScale  = useSharedValue(0.7);

  // Breathing animation
  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.03, { duration: 1600, easing: Easing.inOut(Easing.ease) }),
        withTiming(1.0,  { duration: 1600, easing: Easing.inOut(Easing.ease) }),
      ), -1, true,
    );
    translateY.value = withRepeat(
      withSequence(
        withTiming(-3, { duration: 1600, easing: Easing.inOut(Easing.ease) }),
        withTiming(0,  { duration: 1600, easing: Easing.inOut(Easing.ease) }),
      ), -1, true,
    );
  }, [scale, translateY]);

  // Entry spring on state change
  useEffect(() => {
    entryScale.value = 0.75;
    entryScale.value = withSpring(1, { damping: 10, stiffness: 120 });
  }, [state, entryScale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value * entryScale.value },
      { translateY: translateY.value },
    ],
  }));

  return (
    <View style={styles.outer}>
      <Animated.View style={animatedStyle}>
        <View
          style={[
            styles.circle,
            {
              width: cfg.container, height: cfg.container, borderRadius: cfg.container / 2,
              backgroundColor: STATE_BG[state],
              borderWidth: cfg.border,
              borderColor: 'rgba(26,26,26,0.06)',
            },
          ]}
        >
          <Text style={{ fontSize: cfg.emoji, lineHeight: cfg.emoji * 1.2 }}>
            {STATE_EMOJI[state]}
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer:  { alignItems: 'center', justifyContent: 'center' },
  circle: { alignItems: 'center', justifyContent: 'center' },
});
