'use client';

import { useState } from 'react';
import { SettingsLayout } from '@/features/settings/SettingsLayout';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { db } from '@/db/dexie';
import { Download, Upload, FileText, Database, Info, Loader2, ArrowRightLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ExportImportPage() {
  const [loading, setLoading] = useState<string | null>(null);

  const handleExportTransactions = async () => {
    setLoading('tx');
    try {
      const transactions = await db.transactions.toArray();
      const headers = ['ID', 'Tanggal', 'Total', 'Diskon', 'Metode', 'Status', 'Tersinkron'];
      const rows = transactions.map(t => [
        t.id ?? '',
        new Date(t.created_at).toLocaleString('id-ID'),
        t.total_amount,
        t.discount_total,
        t.payment_method,
        t.status,
        t.sync_status === 'synced' ? 'Ya' : 'Tidak',
      ]);
      const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `transaksi-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Transaksi berhasil diekspor!');
    } catch {
      toast.error('Gagal mengekspor transaksi');
    } finally {
      setLoading(null);
    }
  };

  const handleExportProducts = async () => {
    setLoading('prod');
    try {
      const products = await db.products.toArray();
      const headers = ['ID', 'SKU', 'Nama', 'Harga Jual', 'Harga Modal', 'Stok Toko', 'Stok Gudang'];
      const rows = products.map(p => [
        p.id, p.sku, p.name, p.price_sell, p.price_cost, p.stock_store, p.stock_warehouse,
      ]);
      const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `produk-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Produk berhasil diekspor!');
    } catch {
      toast.error('Gagal mengekspor produk');
    } finally {
      setLoading(null);
    }
  };

  const handleImportProducts = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.csv';
    input.onchange = async (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        if (file.name.endsWith('.json')) {
          const data = JSON.parse(text);
          const items = Array.isArray(data) ? data : data.products ?? [];
          await db.products.bulkPut(items);
          toast.success(`${items.length} produk berhasil diimpor!`);
        } else {
          toast.info('Import CSV produk: pastikan format sesuai template');
        }
      } catch {
        toast.error('File tidak valid');
      }
    };
    input.click();
  };

  const menuItems = [
    { 
      title: 'Export Transaksi', 
      desc: 'Data penjualan format .csv',
      icon: FileText, 
      action: handleExportTransactions, 
      key: 'tx',
      category: 'Transaksi'
    },
    { 
      title: 'Export Produk', 
      desc: 'Daftar produk format .csv',
      icon: Database, 
      action: handleExportProducts, 
      key: 'prod',
      category: 'Katalog'
    },
    { 
      title: 'Import Produk', 
      desc: 'Muat ulang dari .json',
      icon: Upload, 
      action: handleImportProducts, 
      key: 'imp',
      category: 'Katalog'
    },
  ];

  return (
    <SettingsLayout title="Export & Import Data" backUrl="/pengaturan">
      <div className="flex-1 bg-slate-50/50 overflow-y-auto lg:overflow-hidden lg:h-[calc(100vh-64px)] pb-10 lg:pb-0">
        <div className="max-w-[1400px] mx-auto px-6 py-4 h-full flex flex-col">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch flex-1 min-h-0">
            
            {/* Left Column: Info Card */}
            <div className="lg:col-span-5 flex flex-col">
              <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-100 flex flex-col items-center text-center relative overflow-hidden flex-1 justify-center">
                <div className="absolute -top-32 -left-32 size-64 bg-indigo-50 rounded-full blur-3xl opacity-50" />
                
                <div className="relative z-10 mb-6">
                  <div className="size-28 rounded-full bg-slate-50 flex items-center justify-center text-5xl border-4 border-white shadow-xl overflow-hidden relative group">
                    <div className="size-full bg-indigo-600 flex items-center justify-center text-white">
                      <ArrowRightLeft className="size-12" />
                    </div>
                  </div>
                </div>

                <div className="relative z-10 space-y-2">
                  <h2 className="text-2xl font-black text-slate-900 tracking-tighter">Transfer Data</h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.25em] max-w-xs mx-auto leading-relaxed">
                    Pindahkan data antar perangkat dengan format CSV atau JSON secara aman.
                  </p>
                </div>

                <div className="mt-8 grid grid-cols-2 gap-2 w-full relative z-10 max-w-xs">
                  <div className="bg-slate-50 rounded-lg p-3 flex flex-col items-center gap-1 border border-slate-100">
                    <FileText className="size-4 text-emerald-500" />
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">CSV Support</span>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3 flex flex-col items-center gap-1 border border-slate-100">
                    <Database className="size-4 text-indigo-500" />
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">JSON Format</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Actions */}
            <div className="lg:col-span-7 flex flex-col gap-4">
              
              <div className="bg-white rounded-lg shadow-sm border border-slate-100 overflow-hidden flex-1 flex flex-col min-h-0">
                <div className="px-5 py-3 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="text-[9px] font-black uppercase tracking-widest text-slate-500">Tindakan Data</h3>
                  <Download className="size-3.5 text-slate-300" />
                </div>
                
                <div className="divide-y divide-slate-50 overflow-auto flex-1">
                  {menuItems.map((item) => {
                    const Icon = item.icon;
                    const isLoading = loading === item.key;
                    
                    return (
                      <button
                        key={item.key}
                        onClick={item.action}
                        disabled={isLoading}
                        className="w-full flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-all group disabled:opacity-50"
                      >
                        <div className="size-11 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 group-hover:bg-indigo-600 group-hover:text-white transition-colors shrink-0">
                          {isLoading ? <Loader2 className="size-6 animate-spin" /> : <Icon className="size-6" />}
                        </div>
                        <div className="flex-1 text-left">
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 leading-none mb-1">{item.category}</p>
                          <h4 className="text-base font-black text-slate-800 leading-tight">{item.title}</h4>
                          <p className="text-[10px] font-medium text-slate-500 mt-0.5">{item.desc}</p>
                        </div>
                        <ChevronRight className="size-4 text-slate-200 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
                      </button>
                    );
                  })}
                </div>

                <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100">
                  <div className="flex items-start gap-3 p-4 bg-white rounded-lg border border-slate-200 shadow-sm">
                    <Info className="size-4 text-indigo-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-[9px] font-black text-slate-800 uppercase tracking-widest mb-1">Panduan Transfer</h4>
                      <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                        Gunakan format **JSON** untuk memindahkan data antar aplikasi KasirHub. Gunakan format **CSV** jika Anda ingin mengolah data menggunakan Microsoft Excel atau Google Sheets.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

            </div>

          </div>
        </div>
      </div>
    </SettingsLayout>
  );
}

const ChevronRight = ({ className }: { className?: string }) => (
  <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="m9 18 6-6-6-6"/>
  </svg>
);
