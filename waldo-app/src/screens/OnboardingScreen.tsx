/**
 * OnboardingScreen — three-step setup after first sign-in.
 *
 * Step 1: Name + timezone
 * Step 2: Connect Google (opens oauth-google/connect in browser)
 * Step 3: Link Telegram (shows 6-digit code)
 *
 * Calls user-profile Edge Function to create the users row.
 * After completion → useAuth detects the users row → navigates to dashboard.
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, Pressable,
  ActivityIndicator, Linking, Alert, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase, getAuthUserId } from '@/adapters/sync/supabase-client';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

interface Props {
  onComplete: () => void;
}

type Step = 'profile' | 'google' | 'telegram';

interface UserProfile {
  userId: string;
  linkingCode: string;
}

export function OnboardingScreen({ onComplete }: Props) {
  const [step, setStep] = useState<Step>('profile');
  const [name, setName] = useState('');
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [googleConnected, setGoogleConnected] = useState(false);

  async function createProfile() {
    const cleaned = name.trim();
    if (!cleaned) { Alert.alert('Enter your name'); return; }

    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); return; }

    const res = await fetch(`${SUPABASE_URL}/functions/v1/user-profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        name: cleaned,
        timezone,
        wearable_type: 'apple_watch',
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      Alert.alert('Setup failed', data.error ?? 'Please try again');
      return;
    }

    setProfile({ userId: data.user_id, linkingCode: data.linking_code });
    setStep('google');
  }

  async function connectGoogle() {
    if (!profile) return;
    const connectUrl = `${SUPABASE_URL}/functions/v1/oauth-google/connect?user_id=${profile.userId}&scopes=calendar,gmail,tasks`;
    await Linking.openURL(connectUrl);
    // After returning from browser, user may have connected
    setGoogleConnected(true);
    setStep('telegram');
  }

  function skipGoogle() {
    setStep('telegram');
  }

  async function refreshLinkingCode() {
    if (!profile) return;
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); return; }

    const res = await fetch(`${SUPABASE_URL}/functions/v1/user-profile/linking-code`, {
      headers: { 'Authorization': `Bearer ${session.access_token}` },
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok && data.code) {
      setProfile(p => p ? { ...p, linkingCode: data.code } : p);
    }
  }

  // ─── Step 1: Profile ──────────────────────────────────────────

  if (step === 'profile') {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <ScrollView className="flex-1 px-8" contentContainerStyle={{ paddingTop: 48, paddingBottom: 48 }}>
          <Text className="text-4xl mb-2" style={{ fontFamily: 'VCorben' }}>Let's set up Waldo</Text>
          <Text className="text-base text-gray-500 mb-10">Takes 2 minutes. Three steps.</Text>

          <View className="mb-2">
            <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Step 1 of 3</Text>
            <Text className="text-xl font-bold mb-6">Who are you?</Text>
          </View>

          <Text className="text-sm font-medium text-gray-700 mb-2">Your name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Ark"
            placeholderTextColor="#9CA3AF"
            autoCapitalize="words"
            returnKeyType="next"
            className="border border-gray-200 rounded-2xl px-4 py-4 text-base text-gray-900 bg-white mb-4"
          />

          <Text className="text-sm font-medium text-gray-700 mb-2">Your timezone</Text>
          <View className="border border-gray-200 rounded-2xl px-4 py-4 bg-white mb-8">
            <Text className="text-base text-gray-900">{timezone}</Text>
            <Text className="text-xs text-gray-400 mt-1">Auto-detected from your device</Text>
          </View>

          <Pressable
            onPress={createProfile}
            disabled={loading || !name.trim()}
            className={`rounded-2xl px-6 py-4 items-center ${name.trim() ? 'bg-orange-500' : 'bg-gray-200'}`}
          >
            {loading ? <ActivityIndicator color="#fff" /> : (
              <Text className={`text-base font-semibold ${name.trim() ? 'text-white' : 'text-gray-400'}`}>
                Continue →
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── Step 2: Google ───────────────────────────────────────────

  if (step === 'google') {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 px-8 justify-center">
          <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Step 2 of 3</Text>
          <Text className="text-2xl font-bold mb-2">Connect Google</Text>
          <Text className="text-base text-gray-500 mb-8 leading-6">
            Waldo reads your Calendar, Gmail volume, and Tasks to know when your day is overloaded — not just your body.
          </Text>

          <View className="bg-white rounded-2xl p-4 mb-6 border border-gray-100">
            {[
              { icon: '📅', label: 'Calendar', desc: 'Meeting load, focus gaps' },
              { icon: '📧', label: 'Gmail', desc: 'Volume & after-hours pressure (no body content)' },
              { icon: '✅', label: 'Tasks', desc: 'Deadline pressure, overdue pile-up' },
            ].map(item => (
              <View key={item.label} className="flex-row items-start mb-3 last:mb-0">
                <Text className="text-xl mr-3 mt-0.5">{item.icon}</Text>
                <View>
                  <Text className="text-sm font-semibold text-gray-900">{item.label}</Text>
                  <Text className="text-xs text-gray-500">{item.desc}</Text>
                </View>
              </View>
            ))}
          </View>

          <Pressable
            onPress={connectGoogle}
            className="bg-orange-500 rounded-2xl px-6 py-4 items-center mb-3"
          >
            <Text className="text-base font-semibold text-white">Connect Google Workspace</Text>
          </Pressable>

          <Pressable onPress={skipGoogle} className="items-center py-3">
            <Text className="text-sm text-gray-400">Skip for now</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Step 3: Telegram ─────────────────────────────────────────

  const code = profile?.linkingCode ?? '------';

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 px-8 justify-center">
        <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Step 3 of 3</Text>
        <Text className="text-2xl font-bold mb-2">Link Telegram</Text>
        <Text className="text-base text-gray-500 mb-8 leading-6">
          Waldo sends your Morning Wag, Fetch Alerts, and Evening Reviews via Telegram.
        </Text>

        <View className="bg-white rounded-2xl p-6 mb-6 border border-gray-100 items-center">
          <Text className="text-sm text-gray-500 mb-3">Your linking code</Text>
          <Text className="text-4xl font-bold tracking-widest text-gray-900 mb-3">{code}</Text>
          <Text className="text-xs text-gray-400 text-center">Valid for 10 minutes</Text>
        </View>

        <View className="bg-orange-50 rounded-2xl p-4 mb-6">
          <Text className="text-sm font-semibold text-orange-800 mb-2">How to link:</Text>
          <Text className="text-sm text-orange-700 leading-5">
            1. Open Telegram{'\n'}
            2. Search for <Text className="font-semibold">@YourWaldoBot</Text>{'\n'}
            3. Send <Text className="font-semibold">/start</Text>{'\n'}
            4. Enter the 6-digit code above
          </Text>
        </View>

        <Pressable
          onPress={refreshLinkingCode}
          disabled={loading}
          className="items-center py-3 mb-4"
        >
          <Text className="text-sm text-gray-400 underline">Get a new code</Text>
        </Pressable>

        <Pressable
          onPress={onComplete}
          className="bg-orange-500 rounded-2xl px-6 py-4 items-center"
        >
          <Text className="text-base font-semibold text-white">I've linked Telegram →</Text>
        </Pressable>

        <Pressable onPress={onComplete} className="items-center py-3">
          <Text className="text-sm text-gray-400">Skip, I'll do this later</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
