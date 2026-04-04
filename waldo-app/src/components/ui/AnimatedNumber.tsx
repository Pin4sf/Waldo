import React, { useEffect } from 'react';
import { StyleSheet, TextInput, type TextStyle } from 'react-native';
import Animated, { useSharedValue, useAnimatedProps, withSpring } from 'react-native-reanimated';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

interface AnimatedNumberProps {
  value: number;
  style?: TextStyle | TextStyle[];
}

export function AnimatedNumber({ value, style }: AnimatedNumberProps) {
  const animatedValue = useSharedValue(0);

  useEffect(() => {
    animatedValue.value = withSpring(value, { mass: 1, damping: 18, stiffness: 90 });
  }, [value, animatedValue]);

  const animatedProps = useAnimatedProps(() => ({
    text: Math.round(animatedValue.value).toString(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any));

  return (
    <AnimatedTextInput
      animatedProps={animatedProps}
      editable={false}
      style={[styles.base, style]}
    />
  );
}

const styles = StyleSheet.create({
  base: { padding: 0, margin: 0, includeFontPadding: false },
});
