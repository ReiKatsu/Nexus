# NEXUS — backup dan pemulihan

Status 18 Oktober 2026: **pemulihan backup lengkap belum diverifikasi**.
Tidak ada restore, perubahan paket, atau perubahan data produksi pada pekerjaan
panel admin ini. Akun aplikasi ADMIN berbeda dari akses operator Supabase.

## Data yang perlu dicadangkan

| Sumber | Isi | Catatan |
| --- | --- | --- |
| GitHub | Code, konfigurasi nonrahasia, migration | Tidak menyimpan data database dan file pengguna |
| Database Supabase | Data aplikasi, relasi, aturan akses, serta cakupan Auth sesuai metode backup | Periksa apa yang benar-benar tercakup pada backup/export yang dipilih |
| Supabase Storage | Avatar, dokumen lomba, sertifikat hasil, sertifikat prestasi | Backup database hanya memuat metadata Storage, bukan isi file |
| Konfigurasi layanan | Domain, Auth redirect, bucket/access settings, daftar env yang diperlukan | Rahasia disimpan di tempat terbatas; jangan dimasukkan ke repo atau laporan |

## Prosedur operator

1. Periksa menu Database → Backups dan metode backup yang tersedia pada paket
   Supabase project existing. Jika mengandalkan export CLI, ikuti dokumentasi
   `db dump` terbaru dan periksa cakupan schema, data, serta roles/Auth.
2. Catat waktu backup, metode, cakupan, lokasi penyimpanan terbatas, dan pemeriksa.
   Simpan cadangan di luar project asal. Jangan commit dump database ke GitHub.
3. Salin isi bucket Storage melalui akses operator yang sah; pertahankan nama
   bucket dan path object agar referensi database cocok. Cadangkan metadata yang
   diperlukan sesuai metode yang dipilih.
4. Pulihkan ke lingkungan terpisah yang memang disiapkan untuk latihan. Pastikan
   koneksi menunjuk ke tujuan uji, dan pengiriman email/job terjadwal tidak
   memengaruhi pengguna produksi. Jangan memakai tombol restore produksi untuk latihan.
5. Periksa tabel/relasi dan jumlah data penting; sampling Mission, Squad, profil,
   ledger XP, status pengajuan, serta file yang dirujuk. Cocokkan hasil dengan
   inventaris dari waktu backup, bukan kondisi produksi yang sudah berubah.
6. Uji akses login, role/RLS, dan pembacaan bukti pada hasil pemulihan sesuai
   cakupan metode backup. Pastikan file yang dirujuk benar-benar dapat dibuka.
7. Catat expected/actual, kendala, dan lokasi bukti. Hanya tandai PASS jika salinan
   dapat dipulihkan dan cakupan database/file/konfigurasi telah dinyatakan jelas.

## Catatan verifikasi

| Pemeriksaan | Status |
| --- | --- |
| Metode dan cakupan backup project dikonfirmasi | Belum |
| Salinan database tersedia dan dapat dibaca | Belum diverifikasi |
| Salinan isi Storage sesuai path referensi | Belum diverifikasi |
| Pemulihan ke lingkungan terpisah | Belum |
| Pemeriksaan data, file, dan akses setelah pemulihan | Belum |

Rujukan operator: [Supabase Backups](https://supabase.com/docs/guides/platform/backups),
[Supabase CLI db dump](https://supabase.com/docs/reference/cli/supabase-db-dump).
