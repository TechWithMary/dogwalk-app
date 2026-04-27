import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#F9FAFB' }
          }}
        >
          <Stack.Screen name="(auth)/login" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          
          {/* Owner Screens */}
          <Stack.Screen name="booking" options={{ presentation: 'modal' }} />
          <Stack.Screen name="booking-details" options={{ presentation: 'card' }} />
          <Stack.Screen name="live-walk" options={{ presentation: 'fullScreenModal' }} />
          <Stack.Screen name="pets" options={{ presentation: 'modal' }} />
          <Stack.Screen name="onboarding-owner" options={{ presentation: 'modal' }} />
          <Stack.Screen name="onboarding-walker" options={{ presentation: 'modal' }} />
          <Stack.Screen name="walker-profile" options={{ presentation: 'card' }} />
          <Stack.Screen name="edit-profile" options={{ presentation: 'modal' }} />
          <Stack.Screen name="wallet" options={{ presentation: 'card' }} />
          <Stack.Screen name="terms" options={{ presentation: 'modal' }} />
          <Stack.Screen name="privacy" options={{ presentation: 'modal' }} />
          
          {/* New Screens */}
          <Stack.Screen name="notifications" options={{ presentation: 'card' }} />
          <Stack.Screen name="rating" options={{ presentation: 'modal' }} />
          <Stack.Screen name="walker-home" options={{ headerShown: false }} />
          <Stack.Screen name="walker-balance" options={{ presentation: 'card' }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
