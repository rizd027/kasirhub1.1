'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { 
  ChevronRight, TrendingUp, DollarSign, ShoppingBag, 
  Wallet, BarChart3, PackageSearch, AlertCircle, 
  LayoutGrid, PieChart, ArrowUpRight, Download,
  MoreVertical, FileText, FileSpreadsheet, FileBox
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { db } from '@/db/dexie';
import { format, subDays, startOfDay, isAfter, isToday, startOfMonth } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { ReportStatCard } from '@/features/reports/ReportStatCard';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const SalesChart = dynamic(() => import('@/features/reports/SalesChart').then(mod => mod.SalesChart), { ssr: false });
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
    title: 'Pengeluaran', 
    description: 'Catat biaya operasional & gaji',
    href: '/laporan/pengeluaran',
    icon: DollarSign,
    color: 'text-rose-500',
    bg: 'bg-rose-50'
  },
  { 
    title: 'Laporan Laba', 
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
      const txProfit = tx.items.reduce((p, item) => p + ((item.price_at_time - (item.cost_at_time || 0)) * item.quantity), 0);
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
          <div className="text-center">
            <p className="text-xs font-black uppercase tracking-widest text-slate-400">Menunggu Verifikasi...</p>
          </div>
        </div>
      )}

      <div className="flex flex-col min-h-screen">
        <header className="flex items-center justify-between px-6 h-14 bg-white border-b sticky top-0 z-40">
          <div className="flex-1" />
          <h1 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-900">Laporan Keuangan</h1>
          <div className="flex-1 flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-900 hover:bg-slate-50 outline-none border border-slate-200">
            <MoreVertical className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 rounded-lg p-1 shadow-2xl border-2 border-slate-300 animate-none bg-white z-[100]">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-3 py-2">Ekspor Laporan</DropdownMenuLabel>
              <DropdownMenuSeparator className="mx-1 bg-slate-100" />
              <DropdownMenuItem 
                onClick={exportReportPDF}
                className="flex items-center gap-3 py-2.5 px-3 rounded-lg cursor-pointer focus:bg-red-50 focus:text-red-700 outline-none"
              >
                <FileText className="h-4 w-4 shrink-0 text-red-500" />
                <span className="text-[10px] font-black uppercase tracking-wider">Simpan PDF</span>
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={exportReportExcel}
                className="flex items-center gap-3 py-2.5 px-3 rounded-lg cursor-pointer focus:bg-emerald-50 focus:text-emerald-700 outline-none"
              >
                <FileSpreadsheet className="h-4 w-4 shrink-0 text-emerald-600" />
                <span className="text-[10px] font-black uppercase tracking-wider">Simpan Excel</span>
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={exportReportWord}
                className="flex items-center gap-3 py-2.5 px-3 rounded-lg cursor-pointer focus:bg-blue-50 focus:text-blue-700 outline-none"
              >
                <FileBox className="h-4 w-4 shrink-0 text-blue-600" />
                <span className="text-[10px] font-black uppercase tracking-wider">Simpan Word</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
      </header>

      <div className="flex-1 overflow-auto bg-white">
        {/* Dashboard Section - High Contrast */}
        <section className="px-6 py-4 bg-slate-50/50 border-b-2 border-slate-300">
          <div className="flex flex-col gap-1 mb-6">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em]">Penjualan Hari Ini</span>
            <h2 className="text-4xl font-black text-slate-900 tracking-tighter">
              Rp {stats.todaySales.toLocaleString('id-ID')}
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-0 border-t-2 border-slate-300 divide-x-2 divide-slate-300">
            {/* Laba Bulan Ini */}
            <div className="py-5 pr-4 flex flex-col gap-1">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-3 w-3 text-emerald-600" />
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Laba Bulan Ini</span>
              </div>
              <div className="text-xl font-black text-slate-900 tracking-tight">
                Rp {stats.monthProfit.toLocaleString('id-ID')}
              </div>
              <div className="text-[9px] font-black text-emerald-600 mt-1 uppercase tracking-tighter">
                Naik +12% dari bln lalu
              </div>
            </div>

            {/* Total Transaksi */}
            <div className="py-5 pl-6 flex flex-col gap-1">
              <div className="flex items-center gap-2 mb-1">
                <ShoppingBag className="h-3 w-3 text-indigo-600" />
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Transaksi</span>
              </div>
              <div className="text-xl font-black text-slate-900 tracking-tight">
                {stats.monthTransactions.toLocaleString('id-ID')}
              </div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Lunas & Tempo</p>
            </div>
          </div>

          {/* Chart Section - Sharp Lines */}
          <div className="py-8 border-t-2 border-slate-300">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-indigo-600" />
                <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em]">Tren 7 Hari Terakhir</h3>
              </div>
              <BarChart3 className="h-4 w-4 text-slate-300" />
            </div>
            <div className="h-[180px] w-full">
              <SalesChart data={stats.chartData} />
            </div>
          </div>
        </section>

        {/* List Reports - Line Separated & Box-less */}
        <section className="bg-white">
          <div className="px-6 py-4 border-b-2 border-slate-100 bg-slate-50/30 flex items-center gap-2">
             <div className="h-1.5 w-1.5 rounded-full bg-indigo-600" />
             <h3 className="text-[10px] font-black text-slate-800 uppercase tracking-[0.3em]">Menu Laporan</h3>
          </div>
          <div className="divide-y-2 divide-slate-50 px-2">
            {reportMenus.map((menu) => (
              <Link 
                key={menu.href}
                href={menu.href}
                className="group flex items-center gap-5 p-4 hover:bg-slate-50"
              >
                <div className={cn("size-10 rounded-lg flex items-center justify-center shrink-0 border-2 border-slate-100 shadow-sm", menu.bg, menu.color)}>
                  <menu.icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-black text-slate-900 tracking-tight uppercase leading-none mb-1.5">
                    {menu.title}
                  </div>
                  <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest truncate">
                    {menu.description}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-indigo-600" />
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  </div>
  );
}

