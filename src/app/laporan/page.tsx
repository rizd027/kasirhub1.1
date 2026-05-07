'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  ChevronRight, TrendingUp, DollarSign, ShoppingBag, 
  Wallet, BarChart3, PackageSearch, AlertCircle, 
  LayoutGrid, PieChart, ArrowUpRight, Download,
  MoreVertical, FileText, FileSpreadsheet, FileBox
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { db } from '@/lib/dexie';
import { format, subDays, startOfDay, isAfter, isToday, startOfMonth } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { ReportStatCard } from '@/features/reports/ReportStatCard';
import { SalesChart } from '@/features/reports/SalesChart';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import { exportReportPDF, exportReportExcel, exportReportWord } from '@/utils/reportExport';
import { PinDialog } from '@/components/ui/PinDialog';

const reportMenus = [
  { 
    title: 'Arus Kas', 
    description: 'Catatan uang masuk dan keluar',
    href: '/laporan/arus-kas',
    icon: Wallet,
    color: 'text-blue-500',
    bg: 'bg-blue-50'
  },
  { 
    title: 'Laporan Laba Rugi', 
    description: 'Analisis keuntungan bersih bisnis',
    href: '/laporan/laba-rugi',
    icon: TrendingUp,
    color: 'text-emerald-500',
    bg: 'bg-emerald-50'
  },
  { 
    title: 'Rekap Penjualan', 
    description: 'Ringkasan transaksi harian & bulanan',
    href: '/laporan/rekap-harian',
    icon: BarChart3,
    color: 'text-indigo-500',
    bg: 'bg-indigo-50'
  },
  { 
    title: 'Analisis Terlaris', 
    description: 'Produk & jasa yang paling diminati',
    href: '/laporan/analisis-terlaris',
    icon: ShoppingBag,
    color: 'text-amber-500',
    bg: 'bg-amber-50'
  },
  { 
    title: 'Stok Kritis', 
    description: 'Barang yang harus segera di-restok',
    href: '/laporan/stok-kritis',
    icon: AlertCircle,
    color: 'text-red-500',
    bg: 'bg-red-50'
  },
  { 
    title: 'Nilai Stok', 
    description: 'Total aset dalam bentuk barang',
    href: '/laporan/nilai-stok',
    icon: PackageSearch,
    color: 'text-slate-500',
    bg: 'bg-slate-50'
  },
  { 
    title: 'Performa Kategori', 
    description: 'Kontribusi laba per jenis produk',
    href: '/laporan/performa-kategori',
    icon: PieChart,
    color: 'text-violet-500',
    bg: 'bg-violet-50'
  },
];

