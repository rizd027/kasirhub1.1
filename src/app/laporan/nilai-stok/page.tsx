'use client';

import { useEffect, useState } from 'react';
import { ReportLayout } from '@/features/reports/ReportLayout';
import { db, LocalProduct } from '@/lib/dexie';
import { Badge } from '@/components/ui/badge';
import { Package, Boxes, Store, Warehouse, Search, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

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

  return (
    <ReportLayout title="Laporan Nilai Stok">
      <div className="space-y-0 pb-10">
        {/* Total Value Card */}
        <div className="bg-indigo-600 px-6 py-10 text-white relative overflow-hidden">
          <Boxes className="absolute right-[-10px] bottom-[-10px] h-32 w-32 text-white/10 -rotate-12" />
          <div className="relative z-10">
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] opacity-80">Total Aset Barang</h3>
            <div className="mt-2 text-3xl font-semibold">
              Rp {totalNilai.toLocaleString('id-ID')}
            </div>
            <p className="text-[10px] font-semibold opacity-80 mt-1 uppercase tracking-tight">
              Dihitung berdasarkan (Harga Modal x Total Stok)
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative px-6 py-4 bg-white border-b border-slate-100">
          <Search className="absolute left-9 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input 
            placeholder="Cari produk atau SKU..."
            className="pl-10 h-11 bg-slate-50 border-none shadow-none rounded-xl text-sm focus-visible:ring-indigo-500 font-medium"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Product List */}
        <div className="bg-white pb-10">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest px-6 py-4 border-b border-slate-100 flex justify-between">
            <span>{filteredProducts.length} Produk</span>
            <span>Nilai Aset</span>
          </div>

          {loading ? (
             <div className="py-20 flex justify-center"><div className="h-6 w-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>
          ) : filteredProducts.length === 0 ? (
            <div className="bg-white p-12 flex flex-col items-center text-center gap-3">
              <Package className="h-8 w-8 text-slate-200" />
              <p className="text-xs font-semibold text-slate-400 uppercase">Tidak ada produk ditemukan</p>
            </div>
          ) : (
            filteredProducts.map((p) => {
              const totalStok = (p.stock_store || 0) + (p.stock_warehouse || 0);
              const nilai = p.price_cost * totalStok;
              return (
                <div key={p.id} className="px-6 py-5 border-b border-slate-50 flex flex-col gap-4">
                  <div className="flex justify-between items-start">
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-semibold text-slate-800 truncate">{p.name}</h4>
                      <div className="flex items-center gap-2 mt-1">
                         <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight">{p.sku}</span>
                         <span className="text-slate-200">•</span>
                         <span className="text-[10px] font-semibold text-indigo-600 uppercase tracking-tight">Modal: Rp {p.price_cost.toLocaleString('id-ID')}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-semibold text-slate-800">Rp {nilai.toLocaleString('id-ID')}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500">
                      <Store className="h-3 w-3" />
                      <span>Toko:</span>
                      <span className="text-slate-800 font-semibold">{p.stock_store}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500">
                      <Warehouse className="h-3 w-3" />
                      <span>Gudang:</span>
                      <span className="text-slate-800 font-semibold">{p.stock_warehouse}</span>
                    </div>
                    <div className="ml-auto bg-slate-50 px-2 py-0.5 rounded text-[10px] font-semibold text-slate-400 uppercase tracking-tighter">
                      Total: {totalStok}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-start gap-3 mx-4 mb-10">
          <Info className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
          <p className="text-[10px] font-semibold text-slate-400 uppercase leading-relaxed tracking-tight">
            Nilai stok dihitung berdasarkan harga modal terakhir yang diinput pada menu Data Produk. Pastikan harga modal selalu diperbarui.
          </p>
        </div>
      </div>
    </ReportLayout>
  );
}
