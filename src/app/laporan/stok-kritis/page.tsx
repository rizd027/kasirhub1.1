'use client';

import { useEffect, useState } from 'react';
import { ReportLayout } from '@/features/reports/ReportLayout';
import { db, LocalProduct } from '@/db/dexie';
import { 
  AlertCircle, PackageSearch, Store, Warehouse, 
  ArrowRight, Package, Download, FileText, FileSpreadsheet 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { exportReportPDF, exportReportExcel } from '@/utils/reportExport';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button, buttonVariants } from '@/components/ui/button';

export default function StokKritisPage() {
  const [criticalProducts, setCriticalProducts] = useState<LocalProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCritical = async () => {
      const allProducts = await db.products.toArray();
      const savedThreshold = parseInt(localStorage.getItem('stockThreshold') || '10', 10);
      
      const filtered = allProducts.filter(p => {
        if (p.deleted_at) return false;
        const total = (p.stock_store || 0) + (p.stock_warehouse || 0);
        return total <= savedThreshold;
      });

      setCriticalProducts(filtered.sort((a, b) => 
        ((a.stock_store + a.stock_warehouse)) - ((b.stock_store + b.stock_warehouse))
      ));
      setLoading(false);
    };

    fetchCritical();
  }, []);

  const headerActions = (
    <div className="flex items-center gap-2">
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
    <ReportLayout title="Stok Kritis" rightElement={headerActions}>
      <div className="space-y-0 pb-20">
        {/* Urgent Alert Banner - Sharp & Aggressive */}
        <div className="bg-red-600 px-6 py-6 flex items-start gap-5 shadow-inner">
          <div className="h-11 w-11 rounded-2xl bg-white text-red-600 flex items-center justify-center shrink-0 shadow-xl border-2 border-red-400">
            <AlertCircle className="h-7 w-7" />
          </div>
          <div className="flex flex-col gap-0.5">
            <h3 className="text-[15px] font-black text-white uppercase tracking-wider leading-none">Status Darurat Re-stock</h3>
            <p className="text-[10px] text-red-100 font-bold uppercase tracking-tight opacity-90">
              Produk di bawah ambang batas stok aman terdeteksi.
            </p>
          </div>
        </div>

        {/* Status Counter - High Contrast */}
        <div className="px-6 py-6 bg-slate-50/50 border-b-2 border-slate-300 flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.4em] mb-1">Inventori Bermasalah</span>
            <span className="text-3xl font-black text-slate-900 tracking-tighter leading-none">
              {criticalProducts.length} PRODUK
            </span>
          </div>
          <div className="h-12 w-12 bg-white rounded-2xl border-2 border-slate-200 flex items-center justify-center shadow-sm">
             <Package className="h-6 w-6 text-slate-400" />
          </div>
        </div>

        {/* Product List - Line Separated & Dense */}
        <div className="bg-white">
          <div className="text-[10px] font-black text-slate-800 uppercase tracking-[0.4em] px-6 py-5 border-b-2 border-slate-100 flex items-center gap-3 bg-slate-50/30">
            <div className="h-2 w-2 rounded-full bg-red-600" />
            Daftar Produk Kritis
          </div>

          {loading ? (
             <div className="py-20 flex justify-center">
               <div className="h-6 w-6 border-4 border-slate-200 border-t-red-600 rounded-full animate-spin" />
             </div>
          ) : criticalProducts.length === 0 ? (
            <div className="py-32 flex flex-col items-center text-center gap-5">
              <PackageSearch className="h-12 w-12 text-slate-200" />
              <p className="text-xs font-black text-emerald-600 uppercase tracking-widest">Semua stok terpantau aman</p>
            </div>
          ) : (
            <div className="divide-y-2 divide-slate-50 px-2">
              {criticalProducts.map((p) => {
                const totalStok = (p.stock_store || 0) + (p.stock_warehouse || 0);
                return (
                  <Link 
                    key={p.id} 
                    href={`/stock?sku=${p.sku}`}
                    className="px-4 py-5 hover:bg-red-50 flex items-center gap-5"
                  >
                    <div className="h-11 w-11 rounded-2xl bg-white text-red-600 flex items-center justify-center shrink-0 border-2 border-red-100 shadow-sm">
                      <AlertCircle className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-[13px] font-black text-slate-900 uppercase tracking-tight truncate mb-1.5 leading-none">{p.name}</h4>
                      <div className="flex items-center gap-2">
                         <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-0.5 rounded border border-slate-200">{p.sku}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[20px] font-black text-red-600 leading-none mb-1 tracking-tighter">{totalStok}</div>
                      <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">UNIT SISA</div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </ReportLayout>
  );
}
