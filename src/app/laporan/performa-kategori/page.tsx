'use client';

import { useEffect, useState, useMemo } from 'react';
import { ReportLayout } from '@/features/reports/ReportLayout';
import { db } from '@/db/dexie';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { 
  LayoutGrid, Info, Clock, Calendar, 
  Download, FileText, FileSpreadsheet, PieChart as PieChartIcon 
} from 'lucide-react';
import { cn } from '@/lib/utils';
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

interface CategoryPerf {
  name: string;
  revenue: number;
  count: number;
}

export default function PerformaKategoriPage() {
  const [data, setData] = useState<CategoryPerf[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState<'today' | 'this_month' | 'all'>('this_month');

  useEffect(() => {
    fetchData();
  }, [filterDate]);

  const fetchData = async () => {
    setLoading(true);
    let allTransactions = await db.transactions.toArray();
    const categories = await db.categories.toArray();
    
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

    const catMap: Record<string, { revenue: number; count: number }> = {};
    
    const products = await db.products.toArray();
    const productToCat: Record<string, string> = {};
    products.forEach(p => {
      productToCat[p.name] = p.category_id || 'no_cat';
    });

    allTransactions.forEach(tx => {
      tx.items.forEach(item => {
        const itemName = item.name_at_time;
        const catId = productToCat[itemName] || 'no_cat';
        if (!catMap[catId]) catMap[catId] = { revenue: 0, count: 0 };
        catMap[catId].revenue += item.price_at_time * item.quantity;
        catMap[catId].count += item.quantity;
      });
    });

    const result = Object.entries(catMap)
      .map(([id, stats]) => {
        const catName = id === 'no_cat' ? 'Lainnya' : (categories.find(c => c.id === id)?.name || 'Lainnya');
        return { name: catName, ...stats };
      })
      .filter(c => c.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue);

    setData(result);
    setLoading(false);
  };

  const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];
  const chartData = useMemo(() => data.map(c => ({ name: c.name, value: c.revenue })), [data]);
  const totalRevenue = data.reduce((s, c) => s + c.revenue, 0);

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
    <ReportLayout title="Performa Kategori" rightElement={headerActions}>
      <div className="space-y-0 pb-20">
        {/* Chart Section - Sharp & Direct */}
        <div className="bg-white px-6 py-10 border-b-2 border-slate-300">
          <div className="flex items-center gap-2 mb-8">
            <div className="h-2 w-2 rounded-full bg-indigo-600" />
            <h3 className="text-[10px] font-black text-slate-800 uppercase tracking-[0.4em]">Proporsi Omzet Kategori</h3>
          </div>
          <div className="h-[220px] w-full relative">
            {loading ? (
               <div className="h-full w-full flex items-center justify-center"><div className="h-6 w-6 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin" /></div>
            ) : data.length === 0 ? (
               <div className="h-full w-full flex flex-col items-center justify-center gap-4">
                  <PieChartIcon className="h-12 w-12 text-slate-200" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Data tidak tersedia</span>
               </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={75}
                      outerRadius={100}
                      paddingAngle={4}
                      dataKey="value"
                      isAnimationActive={false}
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="#fff" strokeWidth={3} />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      formatter={(value: any) => [`Rp ${Number(value).toLocaleString('id-ID')}`, 'Omzet']}
                      contentStyle={{ borderRadius: '12px', border: '2px solid #e2e8f0', boxShadow: 'none', fontSize: '10px', fontWeight: '900', textTransform: 'uppercase' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none translate-y-[-2px]">
                   <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Nilai</span>
                   <span className="text-sm font-black text-slate-900 tracking-tight">Rp{totalRevenue.toLocaleString('id-ID')}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* List Section - Line Separated & High Contrast */}
        <div className="bg-white">
          <div className="text-[10px] font-black text-slate-800 uppercase tracking-[0.4em] px-6 py-5 border-b-2 border-slate-100 flex items-center gap-3 bg-slate-50/30">
            <div className="h-2 w-2 rounded-full bg-emerald-600" />
            Rincian Performa
          </div>
          <div className="divide-y-2 divide-slate-50 px-2">
            {data.map((cat, idx) => (
              <div key={cat.name} className="px-4 py-5 hover:bg-slate-50 flex items-center gap-5">
                <div className="h-11 w-11 rounded-2xl flex items-center justify-center border-2 shadow-sm shrink-0" style={{ borderColor: `${COLORS[idx % COLORS.length]}40`, backgroundColor: `${COLORS[idx % COLORS.length]}10` }}>
                   <div className="h-4 w-4 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-[14px] font-black text-slate-900 uppercase tracking-tight truncate mb-1 leading-none">{cat.name}</h4>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{cat.count} UNIT TERJUAL</p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[15px] font-black text-slate-900 leading-none mb-1.5 tracking-tight">Rp{cat.revenue.toLocaleString('id-ID')}</div>
                  <div className="text-[8px] font-black text-indigo-700 uppercase tracking-widest py-0.5 px-2 bg-indigo-50 rounded border border-indigo-100 inline-block">
                    {((cat.revenue / totalRevenue) * 100).toFixed(1)}% KONTRIBUSI
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {!loading && data.length > 0 && (
          <div className="p-6">
            <div className="p-6 bg-slate-50 rounded-3xl border-2 border-slate-200 flex items-start gap-4 shadow-sm">
              <Info className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
              <p className="text-[10px] font-black text-slate-700 uppercase leading-relaxed tracking-wide">
                Kategori <span className="text-slate-900 underline decoration-indigo-400 decoration-2 underline-offset-4">{data[0].name}</span> merupakan penyumbang omzet terbesar. Pertimbangkan untuk memperbanyak variasi produk di kategori ini.
              </p>
            </div>
          </div>
        )}
      </div>
    </ReportLayout>
  );
}
