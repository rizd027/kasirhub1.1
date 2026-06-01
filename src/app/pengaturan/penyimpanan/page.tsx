'use client';

import { useState, useEffect } from 'react';
import { SettingsLayout } from '@/features/settings/SettingsLayout';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { db } from '@/db/dexie';
import {
  Download, Upload, Trash2, Cloud, CloudOff, Loader2, Info,
  CheckCircle2, RefreshCw, AlertTriangle, ShieldCheck, Database,
  CloudUpload, CloudDownload, HardDrive, Wifi, WifiOff
} from 'lucide-react';
import { AlertConfirm } from '@/components/ui/alert-confirm';
import { supabase } from '@/services/supabase';
import { cn } from '@/lib/utils';
import { useStaffStore } from '@/store/useStaffStore';
import { forceResetSync, runPushSync, runPullSync, TABLE_CONFIG, triggerFullSync } from '@/services/sync/syncManager';
import { useLiveQuery } from 'dexie-react-hooks';

// All syncable tables with labels
const ALL_TABLES: { key: keyof typeof TABLE_CONFIG; label: string }[] = [
  { key: 'categories', label: 'Kategori' },
  { key: 'products', label: 'Produk' },
  { key: 'transactions', label: 'Transaksi' },
  { key: 'transaction_items', label: 'Detail Transaksi' },
  { key: 'stock_logs', label: 'Log Stok' },
  { key: 'expenses', label: 'Pengeluaran' },
  { key: 'ingredients', label: 'Bahan Baku' },
  { key: 'product_ingredients', label: 'Resep Produk' },
  { key: 'employees', label: 'Karyawan' },
  { key: 'attendance', label: 'Absensi' },
  { key: 'hpp_batches', label: 'Kalkulasi HPP' },
  { key: 'bundling', label: 'Paket Bundling' },
  { key: 'processing_costs', label: 'Biaya Proses' },
  { key: 'customer_orders', label: 'Order Pelanggan' },
  { key: 'settings', label: 'Pengaturan Toko' },
  { key: 'profiles', label: 'Profil Akun' },
];

