'use client';

import { useEffect, useState } from 'react';
import { ReportLayout } from '@/features/reports/ReportLayout';
import { db } from '@/db/dexie';
import { 
  Trophy, ShoppingBag, TrendingUp, Info, 
  Package, DollarSign, Clock, Calendar, 
  LayoutGrid, Download, FileText, FileSpreadsheet
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { startOfMonth, endOfMonth, isAfter, isBefore, parseISO, startOfDay, endOfDay } from 'date-fns';
import { exportReportPDF, exportReportExcel } from '@/utils/reportExport';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button, buttonVariants } from '@/components/ui/button';

interface BestSeller {
  name: string;
  count: number;
  revenue: number;
}

export default function AnalisisTerlarisPage() {
  const [data, setData] = useState<{ products: BestSeller[], categories: BestSeller[] }>({ products: [], categories: [] });
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState<'today' | 'this_month' | 'all'>('this_month');

  useEffect(() => {
    calculateTop();
  }, [filterDate]);

  const calculateTop = async () => {
    setLoading(true);
    let allTransactions = await db.transactions.toArray();
    
    // Filter logic
    const now = new Date();
    if (filterDate === 'today') {
      const start = startOfDay(now);
      const end = endOfDay(now);
      allTransactions = allTransactions.filter(t => {
        const d = parseISO(t.created_at);
        return isAfter(d, start) && isBefore(d, end);
      });
    } else if (filterDate === 'this_month') {
      const start = startOfMonth(now);
      const end = endOfMonth(now);
      allTransactions = allTransactions.filter(t => {
        const d = parseISO(t.created_at);
        return isAfter(d, start) && isBefore(d, end);
      });
    }

    const productMap: Record<string, { count: number; revenue: number }> = {};
    
    allTransactions.forEach(tx => {
      tx.items.forEach(item => {
        const itemName = item.name_at_time;
        if (!productMap[itemName]) {
          productMap[itemName] = { count: 0, revenue: 0 };
        }
        productMap[itemName].count += item.quantity;
        productMap[itemName].revenue += item.price_at_time * item.quantity;
      });
    });

    const sortedProducts = Object.entries(productMap)
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    setData({ products: sortedProducts, categories: [] });
    setLoading(false);
  };

  const headerActions = (
    <div className="flex items-center gap-2">
      <Select value={filterDate} onValueChange={(v: any) => setFilterDate(v)}>
        <SelectTrigger className="w-[130px] h-9 rounded-xl bg-slate-50 border-2 border-slate-300 text-[9px] font-black uppercase tracking-widest focus:ring-0 shadow-sm flex items-center px-3">
          <div className="flex items-center gap-2 truncate">
            {filterDate === 'today' && <Clock className="h-3 w-3 text-indigo-600" />}
            {filterDate === 'this_month' && <Calendar className="h-3 w-3 text-indigo-600" />}
            {filterDate === 'all' && <LayoutGrid className="h-3 w-3 text-indigo-600" />}
            <span className="truncate">
              {filterDate === 'today' ? 'Hari Ini' : filterDate === 'this_month' ? 'Bulan Ini' : 'Semua'}
            </span>
          </div>
        </SelectTrigger>
        <SelectContent align="end" className="w-[160px] rounded-xl border-2 border-slate-300 shadow-2xl p-1 animate-none bg-white z-[100]">
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
        <DropdownMenuTrigger className={cn(buttonVariants({ variant: "outline", size: "icon" }), "h-9 w-9 rounded-xl border-2 border-slate-300 bg-white text-slate-900 shadow-sm")}>
          <Download className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 rounded-xl border-2 border-slate-300 shadow-2xl p-1 animate-none bg-white z-[100]">
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
    <ReportLayout title="Analisis Terlaris" rightElement={headerActions}>
      <div className="space-y-0 pb-20">
        {/* Hero Section - High Contrast & Sharp */}
        <div className="px-6 py-6 bg-slate-50/50 border-b-2 border-slate-300 flex flex-col gap-1 relative overflow-hidden">
          <div className="absolute right-[-10px] top-[-10px] p-4 opacity-[0.08]">
            <Trophy className="h-32 w-32 -rotate-12 text-slate-900" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="h-2 w-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">Produk Champion</span>
            </div>
            <div className="text-3xl font-black text-slate-900 tracking-tighter leading-none mb-4 max-w-[85%] uppercase">
              {data.products[0]?.name || 'Belum Ada Data'}
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="flex flex-col px-3 py-2 bg-white rounded-xl border-2 border-amber-200 shadow-sm">
                 <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Terjual</span>
                 <span className="text-sm font-black text-amber-700 uppercase">{data.products[0]?.count || 0} Unit</span>
              </div>
              <div className="flex flex-col px-3 py-2 bg-white rounded-xl border-2 border-emerald-200 shadow-sm">
                 <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Omzet</span>
                 <span className="text-sm font-black text-emerald-700 uppercase">Rp {(data.products[0]?.revenue || 0).toLocaleString('id-ID')}</span>
              </div>
            </div>
          </div>
        </div>

        <Tabs defaultValue="products" className="w-full gap-0">
          <TabsList className="w-full bg-white border-b-2 border-slate-200 p-0 h-14 flex rounded-none">
            <TabsTrigger 
              value="products" 
              className="flex-1 rounded-none font-black text-[10px] uppercase tracking-[0.2em] border-b-4 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-600 data-[state=active]:bg-slate-50/50"
            >
              Volume (Unit)
            </TabsTrigger>
            <TabsTrigger 
              value="revenue" 
              className="flex-1 rounded-none font-black text-[10px] uppercase tracking-[0.2em] border-b-4 border-transparent data-[state=active]:border-emerald-600 data-[state=active]:text-emerald-600 data-[state=active]:bg-slate-50/50"
            >
              Nilai (Omzet)
            </TabsTrigger>
          </TabsList>

          <TabsContent value="products" className="mt-0 bg-white">
            {loading ? (
              <div className="py-20 flex justify-center"><div className="h-6 w-6 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin" /></div>
            ) : data.products.length === 0 ? (
              <div className="py-32 flex flex-col items-center text-center gap-5">
                <Package className="h-12 w-12 text-slate-200" />
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Data belum tersedia</p>
              </div>
            ) : (
              <div className="divide-y-2 divide-slate-50 px-2">
                {data.products.map((item, idx) => (
                  <div key={item.name} className="px-4 py-5 hover:bg-slate-50 transition-colors flex items-center gap-5">
                    <div className={cn(
                      "h-11 w-11 rounded-2xl flex items-center justify-center font-black text-xs shrink-0 border-2 shadow-sm",
                      idx === 0 ? "bg-amber-50 text-amber-600 border-amber-200" : "bg-slate-50 text-slate-400 border-slate-200"
                    )}>
                      {idx === 0 ? <Trophy className="h-5 w-5" /> : idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-[13px] font-black text-slate-900 uppercase tracking-tight truncate mb-1 leading-none">{item.name}</h4>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Omzet: Rp {item.revenue.toLocaleString('id-ID')}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[15px] font-black text-indigo-700 leading-none mb-1 tracking-tight">{item.count}</div>
                      <div className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">UNIT</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="revenue" className="mt-0 bg-white">
            {loading ? (
              <div className="py-20 flex justify-center"><div className="h-6 w-6 border-4 border-slate-200 border-t-emerald-600 rounded-full animate-spin" /></div>
            ) : data.products.length === 0 ? (
              <div className="py-32 flex flex-col items-center text-center gap-5">
                <DollarSign className="h-12 w-12 text-slate-200" />
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Data belum tersedia</p>
              </div>
            ) : (
              <div className="divide-y-2 divide-slate-50 px-2">
                {[...data.products].sort((a, b) => b.revenue - a.revenue).map((item, idx) => (
                  <div key={item.name} className="px-4 py-5 hover:bg-slate-50 transition-colors flex items-center gap-5">
                    <div className={cn(
                      "h-11 w-11 rounded-2xl flex items-center justify-center font-black text-xs shrink-0 border-2 shadow-sm",
                      idx === 0 ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-slate-50 text-slate-400 border-slate-200"
                    )}>
                      {idx === 0 ? <Trophy className="h-5 w-5" /> : idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-[13px] font-black text-slate-900 uppercase tracking-tight truncate mb-1 leading-none">{item.name}</h4>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{item.count} Unit Terjual</p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[14px] font-black text-emerald-700 leading-none mb-1 tracking-tight">Rp {item.revenue.toLocaleString('id-ID')}</div>
                      <div className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">OMZET</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Insight Box - High Contrast */}
        <div className="p-6">
          <div className="p-6 bg-slate-50 rounded-3xl border-2 border-slate-300 flex items-start gap-4 shadow-sm">
            <Info className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
            <p className="text-[10px] font-black text-slate-700 uppercase leading-relaxed tracking-wide">
              Data ranking membantu Anda menentukan <span className="text-slate-900 underline decoration-indigo-400 decoration-2 underline-offset-4">Produk Champion</span> untuk strategi promosi yang lebih efisien.
            </p>
          </div>
        </div>
      </div>
    </ReportLayout>
  );
}
