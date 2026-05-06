'use client';

import { useEffect, useState } from 'react';
import { ReportLayout } from '@/features/reports/ReportLayout';
import { db, LocalProduct } from '@/lib/dexie';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, PackageSearch, Store, Warehouse, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function StokKritisPage() {
  const [criticalProducts, setCriticalProducts] = useState<LocalProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCritical = async () => {
      const allProducts = await db.products.toArray();
      // Get global threshold from localStorage or default to 10
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

  return (
    <ReportLayout title="Laporan Stok Kritis">
      <div className="space-y-0 pb-10">
        {/* Info Card */}
        <div className="bg-red-50 border-b border-red-100 p-6 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-red-800">Segera Re-stock!</h3>
            <p className="text-xs text-red-600 font-medium leading-relaxed mt-1">
              Daftar di bawah ini adalah produk dengan total stok yang sudah mencapai atau di bawah ambang batas (threshold).
            </p>
          </div>
        </div>

        {/* Product List */}
        <div className="bg-white pb-10">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest px-6 py-4 border-b border-slate-100 flex justify-between">
            <span>{criticalProducts.length} Produk Kritis</span>
            <span>Total Stok</span>
          </div>

          {loading ? (
             <div className="py-20 flex justify-center">
               <div className="h-6 w-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
             </div>
          ) : criticalProducts.length === 0 ? (
            <div className="bg-white p-12 flex flex-col items-center text-center gap-3">
              <PackageSearch className="h-8 w-8 text-emerald-200" />
              <p className="text-xs font-semibold text-slate-400 uppercase">Semua stok aman</p>
            </div>
          ) : (
            criticalProducts.map((p) => {
              const totalStok = (p.stock_store || 0) + (p.stock_warehouse || 0);
              return (
                <Link 
                  key={p.id} 
                  href={`/settings/stock?sku=${p.sku}`}
                  className="px-6 py-5 border-b border-slate-50 flex items-center gap-4 active:bg-slate-50 transition-colors"
                >
                  <div className="h-10 w-10 rounded-xl bg-red-50 text-red-500 flex items-center justify-center shrink-0">
                    <AlertCircle className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-slate-800 truncate">{p.name}</h4>
                    <div className="flex items-center gap-2 mt-1">
                       <span className="text-[10px] font-medium text-slate-400 uppercase tracking-tight">{p.sku}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xl font-semibold text-red-600">{totalStok}</div>
                    <div className="text-[8px] font-semibold text-slate-300 uppercase tracking-tighter text-right">Unit Sisa</div>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>
    </ReportLayout>
  );
}
