# Dokumen Laporan Eksperimen Machine Learning - Herbal Scan

## 1. Konfigurasi Eksperimen
* **Arsitektur Base Model:** MobileNetV2 (Pre-trained ImageNet)
* **Input Resolution:** 224 x 224 x 3 (RGB)
* **Optimizer:** Adam (Learning Rate = 0.001)
* **Loss Function:** Sparse Categorical Crossentropy
* **Batch Size:** 32
* **Epochs Dilatih:** 15 Epochs
* **Jumlah Kelas:** 12 Kelas (`belimbing_wuluh`, `bukan_herbal`, `daun_teh`, `jambu_biji`, `jeruk_nipis`, `kemangi`, `lidah_buaya`, `nangka`, `pandan`, `pepaya`, `seledri`, `sirih`)

## 2. Hasil Evaluasi Model
* **Training Accuracy:** 95.97%
* **Validation Accuracy:** 97.40% (Peak pada Epoch 13, Loss: 0.0826)
* **Status Overfitting:** Tidak Terjadi (*Fit*)

## 3. Kesimpulan
Model MobileNetV2 mampu mengekstraksi fitur bentuk dan tekstur daun tanaman herbal Indonesia dengan tingkat akurasi di atas 95%. Model siap dikonversi ke format **TensorFlow Lite (.tflite)** untuk deployment mobile.

 
--- Mengevaluasi Test Dataset ---
20/20 ━━━━━━━━━━━━━━━━━━━━ 21s 252ms/step - accuracy: 0.9502 - loss: 0.1375
Test Loss: 0.1375
Test Accuracy: 95.02%

--- Laporan Klasifikasi (Precision, Recall, F1-Score) ---
                 precision    recall  f1-score   support

belimbing_wuluh       0.88      0.97      0.92        67
   bukan_herbal       1.00      1.00      1.00        10
       daun_teh       0.98      1.00      0.99        61
     jambu_biji       0.98      0.98      0.98        52
    jeruk_nipis       0.96      0.86      0.91        50
        kemangi       0.98      0.85      0.91        59
    lidah_buaya       1.00      0.98      0.99        52
         nangka       0.98      0.95      0.96        55
         pandan       0.98      1.00      0.99        47
         pepaya       1.00      0.98      0.99        59
        seledri       0.96      0.98      0.97        56
          sirih       0.89      1.00      0.94        54

       accuracy                           0.96       622
      macro avg       0.97      0.96      0.96       622
   weighted avg       0.96      0.96      0.96       622

