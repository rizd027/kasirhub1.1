'use client';

import { useEffect, useState } from 'react';
import { ReportLayout } from '@/features/reports/ReportLayout';
import { db } from '@/db/dexie';
import { format, startOfMonth, endOfMonth, isAfter, isBefore, parseISO, startOfDay, endOfDay } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { 
  TrendingUp, TrendingDown, Info, DollarSign, Calculator, 
  Receipt, Tag, Calendar, Clock, LayoutGrid, Download, 
  FileText, FileSpreadsheet, Wallet
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { exportReportPDF, exportReportExcel } from '@/utils/reportExport';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button, buttonVariants } from '@/components/ui/button';

export default function LabaRugiPage() {
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState<'today' | 'this_month' | 'all'>('this_month');
  const [stats, setStats] = useState({
    revenue: 0,
    cogs: 0, // Cost of Goods Sold
    grossProfit: 0,
    discounts: 0,
    netProfit: 0,
    margin: 0,
    totalExpenses: 0
  });

  useEffect(() => {
    const calculate = async () => {
      setLoading(true);
      const [allTransactions, allExpenses] = await Promise.all([
        db.transactions.toArray(),
        db.expenses.toArray()
      ]);
      const today = new Date();
      const monthStart = startOfMonth(today);
      
      const filterFn = (dateStr: string) => {
        const date = new Date(dateStr);
        if (filterDate === 'today') {
          return format(date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
        }
        if (filterDate === 'this_month') {
          return isAfter(date, monthStart);
        }
        return true;
      };

      const filteredTxs = allTransactions.filter(tx => filterFn(tx.created_at));
      const filteredExps = allExpenses.filter(ex => !ex.deleted_at && filterFn(ex.created_at));

      let revenue = 0;
      let cogs = 0;
      let discounts = 0;

      filteredTxs.forEach(tx => {
        revenue += tx.subtotal;
        discounts += tx.discount_total;
        tx.items.forEach(item => {
          cogs += (item.cost_at_time || 0) * item.quantity;
        });
      });

      const totalExpenses = filteredExps.reduce((s, e) => s + e.amount, 0);
      const grossProfit = revenue - cogs;
      const netProfit = grossProfit - discounts - totalExpenses;
      const margin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

      setStats({ revenue, cogs, grossProfit, discounts, netProfit, margin, totalExpenses });
      setLoading(false);
    };

    calculate();
  }, [filterDate]);

  const headerActions = (
    <div className="flex items-center gap-2">
      <Select value={filterDate} onValueChange={(v: any) => setFilterDate(v)}>
        <SelectTrigger className="w-[130px] h-9 rounded-lg bg-slate-50 border-2 border-slate-300 text-[9px] font-black uppercase tracking-widest focus:ring-0 shadow-sm flex items-center px-3">
          <div className="flex items-center gap-2 truncate">
            {filterDate === 'today' && <Clock className="h-3 w-3 text-indigo-600" />}
            {filterDate === 'this_month' && <Calendar className="h-3 w-3 text-indigo-600" />}
            {filterDate === 'all' && <LayoutGrid className="h-3 w-3 text-indigo-600" />}
            <span className="truncate">
              {filterDate === 'today' ? 'Hari Ini' : filterDate === 'this_month' ? 'Bulan Ini' : 'Semua'}
            </span>
          </div>
        </SelectTrigger>
        <SelectContent align="end" className="w-[160px] rounded-lg border-2 border-slate-300 shadow-2xl p-1 animate-none bg-white z-[100]">
          <SelectItem value="today" className="text-[10px] font-black uppercase tracking-widest py-2.5 px-3 focus:bg-indigo-50 focus:text-indigo-700 rounded-lg cursor-pointer outline-none">
            <div className="flex items-center gap-3"><Clock className="h-3.5 w-3.5 opacity-70" /><span>Hari Ini</span></div>
          </SelectItem>
          <SelectItem value="this_month" className="text-[10px] font-black uppercase tracking-widest py-2.5 px-3 focus:bg-indigo-50 focus:text-indigo-700 rounded-lg cursor-pointer outline-none">
            <div className="flex items-center gap-3"><Calendar className="h-3.5 w-3.5 opacity-70" /><span>Bulan Ini</span></div>
          </SelectItem>
          <SelectItem value="all" className="text-[10px] font-black uppercase tracking-widest py-2.5 px-3 focus:bg-indigo-50 focus:text-indigo-700 rounded-lg cursor-pointer outline-none">
            <div className="flex items-center gap-3"><LayoutGrid className="h-3.5 w-3.5 opacity-70" /><span>Semua</span></div>
          </SelectItem>
        </SelectContent>
      </Select>

      <DropdownMenu>
        <DropdownMenuTrigger className={cn(buttonVariants({ variant: "outline", size: "icon" }), "h-9 w-9 rounded-lg border-2 border-slate-300 bg-white text-slate-900 shadow-sm")}>
          <Download className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 rounded-lg border-2 border-slate-300 shadow-2xl p-1 animate-none bg-white z-[100]">
          <DropdownMenuItem onClick={exportReportPDF} className="flex items-center gap-3 py-2.5 px-3 rounded-lg cursor-pointer focus:bg-red-50 focus:text-red-700 outline-none">
            <FileText className="h-4 w-4 text-red-500" /><span className="text-[10px] font-black uppercase tracking-wider">Ekspor PDF</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={exportReportExcel} className="flex items-center gap-3 py-2.5 px-3 rounded-lg cursor-pointer focus:bg-emerald-50 focus:text-emerald-700 outline-none">
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" /><span className="text-[10px] font-black uppercase tracking-wider">Ekspor Excel</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  return (
    <ReportLayout title="Laporan Laba" rightElement={headerActions}>
      <div className="space-y-0 pb-20">
        {/* Content Section - High Contrast */}
        <div className="bg-white">
          <div className="px-6 py-8 border-b border-slate-200">
            <h3 className="text-[10px] font-black text-slate-800 uppercase tracking-[0.3em] mb-8 border-l-4 border-indigo-600 pl-3">Profitabilitas Utama</h3>
            
            <div className="divide-y-2 divide-slate-100">
              {/* Gross Revenue */}
              <div className="py-6 flex justify-between items-center group">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 bg-slate-50 text-slate-900 group-hover:text-indigo-600 transition-colors rounded-lg border-2 border-slate-200">
                    <DollarSign className="h-4 w-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-black text-slate-900 uppercase tracking-tight">Pendapatan Kotor</span>
                    <span className="text-[9px] font-bold text-slate-600 uppercase tracking-tighter mt-0.5">Total Penjualan</span>
                  </div>
                </div>
                <span className="text-base font-black text-slate-900">Rp {stats.revenue.toLocaleString('id-ID')}</span>
              </div>

              {/* COGS (HPP) */}
              <div className="py-6 flex justify-between items-center group">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 bg-slate-50 text-slate-900 group-hover:text-amber-600 transition-colors rounded-lg border-2 border-slate-200">
                    <Calculator className="h-4 w-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-black text-slate-900 uppercase tracking-tight">Harga Pokok (HPP)</span>
                    <span className="text-[9px] font-bold text-slate-600 uppercase tracking-tighter mt-0.5">Modal Barang</span>
                  </div>
                </div>
                <span className="text-base font-black text-slate-900">Rp {stats.cogs.toLocaleString('id-ID')}</span>
              </div>

              {/* Gross Profit */}
              <div className="py-6 flex justify-between items-center group bg-indigo-50/40 -mx-6 px-6 border-y border-indigo-100">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 bg-white text-indigo-600 rounded-lg border-2 border-indigo-200 shadow-sm">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-black text-indigo-800 uppercase tracking-tight">Laba Penjualan</span>
                    <span className="text-[9px] font-bold text-indigo-600 uppercase tracking-tighter mt-0.5">Gross Profit</span>
                  </div>
                </div>
                <span className="text-base font-black text-indigo-700">Rp {stats.grossProfit.toLocaleString('id-ID')}</span>
              </div>

              {/* Discounts */}
              <div className="py-6 flex justify-between items-center group">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 bg-slate-50 text-slate-900 group-hover:text-red-600 transition-colors rounded-lg border-2 border-slate-200">
                    <Tag className="h-4 w-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-black text-slate-900 uppercase tracking-tight">Potongan Harga</span>
                    <span className="text-[9px] font-bold text-slate-600 uppercase tracking-tighter mt-0.5">Total Diskon</span>
                  </div>
                </div>
                <span className="text-base font-black text-red-600">-Rp {stats.discounts.toLocaleString('id-ID')}</span>
              </div>

              {/* Operational Expenses */}
              <div className="py-6 flex justify-between items-center group">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 bg-slate-50 text-slate-900 group-hover:text-rose-600 transition-colors rounded-lg border-2 border-slate-200">
                    <Wallet className="h-4 w-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-black text-slate-900 uppercase tracking-tight">Biaya Operasional</span>
                    <span className="text-[9px] font-bold text-slate-600 uppercase tracking-tighter mt-0.5">Sewa, Gaji, Listrik, dll.</span>
                  </div>
                </div>
                <span className="text-base font-black text-rose-600">-Rp {stats.totalExpenses.toLocaleString('id-ID')}</span>
              </div>
            </div>
          </div>

          {/* Final Net Profit Section */}
          <div className="px-6 py-12 border-b-2 border-slate-200 bg-slate-50 flex flex-col items-center text-center">
             <span className="text-[11px] font-black text-slate-500 uppercase tracking-[0.5em] mb-4">Laba Bersih Akhir</span>
             <div className="text-6xl font-black text-emerald-700 tracking-tighter mb-6">
               Rp {stats.netProfit.toLocaleString('id-ID')}
             </div>
             <div className={cn(
                "px-6 py-2.5 rounded-full text-xs font-black uppercase flex items-center gap-2 border-2 shadow-lg transition-all bg-white",
                stats.margin >= 20 ? "text-emerald-700 border-emerald-300" : "text-amber-700 border-amber-300"
              )}>
                {stats.margin >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                Margin Keuntungan {stats.margin.toFixed(1)}%
              </div>
          </div>
        </div>

        {/* Analysis Insight Box - High Contrast */}
        <div className="p-6">
          <div className="p-8 bg-white rounded-lg border-2 border-slate-300 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-[0.08]">
              <Info className="h-28 w-28 -rotate-12 text-slate-900" />
            </div>
            <div className="relative z-10 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="h-3 w-3 rounded-full bg-indigo-600" />
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-900">Analisis Bisnis Anda</h4>
              </div>
              <p className="text-xs font-black text-slate-700 leading-relaxed uppercase tracking-tight max-w-[90%]">
                {stats.margin >= 30 
                  ? "Sangat sehat. Efisiensi biaya dan strategi harga Anda sudah optimal. Pertahankan momentum ini untuk ekspansi lebih lanjut."
                  : stats.margin >= 15
                  ? "Level rata-rata. Pertimbangkan untuk mengurangi diskon transaksi guna memaksimalkan laba bersih setiap penjualan."
                  : "Margin rendah terdeteksi. Segera evaluasi harga modal produk atau kurangi pengeluaran promosi yang tidak efisien."}
              </p>
            </div>
          </div>

          <div className="text-center mt-16 pb-12">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.4em]">
              KasirHub Intelligence • High Contrast Mode
            </p>
          </div>
        </div>
      </div>
    </ReportLayout>
  );
}

