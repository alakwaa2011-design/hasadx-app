import React, { useEffect } from 'react';
import { ActivityIndicator, Platform, Text, View } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ReaderProvider } from '@/context/ReaderContext';
import { OfflineContentProvider } from '@/lib/offline-content';
import { setBaseUrl } from '@workspace/api-client-react';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { quranApiOrigin } from '@/lib/api-origin';
import colors from '@/constants/colors';

SplashScreen.preventAutoHideAsync();
if (quranApiOrigin) setBaseUrl(quranApiOrigin);
const queryClient = new QueryClient();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);
  if (!fontsLoaded && !fontError) return Platform.OS === 'web'
    ? <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, backgroundColor: colors.light.background }}>
        <Text style={{ color: colors.light.primary, fontSize: 22, fontWeight: '700' }}>مصحف حصاد</Text>
        <ActivityIndicator color={colors.light.primary} accessibilityLabel="جارٍ فتح المصحف" />
      </View>
    : null;
  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <ReaderProvider>
              <OfflineContentProvider>
                <Stack screenOptions={{ headerShown: false }} />
              </OfflineContentProvider>
            </ReaderProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}