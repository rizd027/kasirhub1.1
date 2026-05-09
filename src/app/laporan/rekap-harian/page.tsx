'use client';

import { useEffect, useState } from 'react';
import { ReportLayout } from '@/features/reports/ReportLayout';
import { db, LocalTransaction } from '@/db/dexie';
import { format, startOfMonth, endOfMonth, isAfter, isBefore, parseISO, startOfDay, endOfDay } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { 
  Calendar, ReceiptText, ChevronRight, Clock, 
  LayoutGrid, Download, FileText, FileSpreadsheet
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

interface DailyGroup {
  date: string;
  transactions: LocalTransaction[];
  total: number;
  count: number;
}

export default function RekapHarianPage() {
  const [groups, setGroups] = useState<DailyGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState<'today' | 'this_month' | 'all'>('this_month');

  useEffect(() => {
    fetchData();
  }, [filterDate]);

  const fetchData = async () => {
    setLoading(true);
    let txs = await db.transactions.orderBy('created_at').reverse().toArray();
    
    // Filter logic
    const now = new Date();
    if (filterDate === 'today') {
      const start = startOfDay(now);
      const end = endOfDay(now);
      txs = txs.filter(t => {
        const d = parseISO(t.created_at);
        return isAfter(d, start) && isBefore(d, end);
      });
    } else if (filterDate === 'this_month') {
      const start = startOfMonth(now);
      const end = endOfMonth(now);
      txs = txs.filter(t => {
        const d = parseISO(t.created_at);
        return isAfter(d, start) && isBefore(d, end);
      });
    }

    const map = new Map<string, LocalTransaction[]>();
    txs.forEach(tx => {
      const day = format(new Date(tx.created_at), 'yyyy-MM-dd');
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(tx);
    });

    const grouped: DailyGroup[] = [];
    map.forEach((txs, date) => {
      grouped.push({
        date,
        transactions: txs,
        total: txs.reduce((s, t) => s + t.total_amount, 0),
        count: txs.length,
      });
    });

    setGroups(grouped.sort((a, b) => b.date.localeCompare(a.date)));
    setLoading(false);
  };

  const totalOmzet = groups.reduce((s, g) => s + g.total, 0);
  const totalTxs = groups.reduce((s, g) => s + g.count, 0);

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
    <ReportLayout title="Rekap Harian" rightElement={headerActions}>
      <div className="space-y-0 pb-20">
        {/* Quick Summary - Sharp & Compact */}
        <div className="px-6 py-6 bg-slate-50/50 border-b-2 border-slate-300 flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] mb-1">Total Omzet Periode</span>
            <span className="text-3xl font-black text-slate-900 tracking-tighter leading-none">
              Rp {totalOmzet.toLocaleString('id-ID')}
            </span>
            <div className="flex items-center gap-2 mt-2">
               <div className="h-1.5 w-1.5 rounded-full bg-indigo-600" />
               <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">{totalTxs} TRANSAKSI LUNAS</span>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="py-20 flex justify-center"><div className="h-6 w-6 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin" /></div>
        ) : groups.length === 0 ? (
          <div className="py-32 flex flex-col items-center text-center gap-5">
            <ReceiptText className="h-12 w-12 text-slate-200" />
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Belum ada data penjualan</p>
          </div>
        ) : (
          <div className="bg-white">
            <div className="text-[10px] font-black text-slate-800 uppercase tracking-[0.4em] px-6 py-5 border-b-2 border-slate-100 flex items-center gap-3 bg-slate-50/30">
              <div className="h-2 w-2 rounded-full bg-indigo-600" />
              Riwayat Penjualan
            </div>
            <div className="divide-y-2 divide-slate-50 px-2">
              {groups.map((g) => (
                <div key={g.date} className="px-4 py-5 hover:bg-slate-50 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-11 w-11 rounded-2xl bg-slate-50 text-slate-500 flex items-center justify-center border-2 border-slate-100 shrink-0">
                      <Calendar className="h-5 w-5" />
                    </div>
                    <div className="flex flex-col">
                      <h4 className="text-[14px] font-black text-slate-900 uppercase tracking-tight leading-none mb-1.5">
                        {format(new Date(g.date), 'EEEE, dd MMM', { locale: localeId })}
                      </h4>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">{g.count} TRANSAKSI</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[15px] font-black text-slate-900 leading-none mb-1 tracking-tight">
                      Rp {g.total.toLocaleString('id-ID')}
                    </div>
                    <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">OMZET</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </ReportLayout>
  );
}
