# Dokumen Spesifikasi Dataset - Herbal Scan

## 1. Sumber & Karakteristik Dataset
* **Sumber Data:** Mendeley Data (Digital Collection of Indonesian Herbal Leaves / DCD Dataset) & Dataset Tambahan.
* **Fokus Visual:** 100% Morfologi dan tekstur daun tanaman herbal Indonesia.

## 2. Daftar Kelas Tanaman (12 Kelas)

**Kelas Herbal (Daun):**
1. `belimbing_wuluh` (~350 gambar)
2. `daun_teh` (~1.000 gambar)
3. `jambu_biji` (~350 gambar)
4. `jeruk_nipis` (~350 gambar)
5. `kemangi` (~350 gambar)
6. `lidah_buaya` (~350 gambar)
7. `nangka` (~350 gambar)
8. `pandan` (~350 gambar)
9. `pepaya` (~350 gambar)
10. `seledri` (~350 gambar)
11. `sirih` (~350 gambar)

**Kelas Negatif:**
12. `bukan_herbal` (~350 gambar - Foto latar belakang acak, benda, non-tanaman, atau daun hias non-herbal).

## 3. Total & Distribusi Data
* **Total Dataset Mentah:** ~4.850+ gambar.
* **Strategi Imbalance:** Menggunakan pembatasan kuota (*sub-sampling*) pada kelas `daun_teh` hingga 400 gambar saat *data loading* di Google Colab agar seimbang dengan kelas lainnya.

## 4. Rencana Pembagian Dataset (Data Split)
Dataset dipisah menggunakan rasio:
* **70% Training Data:** Untuk proses pembelajaran model.
* **15% Validation Data:** Untuk evaluasi performa saat training (mencegah *overfitting*).
* **15% Testing Data:** Untuk evaluasi akhir akurasi model (*confusion matrix*).