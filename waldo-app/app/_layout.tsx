import '../global.css';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import React from 'react';
import { PipelineProvider } from '@/services/pipeline-provider';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  state = { hasError: false, message: '' };

  static getDerivedStateFromError(error: unknown) {
    return { hasError: true, message: error instanceof Error ? error.message : String(error) };
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex:1, alignItems:'center', justifyContent:'center', padding:24, backgroundColor:'#FAFAF8' }}>
          <Text style={{ fontSize:40, marginBottom:16 }}>🐕</Text>
          <Text style={{ fontSize:16, fontWeight:'600', textAlign:'center', marginBottom:8 }}>
            Something went wrong
          </Text>
          <Text style={{ fontSize:12, color:'#6B7280', textAlign:'center' }}>
            {this.state.message}
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function RootLayout() {
  return (
    <AppErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <QueryClientProvider client={queryClient}>
          {/* PipelineProvider initialises Health Connect (Android) / HealthKit (iOS)
              immediately on app start — before any screen mounts. */}
          <PipelineProvider>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: '#FAFAF8' },
                animation: 'fade',
              }}
            />
            <StatusBar style="dark" />
          </PipelineProvider>
        </QueryClientProvider>
      </GestureHandlerRootView>
    </AppErrorBoundary>
  );
}
