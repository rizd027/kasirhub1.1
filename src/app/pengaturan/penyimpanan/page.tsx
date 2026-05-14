'use client';

import { useState, useEffect } from 'react';
import { SettingsLayout } from '@/features/settings/SettingsLayout';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { db } from '@/db/dexie';
import { Download, Upload, Trash2, Cloud, CloudOff, Loader2, Info, CheckCircle2, RefreshCw, AlertTriangle, ShieldCheck, Database } from 'lucide-react';
import { AlertConfirm } from '@/components/ui/alert-confirm';
import { supabase } from '@/services/supabase';
import { cn } from '@/lib/utils';
import { useStaffStore } from '@/store/useStaffStore';
import { forceResetSync } from '@/services/sync/syncManager';

export default function PenyimpananDataPage() {
  const { session } = useStaffStore();
  const [isExporting, setIsExporting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isCloudConnected, setIsCloudConnected] = useState<boolean | null>(!!session);
  const [unsyncedCount, setUnsyncedCount] = useState(0);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    setIsCloudConnected(!!session);
    db.transactions.where('sync_status').equals('pending').count().then(setUnsyncedCount);
  }, [session]);

  const handleExportJSON = async () => {
    setIsExporting(true);
    try {
      const transactions = await db.transactions.toArray();
      const products = await db.products.toArray();
      const categories = await db.categories.toArray();
      const stock_mutations = await db.stock_mutations.toArray();
      const attendance = await db.attendance.toArray();

      const backup = {
        exported_at: new Date().toISOString(),
        version: '1.0.1',
        data: { transactions, products, categories, stock_mutations, attendance }
      };

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kasirhub-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Backup berhasil diunduh!');
    } catch {
      toast.error('Gagal membuat backup');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportJSON = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const backup = JSON.parse(text);
        if (backup.data?.products) await db.products.bulkPut(backup.data.products);
        if (backup.data?.categories) await db.categories.bulkPut(backup.data.categories);
        if (backup.data?.stock_mutations) await db.stock_mutations.bulkPut(backup.data.stock_mutations);
        if (backup.data?.attendance) await db.attendance.bulkPut(backup.data.attendance);
        if (backup.data?.transactions) await db.transactions.bulkAdd(backup.data.transactions).catch(() => {});
        toast.success('Data berhasil dipulihkan!');
      } catch {
        toast.error('File backup tidak valid');
      }
    };
    input.click();
  };

  const handleClearAllData = async () => {
    setIsClearing(true);
    try {
      await Promise.all([
        db.transactions.clear(),
        db.products.clear(),
        db.categories.clear(),
        db.stock_mutations.clear()
      ]);
      toast.success('Semua data lokal berhasil dihapus');
      setUnsyncedCount(0);
    } catch {
      toast.error('Gagal menghapus data');
    } finally {
      setIsClearing(false);
      setShowClearConfirm(false);
    }
  };

  const handleForceResetSync = async () => {
    setIsResetting(true);
    try {
      await forceResetSync();
      toast.success('Status sinkronisasi telah direset');
    } catch {
      toast.error('Gagal mereset sinkronisasi');
    } finally {
      setIsResetting(false);
      setShowResetConfirm(false);
    }
  };

  return (
    <SettingsLayout title="Penyimpanan & Sinkronisasi" backUrl="/pengaturan">
      <div className="flex-1 bg-slate-50/50 overflow-y-auto lg:overflow-hidden lg:h-[calc(100vh-64px)] pb-10 lg:pb-0">
        <div className="max-w-[1400px] mx-auto px-6 py-4 h-full flex flex-col">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch flex-1 min-h-0">
            
            {/* Left Column: Cloud Status Card */}
            <div className="lg:col-span-5 flex flex-col">
              <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-100 flex flex-col items-center text-center relative overflow-hidden flex-1 justify-center">
                <div className="absolute -top-32 -left-32 size-64 bg-indigo-50 rounded-full blur-3xl opacity-50" />
                
                <div className="relative z-10 mb-6">
                  <div className={cn(
                    "size-24 rounded-full flex items-center justify-center text-4xl border-4 border-white shadow-xl transition-all duration-500",
                    isCloudConnected === null ? "bg-slate-50 text-slate-300" :
                    isCloudConnected ? "bg-emerald-50 text-emerald-600 scale-105" : "bg-amber-50 text-amber-600"
                  )}>
                    {isCloudConnected === null ? <Loader2 className="animate-spin size-10" /> : 
                     isCloudConnected ? <Cloud className="size-10" /> : <CloudOff className="size-10" />}
                  </div>
                </div>

                <div className="relative z-10 space-y-2">
                  <h2 className="text-2xl font-black text-slate-900 tracking-tighter">
                    {isCloudConnected === null ? 'Memeriksa...' : 
                     isCloudConnected ? 'Cloud Terhubung' : 'Mode Offline'}
                  </h2>
                  <div className="flex flex-col items-center gap-3">
                    {isCloudConnected ? (
                      <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100">
                        <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[9px] font-black uppercase tracking-[0.2em]">Live Sync Active</span>
                      </div>
                    ) : (
                      <div className="px-3 py-1 bg-amber-50 text-amber-600 rounded-full border border-amber-100 text-[9px] font-black uppercase tracking-[0.2em]">
                        Local Storage Only
                      </div>
                    )}
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.25em]">
                      {unsyncedCount} Data Antrean Pending
                    </p>
                  </div>
                </div>

                <div className="mt-8 grid grid-cols-2 gap-2 w-full relative z-10 max-w-xs">
                  <div className="bg-slate-50 rounded-lg p-3 flex flex-col items-center gap-1 border border-slate-100">
                    <ShieldCheck className="size-4 text-emerald-500" />
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Enkripsi AES</span>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3 flex flex-col items-center gap-1 border border-slate-100">
                    <Database className="size-4 text-indigo-500" />
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Dexie DB</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Actions & Safety */}
            <div className="lg:col-span-7 flex flex-col gap-4">
              
              {/* Backup Actions Card */}
              <div className="bg-white rounded-lg shadow-sm border border-slate-100 overflow-hidden">
                <div className="px-5 py-3 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="text-[9px] font-black uppercase tracking-widest text-slate-500">Cadangan & Pemulihan</h3>
                  <div className="px-2 py-0.5 bg-white rounded-full border border-slate-200 text-[8px] font-bold text-slate-400 uppercase tracking-tighter">
                    File JSON
                  </div>
                </div>
                <div className="divide-y divide-slate-50">
                  <button
                    onClick={handleExportJSON}
                    disabled={isExporting}
                    className="w-full flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-all group disabled:opacity-50"
                  >
                    <div className="size-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                      {isExporting ? <Loader2 className="size-5 animate-spin" /> : <Download className="size-5" />}
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 leading-none mb-1">Unduh Backup</p>
                      <p className="text-xs font-black text-slate-800">Export ke File JSON</p>
                    </div>
                    <ChevronRight className="size-4 text-slate-300 group-hover:translate-x-1 transition-transform" />
                  </button>

                  <button
                    onClick={handleImportJSON}
                    className="w-full flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-all group"
                  >
                    <div className="size-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                      <Upload className="size-5" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 leading-none mb-1">Pulihkan Data</p>
                      <p className="text-xs font-black text-slate-800">Import dari File JSON</p>
                    </div>
                    <ChevronRight className="size-4 text-slate-300 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>

              {/* Maintenance Card */}
              <div className="bg-white rounded-lg shadow-sm border border-slate-100 flex-1 flex flex-col min-h-0 overflow-hidden">
                <div className="px-5 py-3 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="text-[9px] font-black uppercase tracking-widest text-slate-500">Pemeliharaan Sistem</h3>
                  <RefreshCw className="size-3.5 text-slate-300" />
                </div>
                <div className="p-5 flex-1 overflow-auto">
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-4 group">
                      <div className="size-10 rounded-lg bg-slate-50 text-slate-400 flex items-center justify-center border border-slate-100 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                        <RefreshCw className="size-5" />
                      </div>
                      <div className="flex-1">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 leading-none mb-1">Sinkronisasi Macet?</p>
                        <button 
                          onClick={() => setShowResetConfirm(true)}
                          className="text-xs font-black text-slate-800 hover:text-indigo-600 transition-colors"
                        >
                          Reset Status Sinkronisasi
                        </button>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setShowResetConfirm(true)} className="rounded-lg h-8 px-2 text-[9px] font-black uppercase tracking-widest text-indigo-600 hover:bg-indigo-50">
                        Reset
                      </Button>
                    </div>

                    <div className="flex items-start gap-3 p-3 bg-indigo-50/50 rounded-lg border border-indigo-100">
                      <Info className="size-4 text-indigo-600 shrink-0 mt-0.5" />
                      <p className="text-[9px] text-indigo-800 font-bold uppercase tracking-tight leading-relaxed">
                        Data disimpan secara Offline-First di database lokal perangkat Anda. Sinkronisasi dilakukan otomatis ke server setiap kali ada perubahan data.
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="px-5 py-3 bg-rose-50/30 border-t border-rose-100 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="size-3.5 text-rose-500 shrink-0" />
                    <div>
                      <h4 className="text-[9px] font-black text-rose-600 uppercase tracking-tight leading-none">Hapus Seluruh Data</h4>
                      <p className="text-[8px] font-bold text-rose-400 uppercase tracking-widest leading-none mt-1">Kosongkan database lokal</p>
                    </div>
                  </div>
                  <Button variant="outline" onClick={() => setShowClearConfirm(true)} className="h-8 border-rose-200 text-rose-600 hover:bg-rose-600 hover:text-white font-black px-3 rounded-lg uppercase tracking-widest text-[9px]">
                    Kosongkan
                  </Button>
                </div>
              </div>

            </div>

          </div>
        </div>
      </div>

      <AlertConfirm
        open={showClearConfirm}
        onOpenChange={setShowClearConfirm}
        title="Hapus Semua Data?"
        description="Semua Produk, Kategori, dan Transaksi di perangkat ini akan dihapus secara permanen. Pastikan Anda sudah memiliki backup."
        onConfirm={handleClearAllData}
        confirmText="Ya, Hapus Semua"
        cancelText="Batal"
      />

      <AlertConfirm
        open={showResetConfirm}
        onOpenChange={setShowResetConfirm}
        title="Reset Sinkronisasi?"
        description="Gunakan fitur ini hanya jika antrean sinkronisasi Anda macet. Sistem akan mencoba mengirim ulang data yang tertunda."
        onConfirm={handleForceResetSync}
        confirmText="Ya, Reset Sekarang"
        cancelText="Batal"
      />
    </SettingsLayout>
  );
}

const ChevronRight = ({ className }: { className?: string }) => (
  <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="m9 18 6-6-6-6"/>
  </svg>
);
