# NEXUS — rencana rilis dan hasil sesi 12 Oktober 2026

Target terbaru: **backend siap integrasi pada 18 Oktober**. Rilis aplikasi lengkap tanggal 18 masih bersyarat karena jadwal frontend belum pasti; 19–20 Oktober adalah cadangan. Tidak ada pekerjaan otomatis di luar sesi yang berjalan.

Baseline review: main `2245ac5bde38f45921019e369c7fe65df4a946de`; frontend PR #29 `5d778633f748cc90e797409a8fcc53310246e365`. Scope mengikuti Unified PRD dan keputusan pengguna terbaru. Handbook REV6/Database Spec adalah referensi awal; Admin Intervention tetap ditunda, Achievement Title Badge/PDF reward bukan scope rilis ini.

## Hasil sesi ini

| Pekerjaan | Hasil dan batas bukti |
|---|---|
| Backlog dan PR | Main belum berubah; PR #28–#31 masih open. Review tidak melakukan merge. |
| Jadwal badge | PASS: job mingguan benar-benar berjalan 12 Oktober 00.00 WIB, status succeeded; 9 badge tercatat selama run. Total 22 badge, XP tetap 1.115. |
| Cakupan badge saat diperiksa | 6 calon reward Fakultas, 6 Prodi, 3 Universitas semuanya memiliki badge yang sesuai. Ini pemeriksaan coverage saat ini, bukan perubahan kebijakan badge historis. |
| Cleanup dan season worker | PASS: cleanup 12 Oktober 02.00 WIB, season worker 09.20 WIB. Ada tepat 1 season ACTIVE dan 0 job QA tersisa. Berhasil menjalankan worker bukan bukti rollover Juli sungguhan. |
| Hak tabel dari PR #31 | Pemeriksaan ulang efektif ACL/RLS PASS pada user_skills dan endorsements. Tidak menjalankan TRUNCATE. |
| Mission legacy | 2 Mission, 0 batas anggota NULL, 0 batas maksimum <2. Tidak perlu backfill data saat ini; kebijakan perubahan batas untuk Mission yang punya Squad tetap G02. |
| Dashboard frontend | Query SQL/RLS Career/Season XP dan RPC leaderboard diuji dengan identitas 7 STUDENT ACTIVE: PASS. Pembacaan Squad/Mission dan hitungan anggota tidak error. Bukan tes Auth/HTTP/PostgREST/browser. |
| Bug badge profil | Respons relasi badge_definitions berupa objek dibaca sebagai array sehingga badge terpasang terlihat kosong. Reproduksi gagal pada kode lama; normalisasi objek/array memperbaikinya. Tidak mengubah pemberian atau equip badge. |
| Regresi badge | 4 tes PASS: objek, array, data/relasi kosong, query error. Filter pemilik dan is_equipped tetap diperiksa. |
| Static checks | Main + perbaikan badge: lint/build PASS. Gabungan lokal main + PR #29 + perbaikan: lint/build dan tes badge PASS. Ini bukan hasil CI atau browser login. |

Verifikasi database memakai transaksi read-only, tanpa membuat akun, seed, mengganti password, atau mengubah data pengguna. Peningkatan badge 13 → 22 berasal dari job normal yang sudah berjalan sebelum sesi, bukan SQL pengujian hari ini.

Snapshot kode untuk pemeriksaan diisolasi dari worktree sebelumnya; 164 berkas teks baseline dicocokkan terhadap hash GitHub (termasuk normalisasi newline dari connector). Favicon biner dan screenshot handoff tidak diambil. Percobaan build awal terhalang symlink node_modules di luar root Turbopack; setelah memakai direktori dependency lokal, perintah build normal lulus. Tidak ada perubahan konfigurasi build untuk menghindari pemeriksaan.

## Review PR dan urutan integrasi

