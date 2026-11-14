import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Image } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { getHerbalBySlug } from '../../services/api';
import { HerbalDetail } from '../../types/herbal';

export default function DetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [herbal, setHerbal] = useState<HerbalDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (slug) {
      getHerbalBySlug(slug)
        .then((data) => setHerbal(data))
        .catch(() => setError("Gagal mengambil data tanaman dari server backend."))
        .finally(() => setLoading(false));
    }
  }, [slug]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2e7d32" />
        <Text style={{ marginTop: 10 }}>Memuat Informasi Botani & Riset...</Text>
      </View>
    );
  }

  if (error || !herbal) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error || "Data tidak ditemukan."}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {herbal.image_url && (
        <Image source={{ uri: herbal.image_url }} style={styles.headerImage} />
      )}
      <View style={styles.content}>
        <Text style={styles.name}>{herbal.name}</Text>
        <Text style={styles.scientificName}>{herbal.scientific_name}</Text>
        <Text style={styles.badge}>Bagian Digunakan: {herbal.plant_parts_used}</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Deskripsi</Text>
          <Text style={styles.bodyText}>{herbal.description}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Penggunaan Tradisional</Text>
          <Text style={styles.bodyText}>{herbal.traditional_usage}</Text>
        </View>

        {herbal.lab_evidence && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🔬 Bukti Penelitian Laboratorium</Text>
            <Text style={styles.bodyText}>{herbal.lab_evidence}</Text>
          </View>
        )}

        {herbal.clinical_evidence && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🩺 Bukti Uji Klinis Manusia</Text>
            <Text style={styles.bodyText}>{herbal.clinical_evidence}</Text>
          </View>
        )}

        <View style={[styles.section, styles.warningBox]}>
          <Text style={styles.warningTitle}>⚠️ Peringatan Keamanan & Kontraindikasi</Text>
          <Text style={styles.warningText}>{herbal.safety_warning}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📚 Referensi Ilmiah Terverifikasi</Text>
          {herbal.references && herbal.references.map((ref) => (
            <View key={ref.id} style={styles.refItem}>
              <Text style={styles.refTitle}>{ref.title}</Text>
              <Text style={styles.refAuthor}>{ref.author_year} — Level Bukti: {ref.evidence_level}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  headerImage: { width: '100%', height: 220 },
  content: { padding: 20 },
  name: { fontSize: 24, fontWeight: 'bold', color: '#1b5e20' },
  scientificName: { fontSize: 16, fontStyle: 'italic', color: '#555', marginBottom: 8 },
  badge: { backgroundColor: '#e8f5e9', color: '#2e7d32', padding: 6, borderRadius: 6, alignSelf: 'flex-start', marginBottom: 15, fontWeight: '600' },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#2e7d32', marginBottom: 6 },
  bodyText: { fontSize: 14, color: '#333', lineHeight: 22 },
  warningBox: { backgroundColor: '#fff3e0', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#ffe0b2' },
  warningTitle: { color: '#e65100', fontWeight: 'bold', marginBottom: 4 },
  warningText: { color: '#bf360c', fontSize: 13, lineHeight: 18 },
  refItem: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#eee' },
  refTitle: { fontSize: 13, fontWeight: '600', color: '#333' },
  refAuthor: { fontSize: 12, color: '#666', marginTop: 2 },
  errorText: { color: '#d32f2f', fontSize: 16 }
});