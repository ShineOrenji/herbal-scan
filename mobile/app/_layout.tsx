import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../contexts/AuthContext';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#06140D' },
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="detail/[slug]" options={{ headerShown: false }} />
          <Stack.Screen
            name="auth"
            options={{
              headerShown: false,
              presentation: 'modal',
            }}
          />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  );
}