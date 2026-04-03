/**
 * Root entry point — routes based on auth state.
 *
 * signed_out  → SignInScreen (magic link)
 * onboarding  → OnboardingScreen (profile + Google + Telegram)
 * ready       → Dashboard
 * loading     → Splash (dalmatian)
 */
import { View, Text, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { SignInScreen } from '@/screens/SignInScreen';
import { OnboardingScreen } from '@/screens/OnboardingScreen';

export default function Root() {
  const { authState, refresh } = useAuth();

  if (authState === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FAFAF8' }}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>🐕</Text>
        <ActivityIndicator color="#F97316" />
      </View>
    );
  }

  if (authState === 'signed_out') {
    return <SignInScreen />;
  }

  if (authState === 'onboarding') {
    return <OnboardingScreen onComplete={refresh} />;
  }

  // ready → main app
  return <Redirect href="/(tabs)/dashboard" />;
}
