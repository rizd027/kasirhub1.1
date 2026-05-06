'use client';

import { useState } from 'react';
import { SettingsLayout } from '@/features/settings/SettingsLayout';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { db } from '@/lib/dexie';
import { Download, Upload, ChevronRight } from 'lucide-react';

export default function ExportImportPage() {
  const [loading, setLoading] = useState<string | null>(null);

  const handleExportTransactions = async () => {
    setLoading('tx');
    try {
      const transactions = await db.transactions.toArray();
      // CSV format
      const headers = ['ID', 'Tanggal', 'Total', 'Diskon', 'Metode', 'Status', 'Tersinkron'];
      const rows = transactions.map(t => [
        t.id ?? '',
        new Date(t.created_at).toLocaleString('id-ID'),
        t.total_amount,
        t.discount_total,
        t.payment_method,
        t.status,
        t.synced ? 'Ya' : 'Tidak',
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
    { title: 'Export Transaksi (.csv)', icon: Download, action: handleExportTransactions, key: 'tx' },
    { title: 'Export Produk (.csv)', icon: Download, action: handleExportProducts, key: 'prod' },
    { title: 'Import Produk (.json)', icon: Upload, action: handleImportProducts, key: 'imp' },
  ];

  return (
    <SettingsLayout title="Export Import Data">
      <div className="flex flex-col pb-20">
        
        {/* Info Header */}
        <div className="bg-slate-50 border-b border-slate-100">
          <div className="px-6 py-8 text-center flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center justify-center mb-4">
              <Download className="size-6 text-indigo-600" />
            </div>
            <h2 className="text-lg font-black tracking-tight text-slate-800">Transfer Data</h2>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mt-2 max-w-[250px] leading-relaxed">
              Pindahkan data antar perangkat dengan format CSV atau JSON.
            </p>
          </div>
        </div>

        {/* Menu Items List */}
        <div className="bg-white border-y border-slate-100 divide-y divide-slate-100 mt-4">
          <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100">
            <h2 className="text-[11px] font-black uppercase tracking-[0.25em] text-slate-800">Tindakan</h2>
          </div>
          {menuItems.map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                onClick={item.action}
                disabled={loading === item.key}
                className="w-full flex items-center gap-4 px-6 py-5 hover:bg-slate-50 transition-colors active:bg-slate-100 text-left disabled:opacity-50"
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center border border-indigo-100 shrink-0">
                  <Icon className="size-5 text-indigo-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-0.5 truncate">
                    {item.key === 'tx' ? 'Data Transaksi' : 'Data Produk'}
                  </p>
                  <p className="text-sm font-black text-slate-800 truncate">
                    {loading === item.key ? 'Memproses...' : item.title}
                  </p>
                </div>
                <ChevronRight className="size-5 text-slate-300" />
              </button>
            );
          })}
        </div>

      </div>
    </SettingsLayout>
  );
}
