# Deep Learning Specification - Fine-Tuning Pretrained Model for Voice Intent Classification

- **Project:** VoFlow Desktop
- **Course Context:** Deep Learning Course Project
- **Methodology:** Transfer Learning & Fine-Tuning Pretrained Transformer Models
- **Backbone Models:** `indobenchmark/indobert-lite-p1` or `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`
- **Framework:** PyTorch + Hugging Face Transformers -> ONNX Runtime (Windows x64)
- **Status:** Architecture & Pipeline Specification

---

## 1. Overview & Rationale

Pendekatan yang digunakan adalah **Transfer Learning (Fine-Tuning)** menggunakan model Pretrained Transformer. 

Dalam standar riset dan industri modern, melatih model NLP dari nol (*scratch*) untuk bahasa manusia sering kali kurang optimal karena model belum memiliki pemahaman semantik bahasa. Dengan menggunakan model yang sudah dilatih sebelumnya (*pretrained model*), model sudah memahami tata bahasa, sinonim, dan kosakata bahasa Indonesia. Tugas kita adalah **melatih ulang (fine-tuning) lapisan klasifikasinya** menggunakan dataset perintah suara custom VoFlow.

### Mengapa Pendekatan Ini Sangat Diterima di Akademik / Matkul DL?
1. **State-of-the-Art (SOTA):** Transfer learning berbasis Transformer adalah standar emas pemrosesan bahasa alami (NLP) modern.
2. **Kaya Konteks Bahasa:** Model seperti **IndoBERT** sudah paham bahwa *"ngoding"*, *"kerja"*, dan *"kantor"* itu bertema sama, sehingga kita tidak butuh jutaan data training. Cukup 500-1.500 baris data variasi perintah.
3. **Pekerjaan Riset yang Jelas:**
   - Menyusun dataset custom domain perintah suara.
   - Melakukan tokenisasi dan data augmentation.
   - Menambahkan custom classification head di atas pretrained backbone.
   - Melakukan fine-tuning dengan hyperparameter tuning (learning rate, batch size, warmup).
   - Evaluasi kuantitatif (Confusion Matrix, Precision, Recall, F1-Score).
   - Export ke format ONNX INT8 terkuantisasi agar ringan di aplikasi desktop Windows.

---

## 2. Pilihan Pretrained Backbone Model

Kita memilih model yang memiliki performa tinggi tetapi tetap ringan untuk dieksekusi di laptop/PC:

| Model Backbone | Jumlah Parameter | Ukuran File (ONNX INT8) | Keunggulan |
|---|---|---|---|
| **IndoBERT-Lite (`indobenchmark/indobert-lite-p1`)** | ~11 Juta | ~25 MB | Sangat fasih bahasa Indonesia sehari-hari/gaul, sangat ringan. |
| **Multilingual MiniLM (`paraphrase-multilingual-MiniLM-L12-v2`)** | ~117 Juta | ~60 MB | Fasih bilingual (bahasa Indonesia & Inggris sekaligus). |

*Rekomendasi Utama:* **IndoBERT-Lite** atau **Multilingual MiniLM** karena ukurannya kecil, hemat RAM, dan latensi inferensinya di CPU Windows di bawah 15 ms.

---

## 3. Arsitektur Model Fine-Tuning

```
Input Text: "Tolong nyalain mode belajar dong"
                       |
                       v
[ PRETRAINED TOKENIZER (WordPiece / SentencePiece) ]
Tokens: ['tolong', 'nyala', '##in', 'mode', 'belajar', 'dong']
Input IDs:  [101, 3421, 5678, 1290, 4321, 7890, 2345, 102]
Attention Mask: [1, 1, 1, 1, 1, 1, 1, 1]
                       |
                       v
+-----------------------------------------------------------------+
| PRETRAINED TRANSFORMER BACKBONE (IndoBERT / MiniLM)            |
| Multi-Head Self-Attention Layers + Feed-Forward Blocks          |
| Menghasilkan representasi kontekstual tiap token                |
+-----------------------------------------------------------------+
                       |
                       v
[CLS] Token Output Vector (768 dimensi / 384 dimensi)
                       |
                       v
+-----------------------------------------------------------------+
| CUSTOM CLASSIFICATION HEAD (Lapisan yang Kita Latih)           |
| - Dropout (rate = 0.3)                                          |
| - Linear Layer (Hidden_Dim -> 128) + GELU Activation            |
| - LayerNormalization(128)                                       |
| - Linear Layer (128 -> Num_Classes, misal: 6 intent)            |
+-----------------------------------------------------------------+
                       |
                       v
Softmax Output: Probabilitas untuk tiap kelas intent
  - INTENT_WORK_MODE: 0.02
  - INTENT_STUDY_MODE: 0.94  <-- (Predicted Class)
  - INTENT_RELAX_MODE: 0.01
  - INTENT_UNKNOWN: 0.03
```

---

## 4. Alur Kerja Lengkap (End-to-End Workflow)

