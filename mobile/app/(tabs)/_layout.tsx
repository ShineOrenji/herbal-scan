import React from 'react';
import { Tabs } from 'expo-router';
import CurvedTabBar from '../../components/CurvedTabBar';

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <CurvedTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Beranda' }} />
      <Tabs.Screen name="search" options={{ title: 'Cari' }} />
      <Tabs.Screen name="scan" options={{ title: 'Pindai' }} />
      <Tabs.Screen name="history" options={{ title: 'Riwayat' }} />
    </Tabs>
  );
}
