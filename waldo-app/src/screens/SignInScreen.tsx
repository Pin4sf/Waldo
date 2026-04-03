/**
 * SignInScreen — magic link email sign-in.
 *
 * Supabase sends a magic link to the user's email.
 * When they tap it, the app deep-links back and session is established.
 *
 * No password. No social login. One tap.
 */
import React, { useState } from 'react';
import {
  View, Text, TextInput, Pressable,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/adapters/sync/supabase-client';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

export function SignInScreen() {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSend() {
    const cleaned = email.trim().toLowerCase();
    if (!cleaned.includes('@')) {
      Alert.alert('Enter a valid email');
      return;
    }

    setSending(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: cleaned,
      options: {
        // Deep link: waldo://auth/callback — configured in app.json
        emailRedirectTo: 'waldo://auth/callback',
      },
    });
    setSending(false);

    if (error) {
      Alert.alert('Something went wrong', error.message);
      return;
    }

    setSent(true);
  }

  if (sent) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-5xl mb-6">📬</Text>
          <Text className="text-2xl font-bold text-center mb-3" style={{ fontFamily: 'VCorben' }}>
            Check your inbox
          </Text>
          <Text className="text-base text-gray-500 text-center leading-6">
            We sent a sign-in link to{'\n'}
            <Text className="font-medium text-gray-800">{email.trim().toLowerCase()}</Text>
          </Text>
          <Text className="text-sm text-gray-400 text-center mt-6">
            Tap the link in the email to continue.{'\n'}
            It expires in 1 hour.
          </Text>
          <Pressable
            onPress={() => setSent(false)}
            className="mt-10 px-6 py-3"
          >
            <Text className="text-sm text-gray-400 underline">Use a different email</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <View className="flex-1 justify-center px-8">
          {/* Header */}
          <View className="mb-10">
            <Text className="text-5xl mb-4">🐕</Text>
            <Text className="text-3xl font-bold mb-2" style={{ fontFamily: 'VCorben' }}>
              Meet Waldo
            </Text>
            <Text className="text-base text-gray-500 leading-6">
              Your biological intelligence layer.{'\n'}
              Already on it.
            </Text>
          </View>

          {/* Email input */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 mb-2">Your email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@company.com"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              returnKeyType="go"
              onSubmitEditing={handleSend}
              className="border border-gray-200 rounded-2xl px-4 py-4 text-base text-gray-900 bg-white"
            />
          </View>

          {/* Send button */}
          <Pressable
            onPress={handleSend}
            disabled={sending || !email.trim()}
            className={`rounded-2xl px-6 py-4 items-center ${
              email.trim() ? 'bg-orange-500' : 'bg-gray-200'
            }`}
          >
            {sending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className={`text-base font-semibold ${email.trim() ? 'text-white' : 'text-gray-400'}`}>
                Send sign-in link
              </Text>
            )}
          </Pressable>

          <Text className="text-xs text-gray-400 text-center mt-6">
            We'll email you a magic link. No password needed.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
