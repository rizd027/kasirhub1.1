'use client';

import { useState, useEffect } from 'react';
import { SettingsLayout } from '@/features/settings/SettingsLayout';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { db } from '@/lib/dexie';
import { Download, Upload, Trash2, Cloud, CloudOff, Loader2, Info, CheckCircle2 } from 'lucide-react';
import { AlertConfirm } from '@/components/ui/alert-confirm';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

export default function PenyimpananDataPage() {
  const [isExporting, setIsExporting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isCloudConnected, setIsCloudConnected] = useState<boolean | null>(null);
  const [unsyncedCount, setUnsyncedCount] = useState(0);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const fetchSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsCloudConnected(!!session);
    };
    fetchSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsCloudConnected(!!session);
    });

    db.transactions.where('synced').equals(0).count().then(setUnsyncedCount);

    return () => subscription.unsubscribe();
  }, []);

  const handleExportJSON = async () => {
    setIsExporting(true);
    try {
      const transactions = await db.transactions.toArray();
      const products = await db.products.toArray();
      const categories = await db.categories.toArray();

      const backup = {
        exported_at: new Date().toISOString(),
        version: '1.0.0',
        data: { transactions, products, categories }
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

  const handleSyncData = async () => {
    setIsSyncing(true);
    try {
      const { triggerSync } = await import('@/hooks/useSync');
      await triggerSync(true);
      const count = await db.transactions.where('synced').equals(0).count();
      setUnsyncedCount(count);
      toast.success('Data berhasil disinkronisasi ke cloud');
    } catch (err: any) {
      toast.error(err.message || 'Gagal menyinkronkan data');
    } finally {
      setIsSyncing(false);
    }
  };

  const actions = [
    {
      title: 'Sinkronisasi ke Cloud',
      desc: 'Unggah data offline ke server',
      icon: CheckCircle2,
      action: handleSyncData,
      loading: isSyncing,
    },
    {
      title: 'Export Backup (JSON)',
      desc: 'Unduh semua data sebagai file .json',
      icon: Download,
      action: handleExportJSON,
      loading: isExporting,
    },
    {
      title: 'Import / Pulihkan Data',
      desc: 'Muat ulang dari file backup .json',
      icon: Upload,
      action: handleImportJSON,
      loading: false,
    },
  ];

  return (
    <SettingsLayout title="Penyimpanan Data">
      <div className="flex flex-col pb-20">
        
        {/* Cloud Status Header */}
        <div className="bg-white border-b border-slate-100">
          <div className="flex flex-col items-center pt-10 pb-8 px-6 text-center">
            <div className={cn(
              "w-20 h-20 rounded-[32px] flex items-center justify-center text-3xl mb-4 border shadow-sm",
              isCloudConnected === null ? "bg-slate-50 border-slate-100 animate-pulse text-slate-400" :
              isCloudConnected ? "bg-emerald-50 border-emerald-100 text-emerald-600" : "bg-amber-50 border-amber-100 text-amber-600"
            )}>
              {isCloudConnected === null ? <Loader2 className="animate-spin size-8" /> : 
               isCloudConnected ? <Cloud className="size-8" /> : <CloudOff className="size-8" />}
            </div>
            
            <div className="flex flex-col items-center gap-1">
              <h2 className="text-xl font-black tracking-tight text-slate-800">
                {isCloudConnected === null ? 'Memeriksa...' : 
                 isCloudConnected ? 'Cloud Terhubung' : 'Lokal Saja'}
              </h2>
              {isCloudConnected && (
                <div className="flex items-center gap-1.5 mt-1">
                  <div className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600">LIVE SYNC</span>
                </div>
              )}
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-2">
                {isCloudConnected ? `${unsyncedCount} Data Menunggu` : 'Tidak Terhubung ke Server'}
              </p>
            </div>
          </div>
        </div>

        {/* Actions List */}
        <div className="bg-white border-b border-slate-100 divide-y divide-slate-100">
          {actions.map((item) => (
            <button
              key={item.title}
              onClick={item.action}
              disabled={item.loading}
              className="w-full flex items-center gap-4 px-6 py-5 hover:bg-slate-50 transition-colors active:bg-slate-100 text-left disabled:opacity-50"
            >
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center border border-indigo-100 shrink-0">
                <item.icon className="size-5 text-indigo-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-0.5 truncate">{item.desc}</p>
                <p className="text-sm font-black text-slate-800 truncate">{item.loading ? 'Memproses...' : item.title}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Info & Danger Zone */}
        <div className="flex flex-col mt-4 bg-white border-y border-slate-100">
          <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100">
            <h2 className="text-[11px] font-black uppercase tracking-[0.25em] text-slate-800">Informasi & Zona Bahaya</h2>
          </div>
          <div className="divide-y divide-slate-100">
            <div className="px-6 py-5 flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100 shrink-0">
                <Info className="size-5 text-slate-400" />
              </div>
              <div className="flex-1 space-y-1 mt-0.5">
                <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-widest">Sistem Offline-First</h4>
                <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                  Data disimpan di perangkat dan otomatis disinkronkan ke Cloud saat internet tersedia.
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowClearConfirm(true)}
              disabled={isClearing}
              className="w-full px-6 py-5 flex items-center gap-4 hover:bg-red-50/50 transition-colors active:bg-red-50 text-left disabled:opacity-50"
            >
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center border border-red-100 shrink-0">
                <Trash2 className="size-5 text-red-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-black uppercase tracking-widest text-red-400 mb-0.5 truncate">Hapus Produk & Transaksi</p>
                <p className="text-sm font-black text-red-600 truncate">Hapus Semua Data Lokal</p>
              </div>
            </button>
          </div>
        </div>

        <AlertConfirm
          open={showClearConfirm}
          onOpenChange={setShowClearConfirm}
          title="Hapus Semua Data?"
          description="Tindakan ini akan menghapus semua Produk, Kategori, dan Transaksi di perangkat ini secara permanen. Pastikan Anda sudah melakukan backup."
          onConfirm={handleClearAllData}
          confirmText="Ya, Hapus Semua"
          cancelText="Batal"
        />

      </div>
    </SettingsLayout>
  );
}
