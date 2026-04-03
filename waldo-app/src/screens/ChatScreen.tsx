/**
 * ChatScreen — conversational Waldo interface.
 *
 * Loads the last 30 days of conversation history from Supabase.
 * Sends new messages via invoke-agent.
 * Waldo's messages show with 👍/👎 feedback options.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, Pressable, FlatList,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  ListRenderItem,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchConversationHistory, sendMessageToWaldo, type ChatMessage } from '@/adapters/sync/waldo-queries';

const MODE_LABEL: Record<string, string> = {
  morning_wag: '🌅 Morning Wag',
  fetch_alert: '⚡ Fetch Alert',
  evening_review: '🌙 Evening Review',
  conversational: '',
  onboarding: '👋 Onboarding',
};

const ZONE_COLOR: Record<string, string> = {
  peak: '#34D399',
  moderate: '#F59E0B',
  low: '#EF4444',
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });
}

function formatDay(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' });
}

type ListItem = { type: 'message'; data: ChatMessage } | { type: 'day_divider'; date: string };

function MessageBubble({ msg, onFeedback }: { msg: ChatMessage; onFeedback?: (positive: boolean) => void }) {
  const isWaldo = msg.role === 'waldo';
  const modeLabel = msg.mode ? (MODE_LABEL[msg.mode] ?? '') : '';

  return (
    <View style={{
      flexDirection: isWaldo ? 'row' : 'row-reverse',
      alignItems: 'flex-end',
      marginBottom: 12,
      paddingHorizontal: 16,
    }}>
      {isWaldo && (
        <View style={{
          width: 30, height: 30, borderRadius: 15, backgroundColor: '#F97316',
          alignItems: 'center', justifyContent: 'center', marginRight: 8, flexShrink: 0,
        }}>
          <Text style={{ fontSize: 16 }}>🐕</Text>
        </View>
      )}

      <View style={{ maxWidth: '78%' }}>
        {isWaldo && modeLabel ? (
          <Text style={{ fontSize: 10, color: '#9CA3AF', marginBottom: 3, marginLeft: 2 }}>{modeLabel}</Text>
        ) : null}

        <View style={{
          backgroundColor: isWaldo ? '#FFFFFF' : '#F97316',
          borderRadius: isWaldo ? 2 : 18,
          borderTopLeftRadius: isWaldo ? 2 : 18,
          borderTopRightRadius: isWaldo ? 18 : 2,
          borderBottomLeftRadius: 18,
          borderBottomRightRadius: 18,
          paddingHorizontal: 14,
          paddingVertical: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.06,
          shadowRadius: 3,
          elevation: 1,
        }}>
          <Text style={{
            fontSize: 14,
            lineHeight: 21,
            color: isWaldo ? '#1A1A1A' : '#FFFFFF',
          }}>
            {msg.content}
          </Text>
        </View>

        <View style={{
          flexDirection: isWaldo ? 'row' : 'row-reverse',
          alignItems: 'center',
          marginTop: 4,
          gap: 8,
        }}>
          <Text style={{ fontSize: 10, color: '#9CA3AF' }}>{formatTime(msg.createdAt)}</Text>
          {isWaldo && onFeedback && (
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <Pressable onPress={() => onFeedback(true)}>
                <Text style={{ fontSize: 14 }}>👍</Text>
              </Pressable>
              <Pressable onPress={() => onFeedback(false)}>
                <Text style={{ fontSize: 14 }}>👎</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

export function ChatScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    fetchConversationHistory(50).then(msgs => {
      setMessages(msgs);
      setLoading(false);
    });
  }, []);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  useEffect(() => {
    if (messages.length > 0) scrollToBottom();
  }, [messages.length]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;

    setInput('');
    setSending(true);

    // Optimistically add user message
    const tempMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: text,
      mode: 'conversational',
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempMsg]);
    scrollToBottom();

    const reply = await sendMessageToWaldo(text);

    if (reply) {
      const waldoMsg: ChatMessage = {
        id: `waldo-${Date.now()}`,
        role: 'waldo',
        content: reply.message,
        mode: 'conversational',
        createdAt: new Date().toISOString(),
      };
      setMessages(prev => [...prev, waldoMsg]);
    } else {
      const errMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'waldo',
        content: "I hit a snag. Try again in a moment.",
        mode: 'conversational',
        createdAt: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errMsg]);
    }

    setSending(false);
    scrollToBottom();
  };

  // Build list items with day dividers
  const listItems: ListItem[] = [];
  let lastDay = '';
  for (const msg of messages) {
    const day = msg.createdAt.slice(0, 10);
    if (day !== lastDay) {
      listItems.push({ type: 'day_divider', date: day });
      lastDay = day;
    }
    listItems.push({ type: 'message', data: msg });
  }

  const renderItem: ListRenderItem<ListItem> = ({ item }) => {
    if (item.type === 'day_divider') {
      return (
        <View style={{ alignItems: 'center', marginVertical: 12 }}>
          <View style={{ backgroundColor: '#F3F4F6', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4 }}>
            <Text style={{ fontSize: 11, color: '#9CA3AF' }}>{formatDay(item.date + 'T12:00:00')}</Text>
          </View>
        </View>
      );
    }
    return <MessageBubble msg={item.data} />;
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FAFAF8' }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#F97316" />
          <Text style={{ fontSize: 13, color: '#9CA3AF', marginTop: 12 }}>Loading conversations...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FAFAF8' }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E5E5E3' }}>
          <Text style={{ fontSize: 22, fontWeight: '700', color: '#1A1A1A' }}>Chat</Text>
          <View style={{ flex: 1 }} />
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#34D399' }} />
          <Text style={{ fontSize: 11, color: '#6B7280', marginLeft: 4 }}>Waldo</Text>
        </View>

        {/* Empty state */}
        {messages.length === 0 && (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
            <Text style={{ fontSize: 48, marginBottom: 16 }}>💬</Text>
            <Text style={{ fontSize: 18, fontWeight: '600', textAlign: 'center', marginBottom: 8, color: '#1A1A1A' }}>
              Ask Waldo anything
            </Text>
            <Text style={{ fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 22 }}>
              How's my sleep trending? What made last Tuesday rough? When's my peak window today?
            </Text>
          </View>
        )}

        {/* Messages */}
        {messages.length > 0 && (
          <FlatList
            ref={flatListRef}
            data={listItems}
            keyExtractor={(item, i) => item.type === 'day_divider' ? `divider-${item.date}` : item.data.id}
            renderItem={renderItem}
            contentContainerStyle={{ paddingTop: 16, paddingBottom: 8 }}
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* Sending indicator */}
        {sending && (
          <View style={{ paddingHorizontal: 16, paddingBottom: 4, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: '#F97316', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 16 }}>🐕</Text>
            </View>
            <View style={{ backgroundColor: '#FFFFFF', borderRadius: 18, paddingHorizontal: 16, paddingVertical: 12 }}>
              <ActivityIndicator size="small" color="#F97316" />
            </View>
          </View>
        )}

        {/* Input */}
        <View style={{
          flexDirection: 'row', alignItems: 'flex-end', gap: 10,
          paddingHorizontal: 16, paddingVertical: 12,
          borderTopWidth: 1, borderTopColor: '#E5E5E3',
          backgroundColor: '#FAFAF8',
        }}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask Waldo..."
            placeholderTextColor="#9CA3AF"
            multiline
            maxLength={500}
            style={{
              flex: 1, backgroundColor: '#FFFFFF', borderRadius: 22, borderWidth: 1,
              borderColor: '#E5E5E3', paddingHorizontal: 16, paddingVertical: 10,
              fontSize: 15, color: '#1A1A1A', maxHeight: 120,
            }}
            onSubmitEditing={handleSend}
            returnKeyType="send"
            blurOnSubmit={false}
          />
          <Pressable
            onPress={handleSend}
            disabled={!input.trim() || sending}
            style={{
              width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
              backgroundColor: input.trim() && !sending ? '#F97316' : '#E5E5E3',
            }}
          >
            <Text style={{ fontSize: 20 }}>↑</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
