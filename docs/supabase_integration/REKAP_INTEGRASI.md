# Rekap Integrasi Supabase - KasirHub

Dokumen ini merangkum seluruh komponen yang menghubungkan aplikasi KasirHub dengan basis data cloud Supabase.

## 1. Arsitektur Database
KasirHub menggunakan arsitektur **Offline-First**. 
- **Database Lokal**: Dexie (IndexedDB)
- **Database Cloud**: Supabase (PostgreSQL)
- **Sinkronisasi**: Bidirectional sync via `syncManager.ts`.

## 2. File Skema & Database (Folder: docs/supabase_integration)
- `database.sql`: Skema utama Cloud (Tabel, RLS, Functions).
- `reset table.sql`: Script utilitas untuk mereset data saat development.
- `supabase_schema backup 1.rar`: Backup skema database.

## 3. Komponen Teknis (Folder: src/)

### A. Konfigurasi & Auth
- `.env.local`: Menyimpan URL dan API Key Supabase (Kredensial).
- `src/services/supabase.ts`: Client initialization (Gateway utama).
- `src/utils/auth.ts`: Logika autentikasi.
- `src/features/auth/AuthCheck.tsx`: Proteksi rute & validasi sesi.

### B. Database Lokal (Dexie)
- `src/db/dexie.ts`: Definisi skema database lokal (IndexedDB), tabel, dan indeks.

### C. Engine Sinkronisasi (Core)
- `src/services/sync/syncManager.ts`: Pusat logika Push & Pull.
- `src/components/SyncProvider.tsx`: Context manager untuk lifecycle sinkronisasi.
- `src/services/sync/syncSettings.ts`: Sinkronisasi khusus pengaturan.
- `src/services/sync/syncAttendance.ts`: Sinkronisasi khusus absensi.

### D. Real-time & Hooks
- `src/hooks/useRealtimeSync.ts`: Mendengarkan perubahan data secara live dari Supabase.
- `src/hooks/useRealtimeChannel.ts`: Manajemen channel Broadcast/Presence.
- `src/hooks/useSync.ts`: Hook utilitas untuk memicu sinkronisasi manual dari komponen UI.
- `src/hooks/useCheckout.ts`: Operasi transaksi yang melibatkan database lokal & cloud.

## 4. Alur Sinkronisasi Data
1. **DML Lokal**: Saat data disimpan (Insert/Update/Delete), data masuk ke **Dexie** dan ID record masuk ke `sync_queue` dengan status `pending`.
2. **Push Sync**: `syncManager.ts` mengirim batch data dari `sync_queue` ke Supabase menggunakan method `.upsert()`.
3. **Pull Sync**: Dilakukan saat aplikasi pertama kali dibuka (Initial Sync) atau via trigger realtime.
4. **Soft Delete**: Penghapusan data menggunakan kolom `deleted_at` agar sinkronisasi antar perangkat tetap terjaga konsistensinya.

---
*Terakhir diupdate: 2026-05-13*
