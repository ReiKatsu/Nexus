# Penilaian melalui riwayat Squad — 15 Oktober 2026

Owner meminta akses rekan tanpa harus mencari lewat Leaderboard. Entry utama kini
My Squad → Riwayat Squad selesai → Nilai rekan → pilih nama rekan.
Leaderboard/profil umum tetap dapat digunakan; ranking bukan syarat eligibility.

## Perilaku dan akses

- Link hanya pada kartu history MISSION_COMPLETED, termasuk membership historis.
- Route `/squads/[squadId]/endorsements` memverifikasi sesi, STUDENT ACTIVE,
  onboarding, membership user dan status completed sebelum membaca daftar rekan.
- Nama rekan dibaca sekaligus dari public_profiles; tidak memakai email/NIM,
  mengabaikan duplikasi membership dan mengecualikan user sendiri.
- Daftar menampilkan sudah/belum dinilai atau penilaian ditutup, beserta batas WIB.
- Profil menerima `?squad=UUID` yang cocok dengan shared Squad eligible existing.
  Form terbatas pada konteks yang dipilih; tautan kembali menuju daftar rekan.
  Parameter invalid/asing tidak memberi eligibility atau membuat redirect eksternal.
- Jendela 14 hari, anti-self/duplicate dan historical-member policy tetap.
- Tidak membuka kembali Room/chat, mengubah schema/RLS atau memberi XP.

## Efisiensi dan bukti

- MySquadPage tidak berubah; tidak ada query baru pada daftar kartu.
- Prefetch link baru dimatikan. Detail mengambil membership/rating dan nama secara
  batch saat dibuka, tanpa request per rekan, polling atau pengambilan avatar.
- 56 tes aplikasi, lint dan production build/TypeScript PASS pada kandidat.
  Tes mencakup route guard, nama publik terfilter, deduplikasi, expiry/rated,
  empty/error, prefetch dan validasi konteks/back link.
- Pembacaan SQL dengan role authenticated pada Squad owner mengembalikan tiga
  profil rekan yang dapat dibaca. Tidak ada perubahan data atau migration.
- Review React: Server Components untuk data/navigation, query independen paralel,
  plain-text escaping, stable keys, link native, empty/error terpisah, tanpa hook baru.

Belum ada E2E browser owner pada entry baru. Sesudah pull, buka My Squad →
Riwayat Pasti Juara → Nilai rekan, pilih profil dan periksa konteks serta kembali.
Tes SQL memakai role/JWT simulasi dan unit render memakai fixture; bukan login Auth.
