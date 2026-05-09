'use client';

import { useEffect, useState } from 'react';
import { ReportLayout } from '@/features/reports/ReportLayout';
import { db, LocalProduct } from '@/db/dexie';
import { 
  Package, Boxes, Store, Warehouse, 
  Search, Info, Download, FileText, FileSpreadsheet 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { exportReportPDF, exportReportExcel } from '@/utils/reportExport';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button, buttonVariants } from '@/components/ui/button';

export default function NilaiStokPage() {
  const [products, setProducts] = useState<LocalProduct[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<LocalProduct[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [totalNilai, setTotalNilai] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    db.products.toArray().then(prods => {
      const active = prods.filter(p => !p.deleted_at);
      setProducts(active);
      setFilteredProducts(active);
      const total = active.reduce((sum, p) => sum + (p.price_cost * (p.stock_store + p.stock_warehouse)), 0);
      setTotalNilai(total);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    const filtered = products.filter(p => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      p.sku.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredProducts(filtered);
  }, [searchQuery, products]);

  const headerActions = (
    <div className="flex items-center gap-2">
      <div className="relative w-[140px] sm:w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
        <Input 
          placeholder="CARI SKU..."
          className="pl-8 h-9 bg-slate-50 border-2 border-slate-300 rounded-xl text-[9px] font-black placeholder:text-slate-400 uppercase tracking-widest text-slate-900 focus-visible:ring-1 focus-visible:ring-indigo-500 focus-visible:border-indigo-500 transition-all shadow-sm"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

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
    <ReportLayout title="Nilai Stok" rightElement={headerActions}>
      <div className="space-y-0 pb-20">
        {/* Summary Section - Sharp & Compact */}
        <div className="px-6 py-6 bg-slate-50/50 border-b-2 border-slate-300">
          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.4em] mb-1">Total Nilai Aset</span>
            <div className="text-4xl font-black text-slate-900 tracking-tighter leading-none mb-4">
              Rp {totalNilai.toLocaleString('id-ID')}
            </div>
            <div className="flex items-center gap-2">
               <div className="h-1.5 w-1.5 rounded-full bg-indigo-600 shadow-[0_0_8px_rgba(79,70,229,0.5)]" />
               <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{products.length} SKU AKTIF TERDATA</span>
            </div>
          </div>
        </div>

        {/* Product List - Line Separated & High Contrast */}
        <div className="bg-white">
          <div className="text-[10px] font-black text-slate-800 uppercase tracking-[0.4em] px-6 py-5 border-b-2 border-slate-100 flex items-center gap-3 bg-slate-50/30">
            <div className="h-2 w-2 rounded-full bg-indigo-600" />
            Daftar Inventori
          </div>

          {loading ? (
             <div className="py-20 flex justify-center"><div className="h-6 w-6 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin" /></div>
          ) : filteredProducts.length === 0 ? (
            <div className="py-32 flex flex-col items-center text-center gap-5">
              <Package className="h-12 w-12 text-slate-200" />
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Produk tidak ditemukan</p>
            </div>
          ) : (
            <div className="divide-y-2 divide-slate-50 px-2">
              {filteredProducts.map((p) => {
                const totalStok = (p.stock_store || 0) + (p.stock_warehouse || 0);
                const nilai = p.price_cost * totalStok;
                return (
                  <div key={p.id} className="px-4 py-6 hover:bg-slate-50">
                    <div className="flex justify-between items-start gap-4 mb-4">
                      <div className="min-w-0 flex-1">
                        <h4 className="text-[14px] font-black text-slate-900 uppercase tracking-tight truncate leading-none mb-2">{p.name}</h4>
                        <div className="flex flex-wrap items-center gap-2">
                           <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-0.5 rounded border border-slate-200 leading-none">{p.sku}</span>
                           <span className="h-1 w-1 rounded-full bg-slate-300" />
                           <span className="text-[9px] font-black text-indigo-700 uppercase tracking-widest leading-none">MODAL Rp{p.price_cost.toLocaleString('id-ID')}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[16px] font-black text-slate-900 leading-none mb-1.5 tracking-tight">Rp{nilai.toLocaleString('id-ID')}</div>
                        <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">NILAI ASET</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-8 py-3 border-t border-slate-100">
                      <div className="flex flex-col">
                        <span className="text-[8px] font-black text-slate-400 uppercase leading-none mb-1.5 tracking-[0.2em]">TOKO</span>
                        <div className="flex items-center gap-1.5">
                          <Store className="h-3.5 w-3.5 text-slate-900" />
                          <span className="text-xs font-black text-slate-900 leading-none">{p.stock_store}</span>
                        </div>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[8px] font-black text-slate-400 uppercase leading-none mb-1.5 tracking-[0.2em]">GUDANG</span>
                        <div className="flex items-center gap-1.5">
                          <Warehouse className="h-3.5 w-3.5 text-slate-900" />
                          <span className="text-xs font-black text-slate-900 leading-none">{p.stock_warehouse}</span>
                        </div>
                      </div>
                      <div className="ml-auto flex flex-col items-end">
                        <span className="text-[8px] font-black text-slate-400 uppercase leading-none mb-1.5 tracking-[0.2em]">TOTAL</span>
                        <div className="text-xs font-black text-indigo-700 uppercase tracking-[0.1em] py-1 px-3 bg-indigo-50 rounded-xl border border-indigo-100 leading-none flex items-center gap-1.5">
                          <Boxes className="h-3 w-3" />
                          {totalStok} UNIT
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Information Note */}
        <div className="p-6">
          <div className="p-6 bg-slate-50 rounded-3xl border-2 border-slate-300 flex items-start gap-4 shadow-sm">
            <Info className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
            <p className="text-[10px] font-black text-slate-700 uppercase leading-relaxed tracking-wide">
              Informasi: Nilai aset adalah <span className="text-slate-900 underline decoration-indigo-400 decoration-2 underline-offset-4">Harga Modal</span> x <span className="text-slate-900 underline decoration-indigo-400 decoration-2 underline-offset-4">Sisa Stok</span> saat ini.
            </p>
          </div>
        </div>
      </div>
    </ReportLayout>
  );
}
