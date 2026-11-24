<?php

namespace Database\Seeders;

use App\Models\Herbal;
use Illuminate\Database\Seeder;

class HerbalPreparationSeeder extends Seeder
{
    public function run(): void
    {
        $monographs = [
            // 0. Kunyit
            [
                'slugs' => ['kunyit', 'kunir', 'rimpang_kunyit'],
                'sci' => 'Curcuma longa',
                'preparation_method' => "1. Cuci bersih 10–15 gram rimpang kunyit segar, kupas kulitnya, lalu parut atau iris tipis.\n2. Rebus dalam 250 ml air hingga mendidih selama 10 menit, atau peras parutan dengan 100 ml air matang hangat lalu saring.\n3. Diamkan sebentar agar endapan pati turun sebelum diminum.",
                'dosage_notes' => "Dewasa: 1–2 kali sehari sebanyak 100–150 ml sesudah makan.",
                'contraindications' => "Kontraindikasi pada penderita penyumbatan saluran empedu (obstruksi bilier) dan batu empedu. Hati-hati pada pengguna obat antikoagulan dan antiplatelet.",
                'scientific_reference' => "FROTI Kemenkes RI (Permenkes No. 6/2016) & Monograf Ekstrak Tumbuhan Obat Indonesia BPOM RI",
            ],
            // 1. Singkong
            [
                'slugs' => ['singkong'],
                'sci' => 'Manihot esculenta',
                'preparation_method' => "1. Cuci bersih daun singkong muda (50–100 gram) atau umbi yang telah dikupas kulitnya hingga bersih.\n2. Rebus dalam air mendidih terbuka minimal 15–20 menit hingga lunak sempurna, lalu buang air rebusan pertama untuk menghilangkan senyawa glikosida sianogenik.",
                'dosage_notes' => "Konsumsi sebagai pangan/sayur matang dalam porsi wajar (1 porsi per hari).",
                'contraindications' => "DILARANG keras mengonsumsi daun atau umbi singkong mentah maupun setengah matang karena mengandung linamarin yang melepaskan asam sianida (HCN).",
                'scientific_reference' => "Pedoman Keamanan Pangan BPOM RI & WHO Food Safety Guidelines",
            ],
            // 2. Pepaya
            [
                'slugs' => ['pepaya', 'daun_pepaya'],
                'sci' => 'Carica papaya',
                'preparation_method' => "1. Cuci bersih 1–2 lembar daun pepaya muda segar.\n2. Rebus dalam 300 ml air hingga daun lunak untuk mengurangi getah berlebih, lalu saring airnya atau konsumsi daunnya sebagai sayur matang.",
                'dosage_notes' => "Dewasa: 1 kali sehari 150 ml air rebusan sesudah makan.",
                'contraindications' => "Dilarang pada ibu hamil (enzim papain dapat merangsang kontraksi rahim) dan individu dengan alergi lateks.",
                'scientific_reference' => "FROTI Kemenkes RI (2016) & Acuan Sediaan Herbal BPOM RI",
            ],
            // 3. Labu Kuning
            [
                'slugs' => ['labu_kuning'],
                'sci' => 'Cucurbita pepo',
                'preparation_method' => "1. Daging buah: kukus atau rebus 100–150 gram daging labu kuning hingga empuk tanpa gula berlebih.\n2. Biji labu: kupas kulit luar biji yang sudah kering, sangrai ringan tanpa garam hingga matang.",
                'dosage_notes' => "Dewasa: 1 porsi buah kukus per hari, atau 10–15 gram biji labu sangrai per hari.",
                'contraindications' => "Pastikan hanya menggunakan labu budidaya; hindari jenis labu liar yang terasa sangat pahit karena risiko senyawa kukurbitasin toksik.",
                'scientific_reference' => "WHO Monographs on Selected Medicinal Plants & Kemenkes RI",
            ],
            // 4. Jelantir
            [
                'slugs' => ['jelantir'],
                'sci' => 'Erigeron sumatrensis',
                'preparation_method' => "1. Pemakaian luar: cuci bersih pucuk daun segar yang diambil dari area bebas polusi/pestisida, lumatkan halus untuk kompres luka gores ringan.\n2. Pemakaian dalam tradisional: rebus 5–7 gram daun muda bersih dalam 250 ml air hingga tersisa 150 ml, lalu saring.",
                'dosage_notes' => "Utamakan pemakaian luar. Pemakaian dalam hanya bila identitas botani sudah dipastikan (maksimal 1 kali sehari 100 ml).",
                'contraindications' => "Tidak dianjurkan untuk ibu hamil, ibu menyusui, anak-anak, dan penderita alergi famili Asteraceae. Hindari memetik di pinggir jalan raya.",
                'scientific_reference' => "Inventaris Tumbuhan Obat Indonesia Kemenkes RI & Kajian Etnobotani BRIN",
            ],
            // 5. Waru Variegata
            [
                'slugs' => ['waru_variegata'],
                'sci' => 'Hibiscus tiliaceus',
                'preparation_method' => "1. Pemakaian dalam: cuci bersih 5–7 lembar daun waru segar, rebus dalam 300 ml air hingga tersisa 150 ml, lalu saring.\n2. Pemakaian luar: lumatkan 2–3 lembar daun bersih dan tempelkan sebagai kompres pada bisul atau bengkak ringan.",
                'dosage_notes' => "Dewasa: 1–2 kali sehari 150 ml air rebusan sesudah makan.",
                'contraindications' => "Hindari pada ibu hamil dan ibu menyusui; pastikan daun bebas dari semprotan pestisida tanaman hias.",
                'scientific_reference' => "Acuan Sediaan Herbal BPOM RI & Inventaris Tumbuhan Obat Indonesia Kemenkes RI",
            ],
            // 6. Meniran
            [
                'slugs' => ['meniran', 'daun_meniran'],
                'sci' => 'Phyllanthus',
                'preparation_method' => "1. Cuci bersih 10–15 gram herba meniran segar (daun, batang, dan akar) hingga bebas tanah.\n2. Rebus dalam 300 ml air hingga tersisa 150 ml.\n3. Saring dan minum selagi hangat.",
                'dosage_notes' => "Dewasa: 2 kali sehari masing-masing 150 ml sesudah makan.",
                'contraindications' => "Tidak dianjurkan untuk ibu hamil, penderita penyakit autoimun aktif (karena efek imunostimulan), dan penderita hipoglikemia.",
                'scientific_reference' => "FROTI Kemenkes RI (2016) & Monograf Ekstrak Tumbuhan Obat Indonesia BPOM RI",
            ],
            // 7. Suruhan
            [
                'slugs' => ['suruhan'],
                'sci' => 'Peperomia pellucida',
                'preparation_method' => "1. Cuci bersih 15–20 gram seluruh bagian herba suruhan segar dari area bersih dengan air matang.\n2. Rebus dalam 300 ml air dengan api kecil hingga tersisa 150 ml lalu saring, atau seduh singkat selama 5–10 menit.",
                'dosage_notes' => "Dewasa: 2 kali sehari 150 ml sesudah makan.",
                'contraindications' => "Hindari pada ibu hamil, ibu menyusui, serta individu dengan hipersensitivitas aroma khas tanaman famili Piperaceae.",
                'scientific_reference' => "Acuan Sediaan Herbal BPOM RI & Farmakope Herbal Indonesia",
            ],
            // 8. Daun Tempuyung
            [
                'slugs' => ['daun_tempuyung', 'tempuyung'],
                'sci' => 'Sonchus arvensis',
                'preparation_method' => "1. Cuci bersih 5–10 lembar daun tempuyung segar.\n2. Rebus dalam 300 ml air hingga mendidih dan tersisa 150 ml, lalu saring.",
                'dosage_notes' => "Dewasa: 2 kali sehari masing-masing 150 ml sesudah makan, disertai minum air putih yang cukup.",
                'contraindications' => "Tidak dianjurkan untuk ibu hamil, ibu menyusui, serta penderita gagal ginjal dengan retensi cairan.",
                'scientific_reference' => "FROTI Kemenkes RI (2016) & Acuan Sediaan Herbal BPOM RI",
            ],
            // 9. Jeruk Nipis
            [
                'slugs' => ['jeruk_nipis', 'buah_jeruk_nipis'],
                'sci' => 'Citrus aurantiifolia',
                'preparation_method' => "1. Sari buah: peras 1 buah jeruk nipis segar ke dalam 150–200 ml air hangat, dapat ditambah 1 sendok teh madu murni.\n2. Daun: seduh 5 lembar daun jeruk nipis yang diiris tipis dengan 200 ml air panas selama 10 menit, lalu saring.",
                'dosage_notes' => "Dewasa: 1–2 kali sehari 150 ml sesudah makan.",
                'contraindications' => "Hindari minum saat perut kosong pada penderita maag akut atau refluks asam lambung (GERD). Bilas mulut dengan air putih setelah minum untuk melindungi email gigi.",
                'scientific_reference' => "FROTI Kemenkes RI (2016) & Acuan Sediaan Herbal BPOM RI",
            ],
            // 10. Bunga Seribu Bintang
            [
                'slugs' => ['bunga_seribu_bintang'],
                'sci' => 'Melampodium divaricatum',
                'preparation_method' => "TIDAK UNTUK KONSUMSI RUTIN. Spesimen ini merupakan tanaman hias lanskap dan belum memiliki monograf standar pengolahan pangan maupun obat tradisional internal.",
                'dosage_notes' => "Tidak ada dosis konsumsi yang direkomendasikan.",
                'contraindications' => "Hindari konsumsi bagian tanaman liar/hias tanpa validasi etnofarmakologi dan keamanan toksikologi.",
                'scientific_reference' => "Katalog Keamanan Tanaman Hias & Etnobotani Tropis",
            ],
            // 11. Binahong
            [
                'slugs' => ['binahong', 'daun_binahong'],
                'sci' => 'Anredera cordifolia',
                'preparation_method' => "1. Pemakaian dalam: rebus 5–7 lembar daun binahong segar dalam 300 ml air hingga tersisa 150 ml, lalu saring.\n2. Pemakaian luar: cuci bersih 3–5 lembar daun segar, lumatkan halus, dan tempelkan pada memar atau luka gores ringan yang sudah dibersihkan.",
                'dosage_notes' => "Pemakaian dalam: 1–2 kali sehari 150 ml sesudah makan.",
                'contraindications' => "Hindari pada ibu hamil, ibu menyusui, serta penderita gangguan fungsi ginjal berat.",
                'scientific_reference' => "Acuan Sediaan Herbal BPOM RI",
            ],
            // 12. Jelatang (Beracun)
            [
                'slugs' => ['jelatang'],
                'sci' => 'Urtica dioica',
                'preparation_method' => "TIDAK UNTUK SENTUHAN ATAU KONSUMSI MENTAH. Bulu halus daun menyuntikkan asam format dan histamin. Pengolahan tradisional hanya dilakukan dengan perebusan penuh minimal 15 menit menggunakan sarung tangan pelindung.",
                'dosage_notes' => "Tidak dianjurkan untuk pengolahan mandiri rumah tangga.",
                'contraindications' => "Kontraindikasi pada ibu hamil, penderita gangguan jantung/ginjal, dan kulit sensitif. Hindari kontak kulit langsung dengan daun segar.",
                'scientific_reference' => "Monograf Keamanan Tumbuhan Beracun BPOM RI & WHO Monographs",
            ],
            // 13. Sancang (Buas-buas)
            [
                'slugs' => ['buas_buas', 'sancang'],
                'sci' => 'Premna serratifolia',
                'preparation_method' => "1. Cuci bersih 5–7 lembar daun buas-buas muda segar.\n2. Rebus dalam 300 ml air hingga tersisa 150 ml lalu saring, atau seduh dalam 200 ml air mendidih selama 10 menit.",
                'dosage_notes' => "Dewasa: 1–2 kali sehari 150 ml sesudah makan.",
                'contraindications' => "Tidak dianjurkan untuk ibu hamil dan menyusui; hindari daun dari tanaman bonsai yang diberi pupuk kimia atau pestisida sistemik.",
                'scientific_reference' => "Inventaris Tumbuhan Obat Indonesia Kemenkes RI & Kajian Etnofarmakologi",
            ],
            // 14. Selada Liar (Beracun)
            [
                'slugs' => ['selada_liar'],
                'sci' => 'Lactuca virosa',
                'preparation_method' => "TIDAK UNTUK DIKONSUMSI. Getah putihnya mengandung seskuiterpen lakton (laktukarium) yang dapat memicu keracunan sistem saraf, pusing berat, dan gangguan pernapasan.",
                'dosage_notes' => "Tidak ada dosis aman untuk konsumsi mandiri.",
                'contraindications' => "Kontraindikasi mutlak untuk seluruh kelompok usia (anak-anak, dewasa, ibu hamil, dan menyusui).",
                'scientific_reference' => "Monograf Keamanan Tumbuhan Beracun BPOM RI",
            ],
            // 15. Patikan Kebo
            [
                'slugs' => ['patikan_kebo'],
                'sci' => 'Euphorbia hirta',
                'preparation_method' => "1. Cuci bersih 5–10 gram herba patikan kebo kering (atau 10–15 gram segar) hingga getah permukaan bersih.\n2. Rebus dalam 300 ml air hingga tersisa 150 ml, lalu saring.",
                'dosage_notes' => "Dewasa: 1–2 kali sehari 150 ml sesudah makan (maksimal pemakaian 7 hari).",
                'contraindications' => "Dilarang pada ibu hamil, ibu menyusui, dan anak-anak. Hindari terkena getah putih pada mata atau luka terbuka karena bersifat iritan.",
                'scientific_reference' => "Acuan Sediaan Herbal BPOM RI & WHO Monographs",
            ],
            // 16. Anting-Anting
            [
                'slugs' => ['anting_anting'],
                'sci' => 'Acalypha indica',
                'preparation_method' => "1. Pemakaian luar: lumatkan herba segar bersih untuk kompres area kulit gatal ringan.\n2. Pemakaian dalam tradisional: rebus 5–7 gram herba kering dalam 300 ml air hingga tersisa 150 ml, lalu saring.",
                'dosage_notes' => "Dewasa: 1 kali sehari 150 ml sesudah makan (jangka pendek).",
                'contraindications' => "Kontraindikasi mutlak pada penderita defisiensi enzim G6PD (berisiko memicu anemia hemolitik), ibu hamil, dan ibu menyusui.",
                'scientific_reference' => "Inventaris Tumbuhan Obat Indonesia Kemenkes RI & Kajian Toksikologi Fitokimia",
            ],
            // 17. Calincing Tanah
            [
                'slugs' => ['calincing_tanah'],
                'sci' => 'Oxalis barrelieri',
                'preparation_method' => "1. Cuci bersih 5–10 gram daun dan batang calincing tanah segar.\n2. Rebus singkat dalam 250 ml air hingga tersisa 150 ml, lalu saring.",
                'dosage_notes' => "Dewasa: maksimal 1 kali sehari 100–150 ml sesudah makan (tidak untuk konsumsi harian jangka panjang).",
                'contraindications' => "Mengandung asam oksalat; kontraindikasi pada penderita batu ginjal oksalat, gangguan ginjal, asam urat berat, dan tukak lambung.",
                'scientific_reference' => "Inventaris Tumbuhan Obat Indonesia Kemenkes RI",
            ],
            // 18. Ki Tolod (Beracun)
            [
                'slugs' => ['ki_tolod'],
                'sci' => 'Hippobroma longiflora',
                'preparation_method' => "TIDAK UNTUK DIKONSUMSI ATAU DITETESKAN KE MATA. Seluruh bagian tanaman mengandung alkaloid piperidin toksik (lobelin) yang menyebabkan iritasi kornea berat hingga gangguan jantung.",
                'dosage_notes' => "Tidak ada dosis aman untuk penggunaan mandiri.",
                'contraindications' => "Kontraindikasi mutlak untuk seluruh kelompok usia. Segera bilas dengan air mengalir bila getah mengenai kulit atau mata.",
                'scientific_reference' => "Monograf Keamanan Tumbuhan Beracun BPOM RI",
            ],
            // 19. Hokianti
            [
                'slugs' => ['hokianti'],
                'sci' => 'Ehretia microphylla',
                'preparation_method' => "1. Ambil 5–10 lembar daun hokianti segar yang dipastikan bebas pestisida tanaman hias, cuci bersih.\n2. Seduh dalam 200 ml air panas selama 5–10 menit sebagai teh herbal, lalu saring.",
                'dosage_notes' => "Dewasa: 1 cangkir (150 ml) per hari sesudah makan.",
                'contraindications' => "Jangan gunakan daun dari tanaman bonsai/pagar yang baru diberi pupuk kimia atau insektisida. Hindari pada ibu hamil dan menyusui.",
                'scientific_reference' => "Kajian Etnobotani Asia Tenggara & Pedoman Keamanan Herbal",
            ],
            // 20. Sidaguri Golok
            [
                'slugs' => ['sidaguri_golok', 'sidaguri'],
                'sci' => 'Sida',
                'preparation_method' => "1. Cuci bersih 5–10 gram herba atau akar sidaguri kering.\n2. Rebus dalam 300 ml air hingga tersisa 150 ml, lalu saring.",
                'dosage_notes' => "Dewasa: 1–2 kali sehari 150 ml sesudah makan.",
                'contraindications' => "Tidak dianjurkan untuk ibu hamil, ibu menyusui, penderita hipertensi berat, dan anak-anak.",
                'scientific_reference' => "Acuan Sediaan Herbal BPOM RI",
            ],
            // 21. Cherry Vietnam
            [
                'slugs' => ['cherry_vietnam'],
                'sci' => 'Malpighia glabra',
                'preparation_method' => "1. Buah matang: cuci bersih 3–5 butir buah ceri yang matang sempurna, konsumsi segar atau haluskan dengan 150 ml air matang.\n2. Bagian daun umumnya untuk tanaman hias/bonsai dan tidak direkomendasikan untuk seduhan rutin.",
                'dosage_notes' => "Dewasa: 3–5 butir buah matang per hari.",
                'contraindications' => "Hindari mengonsumsi buah dari tanaman hias pot yang diberi pestisida sistemik; hati-hati pada penderita batu ginjal oksalat.",
                'scientific_reference' => "Kajian Fitokimia & Pangan Fungsional Tropis",
            ],
            // 22. Namnam
            [
                'slugs' => ['namnam'],
                'sci' => 'Cynometra cauliflora',
                'preparation_method' => "1. Buah matang: kupas kulit buah namnam yang sudah matang kekuningan, cuci bersih, konsumsi segar atau olah sebagai campuran rujak/manisan.\n2. Daun muda: rebus 3–5 lembar daun muda dalam 250 ml air hingga tersisa 150 ml, lalu saring.",
                'dosage_notes' => "Dewasa: 1–2 buah matang per hari, atau maksimal 1 kali sehari 150 ml air rebusan daun.",
                'contraindications' => "Hindari konsumsi buah mentah dalam jumlah banyak pada penderita maag/GERD karena tingkat keasamannya tinggi.",
                'scientific_reference' => "Inventaris Tumbuhan Obat Indonesia Kemenkes RI",
            ],
            // 23. Kembang Sepatu Tidur
            [
                'slugs' => ['kembang_sepatu_tidur'],
                'sci' => 'Malvaviscus arboreus',
                'preparation_method' => "1. Ambil 3–5 kuntum bunga segar yang bersih dan bebas pestisida, bilas dengan air matang.\n2. Seduh dalam 200 ml air panas selama 5–7 menit, lalu saring.",
                'dosage_notes' => "Dewasa: 1 cangkir (150 ml) per hari.",
                'contraindications' => "Hindari pada ibu hamil, ibu menyusui, dan pastikan tanaman tidak disemprot pestisida taman.",
                'scientific_reference' => "Kajian Etnobotani Malvaceae Tropis",
            ],
            // 24. Pohon Loa
            [
                'slugs' => ['pohon_loa', 'loa'],
                'sci' => 'Ficus racemosa',
                'preparation_method' => "1. Cuci bersih 3–5 lembar daun loa segar hingga tidak ada sisa getah menempel.\n2. Rebus dalam 300 ml air hingga tersisa 150 ml, lalu saring.",
                'dosage_notes' => "Dewasa: 1 kali sehari 150 ml sesudah makan.",
                'contraindications' => "Getah putih pada batang dan tangkai bersifat iritan; tidak dianjurkan untuk ibu hamil, menyusui, dan anak-anak.",
                'scientific_reference' => "Inventaris Tumbuhan Obat Indonesia Kemenkes RI & Monograf Ficus",
            ],
            // 25. Jati Emas
            [
                'slugs' => ['jati_emas'],
                'sci' => 'Cordia subcordata',
                'preparation_method' => "1. Utamakan pemakaian luar: cuci bersih 2–3 lembar daun segar, layukan di atas uap air hangat, lalu tempelkan sebagai kompres otot pegal.\n2. Tidak dianjurkan untuk konsumsi rutin jangka panjang.",
                'dosage_notes' => "Pemakaian luar: 1–2 kali sehari selama 15–20 menit.",
                'contraindications' => "Hindari konsumsi internal tanpa pengawasan ahli etnofarmakologi; tidak untuk ibu hamil dan anak-anak.",
                'scientific_reference' => "Kajian Etnobotani Tumbuhan Pesisir Tropis",
            ],
            // 26. Amarilis (Beracun)
            [
                'slugs' => ['amarilis'],
                'sci' => 'Hippeastrum reticulatum',
                'preparation_method' => "TIDAK UNTUK DIKONSUMSI. Seluruh bagian tanaman (terutama umbi) mengandung alkaloid lycorine dan kristal kalsium oksalat yang memicu muntah hebat, diare, dan gangguan saraf.",
                'dosage_notes' => "Tidak ada dosis aman; khusus tanaman hias eksterior/interior.",
                'contraindications' => "Kontraindikasi mutlak bagi manusia dan hewan peliharaan. Cuci tangan setelah memangkas daun atau memindahkan umbi.",
                'scientific_reference' => "Monograf Keamanan Tumbuhan Beracun BPOM RI",
            ],
            // 27. Pucuk Merah
            [
                'slugs' => ['pucuk_merah'],
                'sci' => 'Syzygium myrtifolium',
                'preparation_method' => "1. Bilas 3–5 pucuk daun muda berwarna merah yang dipastikan tumbuh di area bersih dan bebas pestisida.\n2. Seduh dalam 200 ml air panas selama 5–7 menit, lalu saring.",
                'dosage_notes' => "Dewasa: maksimal 1 cangkir (150 ml) per hari.",
                'contraindications' => "Dilarang memetik daun dari tanaman pagar pinggir jalan raya karena akumulasi timbal/polutan dan residu pestisida.",
                'scientific_reference' => "Kajian Fitokimia Myrtaceae Indonesia",
            ],
            // 28. Awar-awar (Beracun)
            [
                'slugs' => ['awar_awar'],
                'sci' => 'Ficus septica',
                'preparation_method' => "TIDAK UNTUK DIKONSUMSI MANDIRI. Getah dan daun mengandung alkaloid fenantroindolizidin (tylophorine) yang bersifat emetik kuat (memicu muntah) dan iritan mukosa.",
                'dosage_notes' => "Tidak ada dosis aman untuk konsumsi rumah tangga.",
                'contraindications' => "Kontraindikasi mutlak untuk konsumsi oral, ibu hamil, menyusui, dan anak-anak. Hindari kontak getah putih dengan mata dan kulit sensitif.",
                'scientific_reference' => "Monograf Keamanan Tumbuhan Beracun BPOM RI",
            ],
            // 29. Janda Bolong (Beracun)
            [
                'slugs' => ['janda_bolong'],
                'sci' => 'Monstera adansonii',
                'preparation_method' => "TIDAK UNTUK DIKONSUMSI. Jaringan daun dan batangnya mengandung kristal kalsium oksalat berbentuk jarum (rafida) yang melukai mukosa mulut dan tenggorokan.",
                'dosage_notes' => "Tidak ada dosis aman; murni tanaman hias.",
                'contraindications' => "Kontraindikasi mutlak bagi manusia dan hewan peliharaan (kucing/anjing).",
                'scientific_reference' => "Monograf Keamanan Tumbuhan Beracun BPOM RI",
            ],
            // 30. Belimbing Wuluh
            [
                'slugs' => ['belimbing_wuluh', 'buah_belimbing_wuluh'],
                'sci' => 'Averrhoa bilimbi',
                'preparation_method' => "1. Cuci bersih 3–5 buah belimbing wuluh segar (atau 7–10 lembar daun segar).\n2. Rebus dalam 250 ml air hingga tersisa 150 ml, lalu saring.",
                'dosage_notes' => "Dewasa: 1–2 kali sehari 150 ml sesudah makan.",
                'contraindications' => "Kontraindikasi mutlak bagi penderita batu ginjal oksalat, gagal ginjal (kandungan asam oksalat tinggi), dan tukak lambung/GERD berat.",
                'scientific_reference' => "FROTI Kemenkes RI (2016) & Acuan Sediaan Herbal BPOM RI",
            ],
            // 31. Daun Teh
            [
                'slugs' => ['daun_teh', 'teh'],
                'sci' => 'Camellia sinensis',
                'preparation_method' => "1. Ambil 2–3 gram (±1 sendok teh) pucuk daun teh hijau/kering bersih.\n2. Seduh dengan 200 ml air panas bersuhu ±80°C selama 3–5 menit, lalu saring (hindari merebus daun teh terlalu lama agar tidak terlalu sepat).",
                'dosage_notes' => "Dewasa: 1–2 cangkir (150–200 ml) per hari, beri jeda minimal 1–2 jam setelah makan utama.",
                'contraindications' => "Mengandung kafein dan tanin; batasi pada penderita insomnia, GERD berat, anemia defisiensi besi (tanin menghambat penyerapan zat besi), dan ibu hamil.",
                'scientific_reference' => "Farmakope Herbal Indonesia & WHO Monographs on Selected Medicinal Plants",
            ],
            // 32. Jambu Biji
            [
                'slugs' => ['jambu_biji', 'daun_jambu_biji'],
                'sci' => 'Psidium guajava',
                'preparation_method' => "1. Ambil 5–9 lembar pucuk daun jambu biji muda segar, cuci bersih dengan air mengalir.\n2. Rebus dalam 300 ml air selama 15 menit hingga air tersisa 150 ml, lalu saring.",
                'dosage_notes' => "Dewasa: 2 kali sehari masing-masing 150 ml hingga frekuensi buang air besar membaik (maksimal 3 hari; segera ke dokter bila diare disertai demam atau darah).",
                'contraindications' => "Kontraindikasi pada penderita konstipasi (sembelit) kronis dan obstruksi saluran cerna.",
                'scientific_reference' => "FROTI Kemenkes RI (2016) & Monograf Ekstrak Tumbuhan Obat Indonesia BPOM RI",
            ],
            // 33. Kemangi
            [
                'slugs' => ['kemangi', 'daun_kemangi'],
                'sci' => 'Ocimum basilicum',
                'preparation_method' => "1. Cuci bersih 10–20 gram daun dan pucuk kemangi segar dengan air matang.\n2. Konsumsi segar sebagai lalapan bersih atau seduh dalam 200 ml air panas selama 5 menit, lalu saring.",
                'dosage_notes' => "Dewasa: 1–2 porsi lalapan segar atau 1–2 cangkir seduhan per hari.",
                'contraindications' => "Hindari penggunaan ekstrak atau minyak atsiri kemangi pekat pada ibu hamil, ibu menyusui, dan anak-anak.",
                'scientific_reference' => "FROTI Kemenkes RI (2016) & Acuan Sediaan Herbal BPOM RI",
            ],
            // 34. Lidah Buaya
            [
                'slugs' => ['lidah_buaya', 'aloe_vera'],
                'sci' => 'Aloe vera',
                'preparation_method' => "1. Pemakaian luar: belah daun lidah buaya segar, ambil gel bening di bagian dalam, oleskan tipis pada kulit iritasi.\n2. Pemakaian dalam: kupas kulit hijau dan cuci bersih gel bening (30–50 gram) di bawah air mengalir hingga getah kuning hilang sempurna, lalu rebus sebentar dalam 200 ml air.",
                'dosage_notes' => "Luar: oleskan 2–3 kali sehari. Dalam: maksimal 1 kali sehari 30–50 gram daging gel bebas getah kuning.",
                'contraindications' => "Getah kuning (lateks/aloin) di bawah kulit daun bersifat pencahar kuat dan kontraindikasi mutlak bagi ibu hamil, menyusui, penderita radang usus, serta gangguan ginjal.",
                'scientific_reference' => "FROTI Kemenkes RI (2016) & WHO Monographs on Selected Medicinal Plants",
            ],
            // 35. Nangka
            [
                'slugs' => ['nangka', 'daun_nangka'],
                'sci' => 'Artocarpus heterophyllus',
                'preparation_method' => "1. Cuci bersih 3–5 lembar daun nangka tua segar hingga getahnya hilang.\n2. Rebus dalam 300 ml air dengan api kecil hingga tersisa 150 ml, lalu saring.",
                'dosage_notes' => "Dewasa: 1 kali sehari 150 ml sesudah makan.",
                'contraindications' => "Pantau kadar gula darah secara berkala bila dikonsumsi bersamaan dengan obat antidiabetes medis untuk mencegah hipoglikemia; hindari pada ibu hamil.",
                'scientific_reference' => "Acuan Sediaan Herbal BPOM RI & Kajian Etnofarmakologi Indonesia",
            ],
            // 36. Pandan Wangi
            [
                'slugs' => ['pandan', 'pandan_wangi', 'daun_pandan'],
                'sci' => 'Pandanus amaryllifolius',
                'preparation_method' => "1. Cuci bersih 2–3 lembar daun pandan wangi segar, potong dan simpulkan.\n2. Rebus dalam 300 ml air selama 10–15 menit hingga harum, lalu saring.",
                'dosage_notes' => "Dewasa: 1–2 cangkir (150–200 ml) per hari.",
                'contraindications' => "Umumnya aman dalam takaran herbal wajar; hentikan bila muncul reaksi alergi individual.",
                'scientific_reference' => "FROTI Kemenkes RI (2016) & Acuan Sediaan Herbal BPOM RI",
            ],
            // 37. Seledri
            [
                'slugs' => ['seledri', 'daun_seledri'],
                'sci' => 'Apium graveolens',
                'preparation_method' => "1. Cuci bersih 15–20 gram daun dan tangkai seledri segar.\n2. Rebus dalam 250 ml air hingga tersisa 150 ml, atau haluskan dengan 150 ml air matang lalu saring.",
                'dosage_notes' => "Dewasa: 1–2 kali sehari 150 ml sesudah makan.",
                'contraindications' => "Kontraindikasi pada ibu hamil (berisiko stimulasi uterus), penderita hipotensi, gangguan ginjal akut, dan alergi famili Apiaceae.",
                'scientific_reference' => "FROTI Kemenkes RI (2016) & Acuan Sediaan Herbal BPOM RI",
            ],
            // 38. Sirih Hijau
            [
                'slugs' => ['sirih', 'daun_sirih', 'sirih_hijau'],
                'sci' => 'Piper betle',
                'preparation_method' => "1. Pemakaian luar / obat kumur: rebus 3–5 lembar daun sirih segar dalam 300 ml air selama 10 menit, dinginkan hingga hangat, lalu saring.\n2. Pemakaian dalam: seduh 2–3 lembar daun dalam 200 ml air panas selama 10 menit, lalu saring.",
                'dosage_notes' => "Kumur/basuh luar: 2 kali sehari. Konsumsi dalam: maksimal 1 gelas (150 ml) per hari dan tidak untuk jangka panjang.",
                'contraindications' => "Hindari menelan air kumur. Tidak dianjurkan mengunyah sirih bersama pinang dan kapur secara kronis karena risiko iritasi mukosa mulut.",
                'scientific_reference' => "FROTI Kemenkes RI (2016) & Farmakope Herbal Indonesia",
            ],
        ];

        $updatedIds = [];

        foreach ($monographs as $item) {
            $matches = Herbal::whereIn('slug', $item['slugs'])
                ->orWhere('scientific_name', 'LIKE', $item['sci'] . '%')
                ->get();

            foreach ($matches as $herbal) {
                $herbal->update([
                    'preparation_method' => $item['preparation_method'],
                    'dosage_notes' => $item['dosage_notes'],
                    'contraindications' => $item['contraindications'],
                    'scientific_reference' => $item['scientific_reference'],
                ]);
                $updatedIds[$herbal->id] = true;
            }
        }

        $total = Herbal::count();
        $matchedCount = count($updatedIds);
        $this->command?->info("Berhasil memperbarui {$matchedCount} dari {$total} tanaman di database secara non-destructive.");
    }
}
