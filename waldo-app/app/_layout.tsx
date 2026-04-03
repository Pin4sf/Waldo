import '../global.css';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import React from 'react';
import { usePipeline } from '@/services/pipeline-provider';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 2,
    },
  },
});

/** Simple error boundary — prevents full crash on unexpected render errors. */
interface ErrorBoundaryState { hasError: boolean; message: string }
class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false, message: '' };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { hasError: true, message: error instanceof Error ? error.message : String(error) };
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#FAFAF8' }}>
          <Text style={{ fontSize: 40, marginBottom: 16 }}>🐕</Text>
          <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 8, textAlign: 'center' }}>
            Waldo ran into something
          </Text>
          <Text style={{ fontSize: 13, color: '#6B7280', textAlign: 'center' }}>
            Restart the app to continue. If this keeps happening, let us know.
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

/** Inner component — can use hooks after providers are mounted. */
function AppInner() {
  // Initialises the HealthPipeline singleton:
  // - Requests HealthKit background delivery
  // - Runs catch-up query on startup
  // - Subscribes to AppState foreground transitions
  usePipeline();

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#FAFAF8' },
          animation: 'fade',
        }}
      />
      <StatusBar style="dark" />
    </>
  );
}

export default function RootLayout() {
  return (
    <AppErrorBoundary>
      <GestureHandlerRootView className="flex-1">
        <QueryClientProvider client={queryClient}>
          <AppInner />
        </QueryClientProvider>
      </GestureHandlerRootView>
    </AppErrorBoundary>
  );
}
