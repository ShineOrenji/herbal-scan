<p align="center"><a href="https://laravel.com" target="_blank"><img src="https://raw.githubusercontent.com/laravel/art/master/logo-lockup/5%20SVG/2%20CMYK/1%20Full%20Color/laravel-logolockup-cmyk-red.svg" width="400" alt="Laravel Logo"></a></p>

<p align="center">
<a href="https://github.com/laravel/framework/actions"><img src="https://github.com/laravel/framework/workflows/tests/badge.svg" alt="Build Status"></a>
<a href="https://packagist.org/packages/laravel/framework"><img src="https://img.shields.io/packagist/dt/laravel/framework" alt="Total Downloads"></a>
<a href="https://packagist.org/packages/laravel/framework"><img src="https://img.shields.io/packagist/v/laravel/framework" alt="Latest Stable Version"></a>
<a href="https://packagist.org/packages/laravel/framework"><img src="https://img.shields.io/packagist/l/laravel/framework" alt="License"></a>
</p>

## About Laravel

Laravel is a web application framework with expressive, elegant syntax. We believe development must be an enjoyable and creative experience to be truly fulfilling. Laravel takes the pain out of development by easing common tasks used in many web projects, such as:

- [Simple, fast routing engine](https://laravel.com/docs/routing).
- [Powerful dependency injection container](https://laravel.com/docs/container).
- Multiple back-ends for [session](https://laravel.com/docs/session) and [cache](https://laravel.com/docs/cache) storage.
- Expressive, intuitive [database ORM](https://laravel.com/docs/eloquent).
- Database agnostic [schema migrations](https://laravel.com/docs/migrations).
- [Robust background job processing](https://laravel.com/docs/queues).
- [Real-time event broadcasting](https://laravel.com/docs/broadcasting).

Laravel is accessible, powerful, and provides tools required for large, robust applications.

## Learning Laravel

Laravel has the most extensive and thorough [documentation](https://laravel.com/docs) and video tutorial library of all modern web application frameworks, making it a breeze to get started with the framework.

In addition, [Laracasts](https://laracasts.com) contains thousands of video tutorials on a range of topics including Laravel, modern PHP, unit testing, and JavaScript. Boost your skills by digging into our comprehensive video library.

You can also watch bite-sized lessons with real-world projects on [Laravel Learn](https://laravel.com/learn), where you will be guided through building a Laravel application from scratch while learning PHP fundamentals.

## Agentic Development

Laravel's predictable structure and conventions make it ideal for AI coding agents like Claude Code, Cursor, and GitHub Copilot. Install [Laravel Boost](https://laravel.com/docs/ai) to supercharge your AI workflow:

```bash
composer require laravel/boost --dev

php artisan boost:install
```
Boost provides your agent 15+ tools and skills that help agents build Laravel applications while following best practices.

## Contributing

Thank you for considering contributing to the Laravel framework! The contribution guide can be found in the [Laravel documentation](https://laravel.com/docs/contributions).

## Code of Conduct

In order to ensure that the Laravel community is welcoming to all, please review and abide by the [Code of Conduct](https://laravel.com/docs/contributions#code-of-conduct).

## Security Vulnerabilities

If you discover a security vulnerability within Laravel, please send an e-mail to Taylor Otwell via [taylor@laravel.com](mailto:taylor@laravel.com). All security vulnerabilities will be promptly addressed.

## License

The Laravel framework is open-sourced software licensed under the [MIT license](https://opensource.org/licenses/MIT).

## MEMUNCULKAN 11 TANAMAN DEFAULT

INSERT INTO `test`.`herbals` (`id`, `slug`, `name`, `scientific_name`, `local_name`, `description`, `plant_parts_used`, `traditional_usage`, `lab_evidence`, `clinical_evidence`, `safety_warning`, `image_url`, `is_curated`, `created_at`, `updated_at`) VALUES
(1, 'belimbing_wuluh', 'Belimbing Wuluh', 'Averrhoa bilimbi L.', 'Belimbing Sayur, Calincing Wuluh (Sunda), Blimbing Wuluh (Jawa)', 'Tanaman tropis yang daun dan buahnya kaya akan senyawa flavonoid, saponin, dan tanin untuk membantu meredakan peradangan serta menjaga kestabilan gula darah.', 'Daun segar, buah, dan bunga', 'Rebus 10 lembar daun belimbing wuluh segar dalam 2 gelas air hingga tersisa 1 gelas, saring, lalu minum hangat setelah makan.', 'Uji fitokimia dan in-vivo menunjukkan ekstrak etanol daun Averrhoa bilimbi memiliki aktivitas antihiperglikemik serta daya hambat antibakteri terhadap Staphylococcus aureus.', 'Studi klinis terbatas pada ekstrak daun menunjukkan potensi penurunan glukosa darah postprandial, namun masih memerlukan uji skala besar lebih lanjut.', 'Hindari konsumsi berlebihan pada penderita gangguan ginjal karena kandungan asam oksalat yang tinggi.', 'https://static.inaturalist.org/photos/136027096/medium.jpeg', 1, NOW(), NOW()),
(2, 'daun_teh', 'Daun Teh', 'Camellia sinensis (L.) Kuntze', 'Teh Hijau, Enteh (Sunda), Teh (Jawa)', 'Tanaman perdu penghasil daun aromatik yang kaya polifenol katekin (EGCG) sebagai antioksidan kuat, pelindung kardiovaskular, dan peningkat fokus.', 'Pucuk daun muda dan daun segar', 'Seduh 2–3 gram daun teh kering atau segar dengan air panas bersuhu 80°C selama 3–5 menit, minum tanpa gula berlebih.', 'Kandungan Epigallocatechin gallate (EGCG) terbukti secara in-vitro menetralkan radikal bebas dan menghambat oksidasi kolesterol LDL.', 'Meta-analisis uji klinis membuktikan konsumsi rutin Camellia sinensis membantu menurunkan tekanan darah sistolik dan memperbaiki profil lipid.', 'Mengandung kafein; batasi konsumsi pada penderita GERD, insomnia, atau sensitivitas kafein.', 'https://inaturalist-open-data.s3.amazonaws.com/photos/3431826/medium.jpeg', 1, NOW(), NOW()),
(3, 'jambu_biji', 'Jambu Biji', 'Psidium guajava L.', 'Jambu Klutuk, Jambu Batu (Sunda), Jambu Krutuk (Jawa)', 'Daun jambu biji dikenal luas sebagai antidiare alami dan pendukung pemulihan trombosit berkat tingginya kadar kuersetin dan tanin.', 'Pucuk daun muda dan buah', 'Cuci bersih 5–7 lembar daun jambu biji muda, rebus dengan 300 ml air selama 10 menit, lalu minum air rebusannya 2 kali sehari.', 'Kuersetin pada ekstrak daun Psidium guajava terbukti menghambat motilitas berlebih pada otot polos usus serta menekan aktivitas bakteri penyebab diare.', 'Uji klinis acak menunjukkan ekstrak daun jambu biji mempercepat pemulihan gejala diare akut non-spesifik dan membantu menjaga jumlah trombosit.', 'Konsumsi berlebihan dapat memicu konstipasi (sembelit) akibat kandungan tanin yang tinggi.', 'https://inaturalist-open-data.s3.amazonaws.com/photos/751951189/medium.jpg', 1, NOW(), NOW()),
(4, 'jeruk_nipis', 'Jeruk Nipis', 'Citrus aurantiifolia (Christm.) Swingle', 'Jeruk Pecel, Jeruk Tipis (Sunda), Jeruk Dlingo', 'Daun dan buah jeruk nipis mengandung minyak atsiri limonene, sitral, dan flavonoid yang berperan sebagai antimikroba, antioksidan, dan pelega tenggorokan.', 'Daun segar dan sari buah', 'Seduh 5 lembar daun jeruk nipis yang diiris tipis dengan air panas selama 10 menit, tambahkan madu murni secukupnya.', 'Minyak atsiri daun Citrus aurantiifolia menunjukkan zona hambat signifikan terhadap bakteri penyebab infeksi saluran pernapasan atas.', 'Kombinasi senyawa flavonoid dan vitamin C mendukung fungsi imun mukosa dan meredakan batuk ringan.', 'Sifat asamnya dapat mengiritasi lambung jika dikonsumsi dalam keadaan perut kosong pada penderita maag.', 'https://inaturalist-open-data.s3.amazonaws.com/photos/616796590/original.jpg', 1, NOW(), NOW()),
(5, 'kemangi', 'Kemangi', 'Ocimum basilicum L.', 'Surawung (Sunda), Kemangi (Jawa), Ruku-ruku', 'Terna aromatik dengan kandungan eugenol dan linalool tinggi yang berfungsi sebagai antiinflamasi, antibakteri, serta pelindung mukosa lambung.', 'Daun dan pucuk batang muda', 'Konsumsi langsung sebagai lalapan segar yang telah dicuci bersih atau seduh segenggam daun kemangi sebagai teh herbal.', 'Ekstrak daun Ocimum basilicum terbukti menurunkan stres oksidatif dan menghambat mediator inflamasi siklooksigenase (COX-2).', 'Studi klinis menunjukkan ekstrak kemangi memiliki efek adaptogenik ringan dan mendukung kesehatan saluran pencernaan.', 'Kandungan estragole pada minyak atsiri murni tidak dianjurkan dikonsumsi dalam dosis pekat jangka panjang oleh ibu hamil.', 'https://inaturalist-open-data.s3.amazonaws.com/photos/154769884/medium.jpg', 1, NOW(), NOW()),
(6, 'lidah_buaya', 'Lidah Buaya', 'Aloe vera (L.) Burm.f.', 'Aloe Vera, Letah Buaya (Sunda), Ilat Boyo (Jawa)', 'Tanaman sukulen dengan gel kaya polisakarida acemannan yang efektif mempercepat penyembuhan luka bakar ringan, iritasi kulit, dan menjaga kelembapan.', 'Gel daging daun bagian dalam', 'Kupas kulit hijau daun lidah buaya, bilas getah kuningnya hingga bersih, lalu oleskan gel bening langsung pada area kulit yang iritasi.', 'Polisakarida acemannan pada Aloe vera terbukti merangsang proliferasi fibroblas dan sintesis kolagen secara in-vitro maupun in-vivo.', 'Berbagai uji klinis mengonfirmasi gel lidah buaya topikal mempercepat epitelisasi luka bakar derajat satu dan dua dibanding plasebo.', 'Pastikan getah kuning (lateks/aloin) di bawah kulit daun dicuci bersih sebelum digunakan karena dapat mengiritasi kulit atau memicu efek pencahar keras.', 'https://inaturalist-open-data.s3.amazonaws.com/photos/759770213/medium.jpg', 1, NOW(), NOW()),
(7, 'nangka', 'Nangka', 'Artocarpus heterophyllus Lam.', 'Nangka (Sunda/Jawa), Sibodak, Lamasa', 'Daun nangka mengandung prenilflavonoid dan saponin yang berpotensi membantu regulasi kadar glukosa darah serta mempercepat penyembuhan luka luar.', 'Daun tua segar', 'Rebus 5 lembar daun nangka yang sudah tua dengan 2 gelas air hingga mendidih dan tersisa 1 gelas, minum selagi hangat.', 'Ekstrak daun Artocarpus heterophyllus menunjukkan aktivitas penghambatan enzim alfa-amilase dan peningkatan toleransi glukosa pada model uji.', 'Evaluasi klinis awal menunjukkan efek hipoglikemik ringan pada pasien diabetes tipe 2 sebagai terapi pendamping.', 'Pantau kadar gula darah secara berkala jika dikonsumsi bersamaan dengan obat antidiabetes medis untuk mencegah hipoglikemia.', 'https://inaturalist-open-data.s3.amazonaws.com/photos/332097864/medium.jpeg', 1, NOW(), NOW()),
(8, 'pandan', 'Pandan Wangi', 'Pandanus amaryllifolius Roxb.', 'Pandan Wangi, Pandan Rampe (Sunda), Pandan Seungit', 'Daun aromatik yang mengandung alkaloid pandamarilactone, flavonoid, dan polifenol dengan efek antioksidan, penenang ringan, dan pengontrol gula darah.', 'Daun segar', 'Ikat simpul 3–4 lembar daun pandan segar, rebus dalam 400 ml air selama 15 menit hingga harum, lalu minum sebagai teh herbal.', 'Ekstrak air daun Pandanus amaryllifolius terbukti menghambat enzim alfa-glukosidase dan menangkal radikal bebas secara signifikan.', 'Studi klinis pada subjek sehat menunjukkan teh daun pandan membantu menekan lonjakan glukosa darah setelah makan.', 'Aman dikonsumsi sebagai seduhan harian dalam takaran wajar; hindari penggunaan ekstrak pekat tanpa pengawasan medis.', 'https://static.inaturalist.org/photos/237113498/medium.jpg', 1, NOW(), NOW()),
(9, 'pepaya', 'Pepaya', 'Carica papaya L.', 'Gedang (Sunda), Kates (Jawa), Betik', 'Daun pepaya kaya akan enzim proteolitik papain dan alkaloid karpain yang membantu melancarkan pencernaan serta mendukung respons imun.', 'Daun muda dan sedang', 'Haluskan 2 lembar daun pepaya segar yang telah dicuci bersih dengan sedikit air matang, peras dan saring, konsumsi maksimal 2 sendok makan per hari.', 'Senyawa karpain dan flavonoid dalam Carica papaya terbukti menstabilkan membran sel darah dan memiliki aktivitas imunomodulator.', 'Uji klinis acak terkontrol membuktikan pemberian ekstrak daun pepaya mempercepat kenaikan jumlah trombosit pada pasien demam berdarah dengue.', 'Tidak dianjurkan untuk ibu hamil karena senyawa papain konsentrasi tinggi berpotensi memicu kontraksi uterus.', 'https://static.inaturalist.org/photos/176927180/medium.jpeg', 1, NOW(), NOW()),
(10, 'seledri', 'Seledri', 'Apium graveolens L.', 'Saladri (Sunda), Sledri (Jawa), Daun Sop', 'Daun dan tangkai seledri mengandung apigenin dan 3-n-butylphthalide (3nB) yang bekerja sebagai vasodilator alami untuk membantu menurunkan hipertensi ringan.', 'Daun dan batang segar', 'Blender 50 gram daun dan batang seledri segar dengan 200 ml air matang, saring, dan minum 1 kali sehari secara teratur.', 'Senyawa 3-n-butylphthalide pada Apium graveolens terbukti merelaksasi otot polos dinding pembuluh darah dan meningkatkan ekskresi natrium.', 'Uji klinis pada penderita hipertensi ringan hingga sedang menunjukkan penurunan bermakna pada tekanan darah sistolik dan diastolik.', 'Hati-hati pada penderita hipotensi (tekanan darah rendah) dan gangguan ginjal berat karena efek diuretiknya.', 'https://inaturalist-open-data.s3.amazonaws.com/photos/5647843/medium.jpeg', 1, NOW(), NOW()),
(11, 'sirih', 'Sirih Hijau', 'Piper betle L.', 'Seureuh (Sunda), Suruh (Jawa), Sirih', 'Tanaman merambat dengan daun kaya minyak atsiri kavikol dan hidroksikavikol yang memiliki sifat antiseptik, antijamur, dan antimikroba spektrum luas.', 'Daun segar', 'Rebus 5 lembar daun sirih segar dalam 300 ml air hingga mendidih, dinginkan hingga hangat, lalu gunakan sebagai obat kumur atau pembersih luar.', 'Hidroksikavikol dan eugenol pada Piper betle terbukti efektif menghambat pertumbuhan bakteri rongga mulut Streptococcus mutans dan jamur Candida albicans.', 'Uji klinis obat kumur ekstrak daun sirih menunjukkan efektivitas sebanding dengan klorheksidin dalam mengurangi plak gigi dan gingivitis ringan.', 'Utamakan penggunaan luar atau sebagai obat kumur; hindari mengunyah sirih bersama pinang dan kapur secara kronis karena risiko iritasi mukosa mulut.', 'https://inaturalist-open-data.s3.amazonaws.com/photos/165347055/medium.jpeg', 1, NOW(), NOW());