| PR | Review | Tindakan berikutnya |
|---|---|---|
| [#28](https://github.com/ReiKatsu/Nexus/pull/28) — kontrak | Dokumentasi sesuai baseline; read-only flow, role, Storage dan batas testing dipisahkan | Dapat digabung setelah review owner; tentukan environment dan akun collaborator |
| [#30](https://github.com/ReiKatsu/Nexus/pull/30) — QA skill/endorsement | Laporan dan SQL cocok; UUID placeholder menahan eksekusi tak sengaja; transaksi rollback | Dapat digabung untuk menyimpan bukti; tidak menjalankan ulang tes tulis tanpa fixture |
| [#31](https://github.com/ReiKatsu/Nexus/pull/31) — privilege | Migration sudah live; ACL diperiksa ulang PASS; kode repo masih di PR | Prioritaskan sinkronisasi history migration ke main setelah review |
| [#29](https://github.com/ReiKatsu/Nexus/pull/29) — frontend | 23 berkas berubah; 18 berkas teks diperiksa, 5 screenshot tidak dibaca. Tidak mengubah handler/action/migration. Dashboard, filter Squad dan query count sesuai kolom/FK/RPC aktual. Build gabungan PASS, mergeable saat diperiksa | Masih perlu tes browser login, cookie/refresh, aggregate PostgREST, upload, chat, admin, dan responsif seluruh halaman |

Perbaikan badge berada pada halaman profil existing yang tidak disentuh PR #29. Branch teman tidak ditulis ulang. Urutan yang disarankan: kontrak → bukti QA + migration yang sudah live → perbaikan badge → frontend setelah regresi. Tidak ada klaim bahwa seluruh isi desain Canva sudah selesai hanya karena PR frontend lulus build.

## Temuan yang menghalangi rilis

1. **Dependency:** npm audit aktual: 9 package terdampak (1 critical, 8 high); dengan `--omit=dev`: 3 (Next critical, sharp high, source-map-js high). Jumlah package bukan jumlah exploit yang terbukti. Versi Next terpasang 16.3.4. Audit mengusulkan versi lebih baru; kandidat patch harus diverifikasi terhadap advisory resmi, lockfile, dan regresi. Jangan menjalankan `npm audit fix --force`: sarannya untuk eslint-config-next mencakup downgrade mayor.
2. **Database:** masih ada 2 security-definer view, 11 function dengan search_path mutable, 6 definer dapat dieksekusi anon, 22 oleh authenticated, dan leaked-password protection disabled. Sebagian definer adalah RPC/trigger yang disengaja; petakan caller dan guard sebelum mengubah izin. Jangan mematikan akses semua fungsi sekaligus.
3. **Browser/testing:** belum ada bukti sesi Auth mahasiswa/admin dan environment collaborator yang disepakati. Database tersambung tidak otomatis merupakan staging terpisah. Jangan mengklaim onboarding, upload, cookie, realtime, dan approval end-to-end PASS dari tes SQL.
4. **Identitas lama:** 4 profil STUDENT masih memakai domain lama yang tidak cocok dengan aturan mahasiswa sekarang. Perlu klasifikasi akun QA/asli dan keputusan migrasi identitas sebelum mengubah email; pengujian read berhasil tidak membuktikan semua update profil akan lolos constraint.

Referensi audit:
- [Next advisory dari npm audit](https://github.com/advisories/GHSA-vcvr-r3jv-pc5j); belum membuktikan jalur rentan dipakai aplikasi.
- [Security-definer views](https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view)
- [Mutable search_path](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable)
- [Anon definer EXECUTE](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)
- [Authenticated definer EXECUTE](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
- [Password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)

## Jadwal dan pemilik pekerjaan

| Tanggal WIB | Pemilik | Hasil yang dituju |
|---|---|---|
| 12 Okt | Backend/owner/frontend | Audit awal di atas selesai; owner menentukan environment/akun dan keputusan terbuka; frontend mengirim fitur yang siap secara bertahap |
| 13–14 Okt | Backend | Remediasi dependency dan audit akses fungsi/view/Storage dengan regresi; implementasi keputusan produk yang telah disetujui |
| 15 Okt | Bersama | Evaluasi kesiapan frontend. Jika belum siap, lanjutkan uji dengan UI existing dan atur integrasi per halaman; jangan menjanjikan tanggal rilis lengkap |
| 15–16 Okt | Backend + frontend + owner | Browser dua mahasiswa + admin: Mission → Squad → hasil → approval → XP; reject/resubmit, sesi, upload, role dan error |
| 17 Okt | Bersama | Perbaikan bug penghambat; profil/endorsement/badge/history/notifikasi; staging dan cek mobile |
| 18 Okt | Backend/owner | Target backend siap integrasi. Produksi hanya jika semua gate di bawah lulus |
| 19–20 Okt | Bersama | Cadangan integrasi/perbaikan, pemeriksaan setelah deploy |

## Keputusan owner yang diperlukan

- **G05:** saat user membuat Squad pada Mission yang sama, bagaimana lamaran PENDING ke Squad lain? Saran: otomatis CANCELLED dalam transaksi create yang sama; membutuhkan persetujuan dan tes rollback/concurrency sebelum diterapkan.
- **G06:** Ketua keluar/transfer. Saran: sebelum FINALIZED, transfer ke anggota ACTIVE sebelum Ketua boleh keluar; FINALIZED tetap terkunci. Kasus Ketua sendirian/pembubaran harus diputuskan terpisah, bukan dihapus otomatis.
- **G02:** kebijakan mengubah min/max pada Mission dengan Squad existing; saat ini tidak ada data batas kosong.
- **G08/G09/UI-G07:** aturan Skills lintas-Class, makna badge historis dibanding posisi sekarang/batas persentil, dan konteks endorsement bila pernah satu tim berkali-kali perlu dicocokkan dengan implementasi sebelum mengubah perilaku. Penambahan fitur di luar scope tetap ditunda.
- **Testing:** tetapkan akun dua STUDENT dan satu ADMIN yang khusus uji, environment, serta izin/cleanup fixture. Jangan kirim service_role/secret key; jangan mengganti kredensial akun personal demi testing.

## Gate sebelum deploy

- [ ] Semua perubahan rilis direview dan tergabung pada satu commit kandidat; migration repo sama dengan yang diterapkan.
- [ ] Dependency dan temuan keamanan penghambat sudah diperbaiki atau dinilai dengan bukti dampak; tidak ada bypass akses kritis.
- [ ] Alur utama browser, error/role, Storage, chat dan refresh lulus pada environment yang dinyatakan.
- [ ] Keputusan produk yang memblokir alur rilis selesai; data legacy tidak menyebabkan kegagalan normal.
- [ ] Konfigurasi env, Auth redirect, akses domain/deployment, log, backup dan langkah pemulihan diperiksa.
- [ ] Lint/build/regresi kandidat lulus; data uji dibersihkan; owner menyetujui deploy produksi konkret.

Perkiraan sebelumnya 85% implementasi/70% kesiapan adalah estimasi perencanaan, bukan rasio acceptance test. Tidak dinaikkan pada sesi ini: browser belum terverifikasi dan audit menemukan pekerjaan keamanan tambahan.

## Menjalankan ulang pemeriksaan

- `node --test tests/profile-equipped-badge.test.mjs` — page regression dengan respons sintetis berbentuk API.
- `npm run lint` dan `npm run build` — static checks.
- `supabase/tests/operations_readiness_readonly.sql` — owner SQL Editor, metadata job/coverage saat ini; missing badge di antara jadwal mingguan bisa wajar.
- `supabase/tests/dashboard_reads_runtime_readonly.sql` — owner SQL Editor, SQL/RLS per STUDENT existing; bukan login/password atau REST/browser test.

Jangan menjalankan tes approval/season yang mengubah data di database bersama tanpa fixture terkontrol. Simulasi concurrency rollover yang benar-benar COMMIT tetap harus memakai lingkungan terisolasi.
