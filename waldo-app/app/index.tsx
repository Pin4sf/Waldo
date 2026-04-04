import { Redirect } from 'expo-router';

/**
 * Demo mode: bypass auth, go straight to dashboard.
 * Data loads via DEMO_USER_ID (Ark's 856 days of real health data).
 * Re-enable auth flow before beta by restoring the useAuth version.
 */
export default function Root() {
  return <Redirect href="/(tabs)/dashboard" />;
}
