'use client';

import { useEffect, useState } from 'react';
import { ReportLayout } from '@/features/reports/ReportLayout';
import { db } from '@/lib/dexie';
import { format, startOfMonth, endOfMonth, isAfter, isBefore, parseISO, startOfDay, endOfDay } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { TrendingUp, TrendingDown, Info, DollarSign, Calculator, Receipt, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function LabaRugiPage() {
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState<'today' | 'this_month' | 'all'>('this_month');
  const [stats, setStats] = useState({
    revenue: 0,
    cogs: 0, // Cost of Goods Sold
    grossProfit: 0,
    discounts: 0,
    netProfit: 0,
    margin: 0
  });

  useEffect(() => {
    const calculate = async () => {
      setLoading(true);
      const allTransactions = await db.transactions.toArray();
      const today = new Date();
      const monthStart = startOfMonth(today);
      
      const filtered = allTransactions.filter(tx => {
        const txDate = new Date(tx.created_at);
        if (filterDate === 'today') {
          return format(txDate, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
        }
        if (filterDate === 'this_month') {
          return isAfter(txDate, monthStart);
        }
        return true;
      });

      let revenue = 0;
      let cogs = 0;
      let discounts = 0;

      filtered.forEach(tx => {
        revenue += tx.subtotal; // Use subtotal before discounts
        discounts += tx.discount_total;
        tx.items.forEach(item => {
          cogs += (item.cost || 0) * item.quantity;
        });
      });

      const grossProfit = revenue - cogs;
      const netProfit = grossProfit - discounts;
      const margin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

      setStats({ revenue, cogs, grossProfit, discounts, netProfit, margin });
      setLoading(false);
    };

    calculate();
  }, [filterDate]);

  return (
    <ReportLayout title="Laporan Laba Rugi">
      <div className="p-0">
        {/* Filter Section */}
        <div className="p-4 bg-white border-b border-slate-100 flex items-center justify-between">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Periode Data</span>
          <Select value={filterDate} onValueChange={(v: any) => setFilterDate(v)}>
            <SelectTrigger className="w-[140px] h-9 rounded-xl bg-slate-50 border-none text-[10px] font-black uppercase">
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              <SelectItem value="today">Hari Ini</SelectItem>
              <SelectItem value="this_month">Bulan Ini</SelectItem>
              <SelectItem value="all">Semua Waktu</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Content Section */}
        <div className="bg-white">
          <div className="px-6 py-5 border-b border-slate-50">
            <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.2em] mb-6">Ringkasan Profitabilitas</h3>
            
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl"><DollarSign className="h-5 w-5" /></div>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-slate-800 leading-tight">Pendapatan Kotor</span>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase mt-0.5 tracking-tight">Total Penjualan</span>
                  </div>
                </div>
                <span className="text-base font-semibold text-slate-800">Rp {stats.revenue.toLocaleString('id-ID')}</span>
              </div>

              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl"><Calculator className="h-5 w-5" /></div>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-slate-800 leading-tight">Harga Pokok (HPP)</span>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase mt-0.5 tracking-tight">Modal Barang</span>
                  </div>
                </div>
                <span className="text-base font-semibold text-slate-800">Rp {stats.cogs.toLocaleString('id-ID')}</span>
              </div>

              <div className="pt-4 border-t border-slate-50 flex justify-between items-center">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Laba Penjualan</span>
                <span className="text-base font-semibold text-indigo-600">Rp {stats.grossProfit.toLocaleString('id-ID')}</span>
              </div>

              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 bg-red-50 text-red-500 rounded-xl"><Tag className="h-5 w-5" /></div>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-slate-800 leading-tight">Total Potongan (Diskon)</span>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase mt-0.5 tracking-tight">Diskon Transaksi</span>
                  </div>
                </div>
                <span className="text-base font-semibold text-red-500">-Rp {stats.discounts.toLocaleString('id-ID')}</span>
              </div>
            </div>
          </div>

          <div className="px-6 py-8 border-b border-slate-100 flex flex-col gap-4">
            <div className="flex flex-col">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Laba Bersih Akhir</span>
              <div className="text-4xl font-semibold text-emerald-600 mt-2">Rp {stats.netProfit.toLocaleString('id-ID')}</div>
            </div>
            <div className="flex items-center gap-2">
              <div className={cn(
                "px-4 py-1.5 rounded-full text-[10px] font-semibold uppercase flex items-center gap-1.5",
                stats.margin >= 20 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
              )}>
                {stats.margin >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                Margin Keuntungan {stats.margin.toFixed(1)}%
              </div>
            </div>
          </div>
        </div>

        {/* Insight Section */}
        <div className="p-6">
          <div className="p-5 bg-indigo-600 rounded-2xl text-white shadow-xl shadow-indigo-100/50 relative overflow-hidden">
            <div className="relative z-10 flex items-start gap-4">
              <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                <Info className="h-5 w-5 text-white shrink-0" />
              </div>
              <div>
                <h4 className="text-sm font-semibold uppercase tracking-tight">Analisis Margin Bisnis</h4>
                <p className="text-[11px] font-medium opacity-90 leading-relaxed mt-1.5">
                  {stats.margin >= 30 
                    ? "Bisnis Anda memiliki margin yang sangat sehat. Pertahankan efisiensi biaya produksi dan stok Anda."
                    : stats.margin >= 15
                    ? "Margin Anda berada di level rata-rata. Cobalah untuk mengurangi diskon berlebih untuk meningkatkan laba bersih."
                    : "Margin rendah terdeteksi. Periksa kembali harga modal produk atau evaluasi kebijakan diskon Anda."}
                </p>
              </div>
            </div>
          </div>

          <div className="text-center mt-8 pb-10">
            <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest">
              Data dihitung secara otomatis berdasarkan transaksi lokal
            </p>
          </div>
        </div>
      </div>
    </ReportLayout>
  );
}
