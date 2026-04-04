import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, fontSize, spacing, borderRadius } from '@/theme';

interface ChatBubbleProps {
  message: string;
  isWaldo: boolean;
  timestamp: string;
}

export function ChatBubble({ message, isWaldo, timestamp }: ChatBubbleProps) {
  return (
    <View style={[styles.row, isWaldo ? styles.rowLeft : styles.rowRight]}>
      {isWaldo ? (
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>W</Text>
        </View>
      ) : null}
      <View style={styles.bubbleWrap}>
        <View style={[styles.bubble, isWaldo ? styles.waldoBubble : styles.userBubble]}>
          <Text style={[styles.message, { color: isWaldo ? colors.chat.waldoText : colors.chat.userText }]}>
            {message}
          </Text>
        </View>
        <Text style={[styles.timestamp, isWaldo ? styles.timestampLeft : styles.timestampRight]}>
          {timestamp}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row:    { alignItems: 'flex-end', flexDirection: 'row', gap: spacing.sm, marginVertical: spacing.xs, paddingHorizontal: spacing.lg },
  rowLeft:  { justifyContent: 'flex-start' },
  rowRight: { justifyContent: 'flex-end' },
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.surfaceInset,
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  avatarText:  { color: colors.textPrimary, fontFamily: fonts.dmSansMedium, fontSize: fontSize.sm },
  bubbleWrap:  { maxWidth: '78%' },
  bubble: { borderRadius: borderRadius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  waldoBubble: { backgroundColor: colors.chat.waldoBubble, borderBottomLeftRadius: 6 },
  userBubble:  { backgroundColor: colors.chat.userBubble, borderBottomRightRadius: 6 },
  message:     { fontFamily: fonts.dmSans, fontSize: fontSize.md, lineHeight: 26 },
  timestamp:   { color: colors.textMuted, fontFamily: fonts.dmSans, fontSize: fontSize.xs, marginTop: 4 },
  timestampLeft:  { textAlign: 'left' },
  timestampRight: { textAlign: 'right' },
});
