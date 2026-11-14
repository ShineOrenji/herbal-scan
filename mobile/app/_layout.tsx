import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(tabs)/scan" options={{ headerShown: true, title: 'Herbal Scan' }} />
      <Stack.Screen name="detail/[slug]" options={{ headerShown: true, title: 'Detail Botani' }} />
    </Stack>
  );
}