export default function LaporanPage() {
  const router = useRouter();
  const [stats, setStats] = useState({
    todaySales: 0,
    monthProfit: 0,
    monthTransactions: 0,
    chartData: [] as { day: string; total: number }[]
  });
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);

  const [hasPin, setHasPin] = useState<boolean | null>(null);

  const fetchStats = async () => {
    const allTransactions = await db.transactions.toArray();
    const today = new Date();
    const monthStart = startOfMonth(today);
    
    // Last 7 days chart data
    const last7Days = Array.from({ length: 7 }).map((_, i) => {
      const date = subDays(today, 6 - i);
      const dayName = format(date, 'EEE', { locale: localeId });
      
      // Corrected filter logic for chart
      const txOnDay = allTransactions.filter(tx => 
        format(new Date(tx.created_at), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
      );
      const totalOnDay = txOnDay.reduce((sum, tx) => sum + tx.total_amount, 0);

      return { day: dayName, total: totalOnDay };
    });

    const todayTxs = allTransactions.filter(tx => isToday(new Date(tx.created_at)));
    const monthTxs = allTransactions.filter(tx => isAfter(new Date(tx.created_at), monthStart));

    const todaySales = todayTxs.reduce((sum, tx) => sum + tx.total_amount, 0);
    const monthTransactions = monthTxs.length;
    
    // Simple profit estimation: sum of items (price - cost)
    const monthProfit = monthTxs.reduce((sum, tx) => {
      const txProfit = tx.items.reduce((p, item) => p + ((item.price - (item.cost || 0)) * item.quantity), 0);
      return sum + (txProfit - tx.discount_total);
    }, 0);

    setStats({
      todaySales,
      monthProfit,
      monthTransactions,
      chartData: last7Days
    });
  };

  useEffect(() => {
    const savedPin = localStorage.getItem('kasirhub_app_password');
    if (savedPin) {
      setHasPin(true);
      if (!isAuthorized) {
        setShowPinDialog(true);
      }
    } else {
      setHasPin(false);
      fetchStats();
      reportMenus.forEach(menu => router.prefetch(menu.href));
    }
  }, [router, isAuthorized]);

  if (hasPin === null) return null; // Wait for client check

  return (
    <div className="min-h-screen bg-background">
      {/* PIN Overlay */}
      {!isAuthorized && hasPin && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-50">
          <PinDialog 
            isOpen={showPinDialog}
            onClose={() => {
              // Only redirect if NOT authorized (user clicked X to cancel)
              if (!isAuthorized) router.push('/kasir');
            }}
            onSuccess={() => {
              setIsAuthorized(true);
              setShowPinDialog(false);
              fetchStats();
              reportMenus.forEach(menu => router.prefetch(menu.href));
            }}
            title="Akses Laporan"
            description="Masukkan PIN untuk melihat laporan keuangan dan performa bisnis."
          />
          <div className="text-center animate-pulse">
            <p className="text-xs font-black uppercase tracking-widest text-slate-400">Menunggu Verifikasi...</p>
          </div>
        </div>
      )}

      <div className="flex flex-col min-h-screen">
        <header className="flex items-center justify-between px-6 h-16 bg-background/80 backdrop-blur-md border-b sticky top-0 z-40">
          <div className="flex-1" />
          <h1 className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-800">Laporan</h1>
          <div className="flex-1 flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-50 transition-colors outline-none">
            <MoreVertical className="h-5 w-5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44 rounded-xl p-2 shadow-xl border-slate-100">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2 py-1.5">Ekspor Laporan</DropdownMenuLabel>
              <DropdownMenuSeparator className="my-1 bg-slate-50" />
              <DropdownMenuItem 
                onClick={exportReportPDF}
                className="flex items-start gap-3 py-3 px-2 rounded-lg cursor-pointer focus:bg-indigo-50 focus:text-indigo-600 transition-colors"
              >
                <FileText className="h-4 w-4 mt-0.5 shrink-0 text-red-500" />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold leading-tight">Simpan sebagai PDF</span>
                  <span className="text-[9px] opacity-60 mt-0.5">Format dokumen standar</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={exportReportExcel}
                className="flex items-start gap-3 py-3 px-2 rounded-lg cursor-pointer focus:bg-emerald-50 focus:text-emerald-600 transition-colors"
              >
                <FileSpreadsheet className="h-4 w-4 mt-0.5 shrink-0 text-emerald-600" />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold leading-tight">Simpan sebagai Excel</span>
                  <span className="text-[9px] opacity-60 mt-0.5">Format data & tabel (XLSX)</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={exportReportWord}
                className="flex items-start gap-3 py-3 px-2 rounded-lg cursor-pointer focus:bg-blue-50 focus:text-blue-600 transition-colors"
              >
                <FileBox className="h-4 w-4 mt-0.5 shrink-0 text-blue-600" />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold leading-tight">Simpan sebagai Word</span>
                  <span className="text-[9px] opacity-60 mt-0.5 whitespace-normal">Format dokumen teks (DOCX)</span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
      </header>

      <div>
        {/* Dashboard Section */}
        {/* Dashboard Section - Flat Line Design */}
        <section className="px-6 py-2">
          {/* Today Sales - Main Stat */}
          <div className="py-6 border-b border-slate-200/60 flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Penjualan Hari Ini</span>
              <h2 className="text-3xl font-black text-slate-800 tracking-tighter">
                Rp {stats.todaySales.toLocaleString('id-ID')}
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 py-6 border-b border-slate-200/60">
            {/* Laba Bulan Ini */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-3 w-3 text-emerald-500" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em]">Laba Bulan Ini</span>
              </div>
              <div className="text-lg font-black text-slate-800">
                Rp {stats.monthProfit.toLocaleString('id-ID')}
              </div>
              <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 mt-1">
                <ArrowUpRight className="h-3 w-3" />
                <span>+12%</span>
                <span className="opacity-40 ml-1">vs bln lalu</span>
              </div>
            </div>

            {/* Total Transaksi */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-3 w-3 text-amber-500" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em]">Transaksi</span>
              </div>
              <div className="text-lg font-black text-slate-800">
                {stats.monthTransactions.toString()}
              </div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter mt-1">Bulan ini</p>
            </div>
          </div>

          {/* Chart Section - No Box */}
          <div className="py-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Tren Penjualan</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter mt-1">Analisis 7 Hari Terakhir</p>
              </div>
              <BarChart3 className="h-4 w-4 text-slate-200" />
            </div>
            <div className="h-[200px] w-full">
              <SalesChart data={stats.chartData} />
            </div>
          </div>
        </section>

        <section className="bg-white rounded-t-[32px] mt-2 shadow-[0_-8px_30px_-15px_rgba(0,0,0,0.1)] border-t border-slate-100 overflow-hidden">
          <div className="px-6 pt-6 pb-10">
            <div className="flex flex-col items-center mb-8">
              <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-[0.3em]">Daftar Laporan</h3>
              <div className="w-8 h-1 bg-indigo-400/50 rounded-full mt-2" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
              {reportMenus.map((menu) => (
                <Link 
                  key={menu.href}
                  href={menu.href}
                  className="group flex items-center gap-4 p-4 hover:bg-slate-50 active:bg-slate-100 transition-all rounded-2xl border border-transparent hover:border-slate-100"
                >
                  <div className={cn("size-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm border border-slate-100/50 group-hover:scale-110 transition-transform", menu.bg, menu.color)}>
                    <menu.icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-black text-slate-800 tracking-tight leading-tight">
                      {menu.title}
                    </div>
                    <div className="text-[11px] font-bold text-slate-400 mt-0.5 truncate">
                      {menu.description}
                    </div>
                  </div>
                  <div className="size-8 flex items-center justify-center rounded-full bg-white opacity-0 group-hover:opacity-100 transition-all shadow-sm">
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
  );
}