```
[ 1. Dataset Collection & Labelling ]
Kumpulkan 500-1.500 kalimat perintah suara ke dalam file dataset.csv
                       |
                       v
[ 2. Data Preparation & Augmentation ]
Bagi data (80% Train, 10% Validation, 10% Test) + sinonim bahasa Indonesia
                       |
                       v
[ 3. Fine-Tuning Script (PyTorch + Hugging Face) ]
Latih model selama 5-10 epoch menggunakan optimizer AdamW + Warmup
                       |
                       v
[ 4. Academic Evaluation ]
Hitung F1-score, plot grafik Loss/Akurasi, dan gambar Confusion Matrix
                       |
                       v
[ 5. Export ke ONNX Runtime ]
Konversi model .pt ke .onnx + kuantisasi INT8 agar ukurannya hanya ~25 MB
                       |
                       v
[ 6. Integrasi ke VoFlow Windows Desktop ]
Aplikasi Windows menjalankan model .onnx secara lokal dan instan (< 15 ms)
```

---

## 5. Rincian Setiap Tahapan

### Tahap 1: Pembuatan Dataset Custom (`dataset.csv`)
Dataset dibuat dalam format tabular sederhana yang berisi pasangan teks ucapan dan label target:

```csv
text,label
"mulai mode belajar",INTENT_STUDY
"waktunya belajar nih",INTENT_STUDY
"buka materi kuliah dong",INTENT_STUDY
"mode ngoding aktifkan",INTENT_WORK
"buka visual studio code dan spotify",INTENT_WORK
"gue mau mulai kerja",INTENT_WORK
"santai dulu ah",INTENT_RELAX
"buka youtube mau nonton",INTENT_RELAX
"kunci layar komputer",INTENT_SYSTEM_LOCK
"resep nasi goreng enak",INTENT_UNKNOWN
```

### Tahap 2: Script Fine-Tuning (PyTorch & Hugging Face)
Menggunakan library standar akademik `transformers` dan `torch`:

```python
import torch
import torch.nn as nn
from transformers import AutoModel, AutoTokenizer

class VoFlowIntentClassifier(nn.Module):
    def __init__(self, model_name, num_classes, dropout_rate=0.3):
        super(VoFlowIntentClassifier, self).__init__()
        self.encoder = AutoModel.from_pretrained(model_name)
        hidden_size = self.encoder.config.hidden_size
        
        # Classification Head
        self.classifier = nn.Sequential(
            nn.Dropout(dropout_rate),
            nn.Linear(hidden_size, 128),
            nn.GELU(),
            nn.LayerNorm(128),
            nn.Linear(128, num_classes)
        )

    def forward(self, input_ids, attention_mask):
        outputs = self.encoder(input_ids=input_ids, attention_mask=attention_mask)
        # Mengambil pooling representasi dari token [CLS]
        cls_output = outputs.last_hidden_state[:, 0, :]
        logits = self.classifier(cls_output)
        return logits
```

### Tahap 3: Hyperparameter Training
- **Optimizer:** AdamW (Learning Rate: $2\times 10^{-5}$ untuk backbone, $1\times 10^{-3}$ untuk classification head).
- **Batch Size:** 16 atau 32.
- **Epochs:** Cukup 5 sampai 10 epoch (karena model pretrained konvergen sangat cepat).
- **Loss Function:** CrossEntropyLoss.
- **Scheduler:** Linear Warmup with Cosine Decay.

### Tahap 4: Hasil & Evaluasi untuk Laporan Matkul
Untuk diserahkan di laporan atau presentasi:
1. **Confusion Matrix Heatmap:** Menunjukkan akurasi prediksi untuk masing-masing kelas intent.
2. **Classification Report:** Precision, Recall, dan F1-Score tiap kelas.
3. **Training Loss Curve:** Menunjukkan bahwa model belajar dengan baik tanpa overfitting.
4. **Latency Benchmark:** Mengukur waktu inferensi (ms) di laptop.

### Tahap 5: Export ke ONNX (Siap Pakai di Windows)
Setelah training selesai, model diekspor ke ONNX agar aplikasi desktop tidak membutuhkan Python sama sekali:

```python
# Export PyTorch Model ke format ONNX
dummy_input_ids = torch.zeros((1, 16), dtype=torch.long)
dummy_mask = torch.ones((1, 16), dtype=torch.long)

torch.onnx.export(
    model,
    (dummy_input_ids, dummy_mask),
    "voflow_intent_model.onnx",
    input_names=['input_ids', 'attention_mask'],
    output_names=['logits'],
    dynamic_axes={'input_ids': {0: 'batch_size'}, 'logits': {0: 'batch_size'}},
    opset_version=14
)
```

### Tahap 6: Integrasi di VoFlow Desktop
Di aplikasi Windows:
1. Speech-to-Text menghasilkan teks (misal: *"aktifkan mode belajar"*).
2. Teks diubah jadi token ID menggunakan tokenizer yang sama.
3. ONNX Runtime mengeksekusi file `voflow_intent_model.onnx` di Windows secara lokal.
4. Output kelas `INTENT_STUDY` memicu workflow belajar di aplikasi.

---

## 6. Checklist Tugas Matkul Deep Learning

- [x] **Problem Formulation:** Klasifikasi intent dari teks perintah suara pengguna.
- [x] **Model Architecture:** Pretrained Transformer (IndoBERT/MiniLM) + Custom Neural Classification Head.
- [x] **Dataset Collection:** Domain-specific voice automation command dataset.
- [x] **Training Process:** Fine-tuning dengan AdamW, loss curve monitoring, dan hyperparameter tuning.
- [x] **Evaluation:** Confusion Matrix, Precision, Recall, F1-Score.
- [x] **Model Deployment:** ONNX Runtime local execution di aplikasi Windows.