export default function PenyimpananDataPage() {
  const { session } = useStaffStore();
  const userId = session?.owner_id || session?.id;

  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isCloudBackup, setIsCloudBackup] = useState(false);
  const [isCloudRestore, setIsCloudRestore] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [lastBackupDate, setLastBackupDate] = useState<string | null>(null);

  // Live count of pending items
  const pendingCount = useLiveQuery(
    () => db.sync_queue.where('sync_status').equals('pending').count(),
    [],
    0
  );

  const failedCount = useLiveQuery(
    () => db.sync_queue.where('sync_status').equals('failed').count(),
    [],
    0
  );

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Load last backup date from localStorage
    const stored = localStorage.getItem('kasirhub_last_backup');
    if (stored) setLastBackupDate(stored);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // ─── Export JSON (All 16 tables) ─────────────────────────────────────────────
  const handleExportJSON = async () => {
    setIsExporting(true);
    try {
      const data: Record<string, any[]> = {};

      for (const { key, label } of ALL_TABLES) {
        try {
          const store = (db as any)[key];
          if (store) {
            data[key] = await store.toArray();
          }
        } catch (err) {
          console.warn(`[Backup] Could not export table "${key}" (${label}):`, err);
          data[key] = [];
        }
      }

      // Also export non-synced legacy tables
      try { data['stock_mutations'] = await db.stock_mutations.toArray(); } catch { data['stock_mutations'] = []; }

      const backup = {
        exported_at: new Date().toISOString(),
        version: '2.0.0',
        tables: ALL_TABLES.map(t => t.key),
        data,
      };

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateStr = new Date().toISOString().slice(0, 10);
      a.download = `kasirhub-backup-${dateStr}.json`;
      a.click();
      URL.revokeObjectURL(url);

      const now = new Date().toLocaleString('id-ID');
      localStorage.setItem('kasirhub_last_backup', now);
      setLastBackupDate(now);

      toast.success(`Backup berhasil! Berisi data dari ${Object.keys(data).length} tabel.`);
    } catch {
      toast.error('Gagal membuat backup. Coba lagi.');
    } finally {
      setIsExporting(false);
    }
  };

  // ─── Import JSON (All tables) ─────────────────────────────────────────────────
  const handleImportJSON = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setIsImporting(true);
      try {
        const text = await file.text();
        const backup = JSON.parse(text);
        const backupData = backup.data;

        if (!backupData) {
          toast.error('Format file backup tidak valid. Pastikan file merupakan backup KasirHub.');
          return;
        }

        let importedCount = 0;
        for (const { key } of ALL_TABLES) {
          if (backupData[key] && Array.isArray(backupData[key]) && backupData[key].length > 0) {
            try {
              const store = (db as any)[key];
              if (store) {
                await store.bulkPut(backupData[key]);
                importedCount += backupData[key].length;
              }
            } catch (err) {
              console.warn(`[Restore] Error importing table "${key}":`, err);
            }
          }
        }

        // Legacy tables
        if (backupData['stock_mutations']?.length > 0) {
          try { await db.stock_mutations.bulkPut(backupData['stock_mutations']); } catch { /* skip */ }
        }

        toast.success(`Data berhasil dipulihkan! ${importedCount.toLocaleString()} record dari ${file.name}.`);

        // Refresh the page to reload all stores
        setTimeout(() => window.location.reload(), 1500);
      } catch {
        toast.error('File backup tidak valid atau rusak. Pastikan file JSON yang benar.');
      } finally {
        setIsImporting(false);
      }
    };
    input.click();
  };

  // ─── Manual Cloud Backup (Push local → Supabase) ──────────────────────────────
  const handleCloudBackup = async () => {
    if (!userId) {
      toast.error('Anda harus login terlebih dahulu untuk backup ke cloud.');
      return;
    }
    if (!isOnline) {
      toast.error('Tidak ada koneksi internet. Hubungkan ke internet untuk backup ke cloud.');
      return;
    }
    setIsCloudBackup(true);
    try {
      toast.info('Memulai backup ke Supabase Cloud…');
      await runPushSync(true); // force = true to push everything pending

      const now = new Date().toLocaleString('id-ID');
      localStorage.setItem('kasirhub_last_cloud_backup', now);

      toast.success('✅ Backup ke cloud berhasil! Semua data lokal telah tersimpan ke Supabase.');
    } catch (err: any) {
      toast.error(`Backup cloud gagal: ${err?.message || 'Periksa koneksi internet Anda.'}`);
    } finally {
      setIsCloudBackup(false);
    }
  };

  // ─── Manual Cloud Restore (Pull Supabase → local) ────────────────────────────
  const handleCloudRestore = async () => {
    if (!userId) {
      toast.error('Anda harus login terlebih dahulu untuk memulihkan dari cloud.');
      return;
    }
    if (!isOnline) {
      toast.error('Tidak ada koneksi internet. Hubungkan ke internet untuk memulihkan dari cloud.');
      return;
    }
    setIsCloudRestore(true);
    try {
      toast.info('Menarik data terbaru dari Supabase Cloud…');
      await triggerFullSync(userId, true); // force full pull
      toast.success('✅ Data berhasil dipulihkan dari cloud! Memuat ulang…');
      setTimeout(() => window.location.reload(), 1500);
    } catch (err: any) {
      toast.error(`Gagal memulihkan dari cloud: ${err?.message || 'Periksa koneksi internet Anda.'}`);
    } finally {
      setIsCloudRestore(false);
    }
  };

  // ─── Clear All Local Data ─────────────────────────────────────────────────────
  const handleClearAllData = async () => {
    setIsClearing(true);
    try {
      for (const { key } of ALL_TABLES) {
        try {
          const store = (db as any)[key];
          if (store) await store.clear();
        } catch { /* skip */ }
      }
      await db.stock_mutations.clear().catch(() => {});
      await db.sync_queue.clear().catch(() => {});
      await db.sync_errors.clear().catch(() => {});

      localStorage.removeItem('kasirhub_last_backup');
      setLastBackupDate(null);

      toast.success('Semua data lokal berhasil dihapus.');
      setTimeout(() => window.location.reload(), 1000);
    } catch {
      toast.error('Gagal menghapus data.');
    } finally {
      setIsClearing(false);
      setShowClearConfirm(false);
    }
  };

  const isAnyLoading = isExporting || isImporting || isCloudBackup || isCloudRestore || isClearing;

  return (
    <SettingsLayout title="Penyimpanan & Cadangan" backUrl="/pengaturan">
      <div className="flex-1 bg-slate-50/50 overflow-y-auto pb-10">
        <div className="max-w-[1100px] mx-auto px-4 py-5 space-y-4">

          {/* Status Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Online Status */}
            <div className={cn(
              "rounded-xl border p-4 flex items-center gap-3 transition-all",
              isOnline
                ? "bg-emerald-50 border-emerald-100"
                : "bg-amber-50 border-amber-100"
            )}>
              <div className={cn(
                "size-10 rounded-lg flex items-center justify-center shrink-0",
                isOnline ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"
              )}>
                {isOnline ? <Wifi className="size-5" /> : <WifiOff className="size-5" />}
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 leading-none mb-0.5">Koneksi</p>
                <p className={cn(
                  "text-sm font-black",
                  isOnline ? "text-emerald-700" : "text-amber-700"
                )}>
                  {isOnline ? 'Online' : 'Offline'}
                </p>
              </div>
            </div>

            {/* Pending Queue */}
            <div className={cn(
              "rounded-xl border p-4 flex items-center gap-3 transition-all",
              (pendingCount ?? 0) > 0 ? "bg-indigo-50 border-indigo-100" : "bg-white border-slate-100"
            )}>
              <div className={cn(
                "size-10 rounded-lg flex items-center justify-center shrink-0",
                (pendingCount ?? 0) > 0 ? "bg-indigo-100 text-indigo-600" : "bg-slate-100 text-slate-400"
              )}>
                <Database className="size-5" />
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 leading-none mb-0.5">Antrean Lokal</p>
                <p className={cn(
                  "text-sm font-black",
                  (pendingCount ?? 0) > 0 ? "text-indigo-700" : "text-slate-700"
                )}>
                  {(pendingCount ?? 0).toLocaleString()} Perubahan Pending
                </p>
              </div>
            </div>

            {/* Failed Jobs */}
            <div className={cn(
              "rounded-xl border p-4 flex items-center gap-3 transition-all",
              (failedCount ?? 0) > 0 ? "bg-rose-50 border-rose-100" : "bg-white border-slate-100"
            )}>
              <div className={cn(
                "size-10 rounded-lg flex items-center justify-center shrink-0",
                (failedCount ?? 0) > 0 ? "bg-rose-100 text-rose-600" : "bg-slate-100 text-slate-400"
              )}>
                <AlertTriangle className="size-5" />
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 leading-none mb-0.5">Gagal Disinkronkan</p>
                <p className={cn(
                  "text-sm font-black",
                  (failedCount ?? 0) > 0 ? "text-rose-700" : "text-slate-700"
                )}>
                  {(failedCount ?? 0)} Job Gagal
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* ── Card 1: Backup & Restore JSON ── */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="px-5 py-3.5 bg-gradient-to-r from-indigo-50 to-slate-50 border-b border-slate-100 flex items-center gap-3">
                <HardDrive className="size-4 text-indigo-600" />
                <div>
                  <h3 className="text-[9px] font-black uppercase tracking-widest text-slate-500">Cadangan Lokal</h3>
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Ekspor & Impor File JSON</p>
                </div>
              </div>

              <div className="divide-y divide-slate-50">
                {/* Export Button */}
                <button
                  onClick={handleExportJSON}
                  disabled={isAnyLoading}
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-indigo-50/50 transition-all group disabled:opacity-50 disabled:cursor-not-allowed text-left"
                >
                  <div className="size-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 group-hover:bg-indigo-600 group-hover:text-white transition-colors shrink-0">
                    {isExporting ? <Loader2 className="size-5 animate-spin" /> : <Download className="size-5" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 leading-none mb-1">Download Backup</p>
                    <p className="text-sm font-black text-slate-800">Simpan ke File JSON</p>
                    <p className="text-[9px] font-bold text-slate-400 mt-0.5">Mencakup 16 tabel data: transaksi, produk, karyawan, HPP, absensi, dll</p>
                  </div>
                  <ChevronRight className="size-4 text-slate-300 group-hover:translate-x-1 transition-transform shrink-0" />
                </button>

                {/* Import Button */}
                <button
                  onClick={handleImportJSON}
                  disabled={isAnyLoading}
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-emerald-50/50 transition-all group disabled:opacity-50 disabled:cursor-not-allowed text-left"
                >
                  <div className="size-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 group-hover:bg-emerald-600 group-hover:text-white transition-colors shrink-0">
                    {isImporting ? <Loader2 className="size-5 animate-spin" /> : <Upload className="size-5" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 leading-none mb-1">Pulihkan dari File</p>
                    <p className="text-sm font-black text-slate-800">Import dari File JSON</p>
                    <p className="text-[9px] font-bold text-slate-400 mt-0.5">Pilih file .json backup yang pernah Anda unduh sebelumnya</p>
                  </div>
                  <ChevronRight className="size-4 text-slate-300 group-hover:translate-x-1 transition-transform shrink-0" />
                </button>
              </div>

              {lastBackupDate && (
                <div className="px-5 py-2.5 bg-emerald-50/50 border-t border-emerald-100 flex items-center gap-2">
                  <CheckCircle2 className="size-3 text-emerald-500 shrink-0" />
                  <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-wide">
                    Backup terakhir: {lastBackupDate}
                  </p>
                </div>
              )}
            </div>

            {/* ── Card 2: Cloud Backup & Restore ── */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="px-5 py-3.5 bg-gradient-to-r from-violet-50 to-slate-50 border-b border-slate-100 flex items-center gap-3">
                <Cloud className="size-4 text-violet-600" />
                <div>
                  <h3 className="text-[9px] font-black uppercase tracking-widest text-slate-500">Supabase Cloud</h3>
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Backup & Pulihkan dari Server</p>
                </div>
              </div>

              <div className="divide-y divide-slate-50">
                {/* Cloud Backup Button */}
                <button
                  onClick={handleCloudBackup}
                  disabled={isAnyLoading || !isOnline || !userId}
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-violet-50/50 transition-all group disabled:opacity-50 disabled:cursor-not-allowed text-left"
                >
                  <div className="size-11 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center border border-violet-100 group-hover:bg-violet-600 group-hover:text-white transition-colors shrink-0">
                    {isCloudBackup ? <Loader2 className="size-5 animate-spin" /> : <CloudUpload className="size-5" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 leading-none mb-1">Backup ke Cloud</p>
                    <p className="text-sm font-black text-slate-800">
                      {isCloudBackup ? 'Mengirim ke Supabase…' : 'Kirim Data ke Supabase'}
                    </p>
                    <p className="text-[9px] font-bold text-slate-400 mt-0.5">
                      {(pendingCount ?? 0) > 0
                        ? `${pendingCount} perubahan siap dikirim ke server`
                        : 'Semua data sudah tersinkronkan ke cloud'}
                    </p>
                  </div>
                  <div className={cn(
                    "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest shrink-0",
                    (pendingCount ?? 0) > 0
                      ? "bg-indigo-100 text-indigo-600"
                      : "bg-emerald-100 text-emerald-600"
                  )}>
                    {(pendingCount ?? 0) > 0 ? `${pendingCount} pending` : 'Synced'}
                  </div>
                </button>

                {/* Cloud Restore Button */}
                <button
                  onClick={() => setShowRestoreConfirm(true)}
                  disabled={isAnyLoading || !isOnline || !userId}
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-sky-50/50 transition-all group disabled:opacity-50 disabled:cursor-not-allowed text-left"
                >
                  <div className="size-11 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100 group-hover:bg-sky-600 group-hover:text-white transition-colors shrink-0">
                    {isCloudRestore ? <Loader2 className="size-5 animate-spin" /> : <CloudDownload className="size-5" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 leading-none mb-1">Pulihkan dari Cloud</p>
                    <p className="text-sm font-black text-slate-800">
                      {isCloudRestore ? 'Menarik dari Supabase…' : 'Ambil Data dari Supabase'}
                    </p>
                    <p className="text-[9px] font-bold text-slate-400 mt-0.5">Data lokal akan ditimpa oleh data terbaru dari server</p>
                  </div>
                  <ChevronRight className="size-4 text-slate-300 group-hover:translate-x-1 transition-transform shrink-0" />
                </button>
              </div>

              {!userId && (
                <div className="px-5 py-2.5 bg-amber-50/50 border-t border-amber-100 flex items-center gap-2">
                  <AlertTriangle className="size-3 text-amber-500 shrink-0" />
                  <p className="text-[9px] font-bold text-amber-600 uppercase tracking-wide">Login sebagai Admin untuk menggunakan cloud</p>
                </div>
              )}
            </div>

          </div>

          {/* ── Info Card ── */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-start gap-3">
              <div className="size-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
                <Info className="size-4" />
              </div>
              <div>
                <h4 className="text-xs font-black text-slate-800 mb-2 uppercase tracking-tight">Cara Kerja Penyimpanan Data</h4>
                <div className="space-y-1.5">
                  {[
                    { icon: '🖥️', text: 'Semua data (transaksi, produk, stok, dll) disimpan secara lokal di perangkat Anda secara instan.' },
                    { icon: '📁', text: 'Gunakan "Simpan ke File JSON" untuk membuat cadangan fisik yang bisa disimpan di mana saja.' },
                    { icon: '☁️', text: 'Gunakan "Kirim ke Supabase" untuk menyimpan backup ke server online kapan pun Anda mau.' },
                    { icon: '🔄', text: 'Jika ganti perangkat, cukup login dan klik "Ambil dari Supabase" atau import file JSON.' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-sm shrink-0">{item.icon}</span>
                      <p className="text-[10px] font-bold text-slate-500 leading-relaxed">{item.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Danger Zone ── */}
          <div className="bg-white rounded-xl border border-rose-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 bg-rose-50/50 border-b border-rose-100 flex items-center gap-3">
              <AlertTriangle className="size-4 text-rose-500" />
              <h3 className="text-[9px] font-black uppercase tracking-widest text-rose-500">Zona Berbahaya</h3>
            </div>
            <div className="px-5 py-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-black text-slate-800">Hapus Semua Data Lokal</p>
                <p className="text-[10px] font-bold text-rose-400 mt-0.5">
                  Menghapus semua 16 tabel dari database lokal perangkat ini. Pastikan sudah backup terlebih dahulu!
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => setShowClearConfirm(true)}
                disabled={isAnyLoading}
                className="shrink-0 h-9 border-rose-200 text-rose-600 hover:bg-rose-600 hover:text-white font-black px-4 rounded-lg uppercase tracking-widest text-[9px] transition-all"
              >
                <Trash2 className="size-3.5 mr-1.5" />
                Hapus Semua
              </Button>
            </div>
          </div>

        </div>
      </div>

      {/* Alert Dialogs */}
      <AlertConfirm
        open={showClearConfirm}
        onOpenChange={setShowClearConfirm}
        title="Hapus Semua Data Lokal?"
        description="Tindakan ini akan menghapus SEMUA data dari 16 tabel (produk, transaksi, karyawan, HPP, absensi, dll) di perangkat ini secara permanen. Pastikan Anda sudah membuat backup terlebih dahulu!"
        onConfirm={handleClearAllData}
        confirmText={isClearing ? 'Menghapus…' : 'Ya, Hapus Semua'}
        cancelText="Batal"
      />

      <AlertConfirm
        open={showRestoreConfirm}
        onOpenChange={setShowRestoreConfirm}
        title="Pulihkan dari Supabase Cloud?"
        description="Data lokal Anda akan ditimpa oleh data terbaru dari server Supabase. Perubahan lokal yang belum di-backup ke cloud akan hilang. Lanjutkan?"
        onConfirm={() => {
          setShowRestoreConfirm(false);
          handleCloudRestore();
        }}
        confirmText="Ya, Pulihkan dari Cloud"
        cancelText="Batal"
      />
    </SettingsLayout>
  );
}

const ChevronRight = ({ className }: { className?: string }) => (
  <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="m9 18 6-6-6-6" />
  </svg>
);
