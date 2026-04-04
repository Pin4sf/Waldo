import React, { useRef } from 'react';
import {
  ActivityIndicator, FlatList, KeyboardAvoidingView, Platform,
  Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChatBubble } from '@/components/ChatBubble';
import { colors, fonts, fontSize, spacing, borderRadius } from '@/theme';
import { useWaldoChat } from '@/hooks/useWaldoData';

let Haptics: { impactAsync: (n: number) => void } | null = null;
if (Platform.OS !== 'web') { try { Haptics = require('expo-haptics'); } catch {} }

export default function ChatScreen() {
  const { messages, threads, loading, sendMessage, startNewThread } = useWaldoChat();
  const [input, setInput]     = React.useState('');
  const [sending, setSending] = React.useState(false);
  const listRef = useRef<FlatList>(null);

  async function handleSend() {
    if (!input.trim() || sending) return;
    const text = input.trim();
    setInput('');
    setSending(true);
    Haptics?.impactAsync(0);
    await sendMessage(text);
    setSending(false);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { justifyContent:'center', alignItems:'center' }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={90}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={{ flex:1 }}>
              <Text style={styles.eyebrow}>Chat</Text>
              <Text style={styles.title}>Talk to Waldo.</Text>
            </View>
            <Pressable onPress={() => { startNewThread(); Haptics?.impactAsync(1); }}
              style={({ pressed }) => [styles.newBtn, pressed && { opacity:0.7 }]}>
              <Text style={styles.newBtnTxt}>+ New</Text>
            </Pressable>
          </View>
        </View>

        {/* Thread pills */}
        {threads.length > 1 && (
          <View style={styles.threadRow}>
            {threads.map(t => (
              <View key={t.id} style={styles.pill}>
                <Text style={styles.pillTxt}>{t.title}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Empty state / messages */}
        {messages.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Ask Waldo anything</Text>
            <Text style={styles.emptyBody}>How am I doing? What's my worst day? Tell me about my sleep patterns.</Text>
            <View style={styles.suggestRow}>
              {["How am I doing?", "What's my sleep like?", "My worst day?"].map(q => (
                <Pressable key={q} style={styles.suggest} onPress={() => setInput(q)}>
                  <Text style={styles.suggestTxt}>{q}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={m => m.id}
            renderItem={({ item }) => <ChatBubble isWaldo={item.isWaldo} message={item.text} timestamp={item.timestamp} />}
            contentContainerStyle={{ paddingVertical:spacing.sm }}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated:false })}
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* Sending */}
        {sending && (
          <View style={styles.sendingBar}>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={styles.sendingTxt}>Waldo is thinking…</Text>
          </View>
        )}

        {/* Composer */}
        <View style={styles.composer}>
          <TextInput
            style={styles.textInput}
            placeholder="Ask Waldo for the deeper read"
            placeholderTextColor={colors.textMuted}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={handleSend}
            returnKeyType="send"
            multiline
            maxLength={500}
          />
          <Pressable onPress={handleSend} disabled={!input.trim() || sending}
            style={({ pressed }) => [styles.sendBtn, (!input.trim() || sending) && styles.sendBtnOff, pressed && input.trim() ? { transform:[{ scale:0.95 }] } : null]}>
            <Text style={styles.sendBtnTxt}>↗</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:        { flex:1, backgroundColor:colors.background },
  screen:      { flex:1, backgroundColor:colors.background },
  header:      { paddingHorizontal:spacing.lg, paddingTop:spacing.md },
  headerRow:   { flexDirection:'row', alignItems:'flex-start', justifyContent:'space-between' },
  eyebrow:     { color:colors.textMuted, fontFamily:fonts.dmSansMedium, fontSize:fontSize.sm, marginBottom:2 },
  title:       { color:colors.textPrimary, fontFamily:fonts.corben, fontSize:30, lineHeight:36 },
  newBtn:      { backgroundColor:colors.accent, borderRadius:borderRadius.full, paddingHorizontal:spacing.md, paddingVertical:spacing.xs, marginTop:spacing.xs },
  newBtnTxt:   { color:colors.white, fontFamily:fonts.dmSansMedium, fontSize:fontSize.sm },
  threadRow:   { flexDirection:'row', paddingHorizontal:spacing.lg, paddingTop:spacing.sm, gap:spacing.xs },
  pill:        { backgroundColor:colors.surfaceRaised, borderColor:colors.border, borderRadius:borderRadius.full, borderWidth:1, paddingHorizontal:spacing.sm, paddingVertical:3 },
  pillTxt:     { fontFamily:fonts.dmSansMedium, fontSize:fontSize.xs, color:colors.textPrimary },
  empty:       { flex:1, justifyContent:'center', alignItems:'center', paddingHorizontal:spacing.xl },
  emptyTitle:  { fontFamily:fonts.corben, fontSize:fontSize.lg, color:colors.textPrimary, marginBottom:spacing.xs },
  emptyBody:   { fontFamily:fonts.dmSans, fontSize:fontSize.md, color:colors.textMuted, textAlign:'center', lineHeight:24, marginBottom:spacing.lg },
  suggestRow:  { flexDirection:'row', flexWrap:'wrap', gap:spacing.xs, justifyContent:'center' },
  suggest:     { backgroundColor:colors.surfaceRaised, borderColor:colors.border, borderRadius:borderRadius.full, borderWidth:1, paddingHorizontal:spacing.md, paddingVertical:spacing.xs },
  suggestTxt:  { fontFamily:fonts.dmSansMedium, fontSize:fontSize.sm, color:colors.textSecondary },
  sendingBar:  { flexDirection:'row', alignItems:'center', gap:spacing.xs, paddingHorizontal:spacing.lg, paddingVertical:spacing.xs },
  sendingTxt:  { fontFamily:fonts.dmSans, fontSize:fontSize.sm, color:colors.textMuted },
  composer:    { alignItems:'flex-end', backgroundColor:colors.surfaceRaised, borderTopColor:colors.border, borderTopWidth:1, flexDirection:'row', gap:spacing.xs, paddingHorizontal:spacing.lg, paddingVertical:spacing.sm },
  textInput:   { backgroundColor:colors.background, borderColor:colors.border, borderRadius:borderRadius.xl, borderWidth:1, color:colors.textPrimary, flex:1, fontFamily:fonts.dmSans, fontSize:fontSize.md, lineHeight:22, maxHeight:100, paddingHorizontal:spacing.md, paddingVertical:10 },
  sendBtn:     { alignItems:'center', backgroundColor:colors.accent, borderRadius:20, height:40, justifyContent:'center', width:40 },
  sendBtnOff:  { backgroundColor:colors.surfaceInset },
  sendBtnTxt:  { color:colors.white, fontFamily:fonts.dmSansMedium, fontSize:16 },
});
