'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  ChevronLeft, 
  Layers, 
  X,
  PlusCircle,
  Save,
  Check,
  Loader2,
  TrendingDown,
  Sparkles,
  ArrowRight,
  Trash2,
  AlertCircle,
  History,
  Settings,
  LayoutGrid,
  DollarSign,
  Info,
  Package,
  Plus,
  TrendingUp
} from 'lucide-react';
import { aiToast } from '@/services/aiService';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { db, LocalProduct, Bundling } from '@/db/dexie';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { createId } from '@/utils/uuid';
import { useStaffStore } from '@/store/useStaffStore';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { addToSyncQueue } from '@/services/sync/syncManager';
import { triggerSync } from '@/hooks/useSync';
import { marketBasketService, BundleSuggestion } from '@/services/marketBasketService';

export default function SmartBundlingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bundleId = searchParams.get('id');
  const { session } = useStaffStore();
  const [allProducts, setAllProducts] = useState<LocalProduct[]>([]);
  const [bundleName, setBundleName] = useState('');
  const [selectedItems, setSelectedItems] = useState<{ product_id: string; qty: number; original_price: number; hpp: number }[]>([]);
  const [isLoading, setIsLoading] = useState(!!bundleId);
  const [selectedPrice, setSelectedPrice] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [marketSuggestions, setMarketSuggestions] = useState<BundleSuggestion[]>([]);

  useEffect(() => {
    db.products.toArray().then(products => {
      setAllProducts(products.filter(p => !p.deleted_at));
    });

    if (bundleId) {
      db.bundling.get(bundleId).then(bundle => {
        if (bundle) {
          setBundleName(bundle.name);
          setSelectedItems(bundle.products);
          setSelectedPrice(bundle.price_sell);
        }
        setIsLoading(false);
      });
    }

    marketBasketService.getSuggestions(2).then(setMarketSuggestions);
  }, [bundleId]);

  const addItem = (productId: string) => {
    const p = allProducts.find(prod => prod.id === productId);
    if (!p) return;
    setSelectedItems([...selectedItems, { 
      product_id: productId, 
      qty: 1, 
      original_price: p.price_sell, 
      hpp: p.price_cost || 0 
    }]);
  };

  const removeItem = (idx: number) => {
    const newItems = [...selectedItems];
    newItems.splice(idx, 1);
    setSelectedItems(newItems);
  };

  const totalHpp = useMemo(() => selectedItems.reduce((sum, i) => sum + (i.hpp * i.qty), 0), [selectedItems]);
  const totalNormalPrice = useMemo(() => selectedItems.reduce((sum, i) => sum + (i.original_price * i.qty), 0), [selectedItems]);

  const tiers = useMemo(() => {
    if (selectedItems.length === 0) return [];
    
    // Logic for suggesting prices (mocking the image values roughly but keeping them dynamic based on inputs)
    const baseDiscount1 = 0.8; // 20% off
    const baseDiscount2 = 0.875; // 12.5% off
    const baseDiscount3 = 0.935; // 6.5% off

    const price1 = Math.round((totalNormalPrice * baseDiscount1) / 100) * 100;
    const price2 = Math.round((totalNormalPrice * baseDiscount2) / 100) * 100;
    const price3 = Math.round((totalNormalPrice * baseDiscount3) / 100) * 100;

    return [
      { 
        id: 'hemat', 
        name: 'Paket Hemat', 
        price: price1, 
        margin: ((price1 - totalHpp) / price1) * 100,
        profit: price1 - totalHpp,
        discount: totalNormalPrice - price1,
        desc: '"Menarik pelanggan baru & mendorong volume penjualan tinggi dengan diskon besar."'
      },
      { 
        id: 'seimbang', 
        name: 'Paling Seimbang', 
        price: price2, 
        margin: ((price2 - totalHpp) / price2) * 100,
        profit: price2 - totalHpp,
        discount: totalNormalPrice - price2,
        desc: '"Keseimbangan optimal antara daya tarik harga dan profitabilitas yang sehat."'
      },
      { 
        id: 'profit', 
        name: 'Profit Maksimal', 
        price: price3, 
        margin: ((price3 - totalHpp) / price3) * 100,
        profit: price3 - totalHpp,
        discount: totalNormalPrice - price3,
        desc: '"Memaksimalkan profit per transaksi, cocok untuk pelanggan yang tidak terlalu sensitif harga."'
      }
    ];
  }, [totalHpp, totalNormalPrice, selectedItems]);

  const handleSave = async () => {
    const priceToSave = selectedPrice;
    if (!bundleName) {
      toast.error('Masukkan nama bundling dulu ya');
      return;
    }
    if (!priceToSave || priceToSave === 0) {
      toast.error('Pilih salah satu harga rekomendasi dulu');
      return;
    }

    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      const data: Bundling = {
        id: bundleId || createId(),
        user_id: session?.id || '',
        name: bundleName,
        products: selectedItems,
        price_sell: priceToSave,
        is_active: true,
        created_at: bundleId ? (await db.bundling.get(bundleId))?.created_at || now : now,
        updated_at: now,
        deleted_at: null,
        sync_status: 'pending'
      };
      
      if (bundleId) {
        await db.bundling.put(data);
        await addToSyncQueue('bundling', 'update', data.id, data);
        toast.success('Bundling berhasil diperbarui!');
      } else {
        await db.bundling.add(data);
        await addToSyncQueue('bundling', 'insert', data.id, data);
        toast.success('Bundling berhasil disimpan!');
      }
      
      triggerSync(session?.id).catch(console.error);
      router.push('/paket-bundling');
    } catch (err) {
      toast.error('Gagal menyimpan bundling');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50/50">
      {/* Top Navigation - Product Studio Style */}
      <div className="flex items-center justify-between px-2 sm:px-4 h-14 border-b border-slate-200 sticky top-0 bg-white/80 backdrop-blur-md z-40">
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
          <button
            onClick={() => router.push('/paket-bundling')}
            className="group p-1.5 hover:bg-slate-100 rounded-lg border border-transparent hover:border-slate-200 shrink-0"
            title="Kembali"
          >
            <ChevronLeft className="size-4 text-slate-500 group-hover:text-slate-900" />
          </button>
          <div className="flex flex-col min-w-0 overflow-hidden">
            <h1 className="text-[7px] sm:text-[8px] font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] text-indigo-600 mb-0.5 truncate">Product Studio</h1>
            <p className="text-[11px] sm:text-sm font-black text-slate-900 tracking-tight truncate whitespace-nowrap">
              {bundleId ? 'Perbarui Paket Bundling' : 'Buat Paket Bundling'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-2">
          <div className="hidden md:flex flex-col items-end mr-4">
            <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Engine Status</span>
            <div className="flex items-center gap-1">
              <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[9px] font-black text-indigo-600 uppercase tracking-tight bg-indigo-50 px-2 py-0.5 rounded">Smart Suggestion v2</span>
            </div>
          </div>
          <Button
            variant="ghost"
            onClick={() => router.push('/paket-bundling')}
            className="h-8 sm:h-9 px-2 sm:px-4 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-indigo-600 hover:bg-indigo-50/50 rounded-lg"
          >
            Batal
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || !selectedPrice}
            className="h-8 sm:h-9 px-3 sm:px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold uppercase tracking-widest rounded-lg shadow-sm hover:shadow-md hover:shadow-indigo-100 gap-1.5 sm:gap-2 text-[9px] sm:text-xs"
          >
            {isSaving ? <Loader2 className="size-3 sm:size-3.5 animate-spin" /> : <Save className="size-3 sm:size-3.5" />}
            <span className="hidden sm:inline">{isSaving ? 'Simpan...' : 'Simpan'}</span>
            <span className="sm:hidden">{isSaving ? '...' : 'Simpan'}</span>
          </Button>
        </div>
      </div>

      <main className="flex-1 w-full px-3 py-3">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          
          {/* Left Column: Summary & Controls */}
          <div className="lg:col-span-4 space-y-3">
            {/* Bundle Basic Info Card */}
            <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-[8px] font-black uppercase text-slate-500 tracking-[0.1em] ml-1">Nama Paket Bundling</Label>
                  <Tooltip>
                    <TooltipTrigger className="outline-none">
                      <Info className="size-2.5 text-slate-300 hover:text-indigo-500 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-[10px] bg-slate-900 text-white border-none p-2 shadow-lg">
                      Nama paket yang akan muncul di menu kasir dan struk.
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="relative group">
                  <Package className="absolute left-3 top-1/2 -translate-y-1/2 size-3 text-slate-400 group-focus-within:text-indigo-600" />
                  <Input 
                    value={bundleName}
                    onChange={e => setBundleName(e.target.value)}
                    placeholder="Contoh: Paket Coffee & Cake"
                    className="h-10 pl-9 pr-10 rounded-lg border-slate-200 font-bold bg-slate-50/50 focus:bg-white focus:border-indigo-600 text-[11px]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const bundleNames = ['Paket Kenyang', 'Coffee Morning', 'Snack Time', 'Hemat Banget', 'Double Treat', 'Special Weekend', 'Menu Juara', 'Best Seller Bundle'];
                      setBundleName(bundleNames[Math.floor(Math.random() * bundleNames.length)]);
                      
                      if (allProducts.length >= 2) {
                        const shuffled = [...allProducts].sort(() => 0.5 - Math.random());
                        const selected = shuffled.slice(0, 2 + Math.floor(Math.random() * 2));
                        setSelectedItems(selected.map(p => ({
                          product_id: p.id,
                          qty: 1,
                          original_price: p.price_sell,
                          hpp: p.price_cost || 0
                        })));
                      }
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-focus-within:opacity-100 transition-opacity hover:scale-110 active:scale-95 cursor-pointer z-10 p-1"
                    title="Generate Random"
                  >
                    <Sparkles className="size-4 text-indigo-600 animate-pulse" />
                  </button>
                </div>
              </div>

              <div className="pt-2 space-y-2">
                <div className="flex items-center justify-between p-3 bg-rose-50/50 border border-rose-100 rounded-lg">
                  <div className="flex flex-col">
                    <span className="text-[8px] font-black text-rose-700 uppercase tracking-widest mb-0.5">Total HPP Gabungan</span>
                    <span className="text-sm font-black text-rose-600 tracking-tight">Rp {totalHpp.toLocaleString('id-ID')}</span>
                  </div>
                  <AlertCircle className="size-4 text-rose-400" />
                </div>
                <div className="flex items-center justify-between p-3 bg-emerald-50/50 border border-emerald-100 rounded-lg">
                  <div className="flex flex-col">
                    <span className="text-[8px] font-black text-emerald-700 uppercase tracking-widest mb-0.5">Total Harga Normal</span>
                    <span className="text-sm font-black text-emerald-600 tracking-tight">Rp {totalNormalPrice.toLocaleString('id-ID')}</span>
                  </div>
                  <TrendingUp className="size-4 text-emerald-400" />
                </div>
              </div>
            </div>

            {/* Smart Stats Visualization */}
            <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm overflow-hidden relative group">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10">
                <Sparkles className="size-20 -mr-4 -mt-4 rotate-12 text-indigo-500" />
              </div>
              <div className="relative z-10 space-y-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="size-3 text-indigo-500" />
                  <span className="text-[8px] font-black uppercase tracking-[0.2em] text-indigo-600">Bundling Insights</span>
                </div>
                <div className="space-y-1">
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Potensi Hemat Pelanggan</p>
                  <h3 className="text-xl font-black text-indigo-600 tracking-tight">
                    {totalNormalPrice > 0 ? Math.round(((totalNormalPrice - totalHpp) / totalNormalPrice) * 100) : 0}% 
                    <span className="text-[10px] font-medium text-slate-400 ml-2">(Maksimal)</span>
                  </h3>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Products & AI Suggestions */}
          <div className="lg:col-span-8 space-y-3">
            {/* Section: Market Basket Analysis Suggestions */}
            {marketSuggestions.length > 0 && (
              <div className="bg-indigo-50 border border-indigo-100 rounded-lg overflow-hidden shadow-sm">
                <div className="px-4 py-2 border-b border-indigo-100 flex items-center justify-between bg-indigo-600/5">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="size-3 text-indigo-600" />
                    <h2 className="text-[8px] font-black text-indigo-700 uppercase tracking-[0.2em]">Saran Paket dari Data Penjualan</h2>
                  </div>
                  <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest bg-white px-1.5 py-0.5 rounded border border-indigo-100">Market Basket Analysis</span>
                </div>
                <div className="p-3">
                  <div className="flex flex-nowrap overflow-x-auto gap-2 pb-1 scrollbar-hide">
                    {marketSuggestions.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setBundleName(`Paket ${s.productNames.join(' & ')}`);
                          setSelectedItems(s.productIds.map(id => {
                            const p = allProducts.find(prod => prod.id === id);
                            return {
                              product_id: id,
                              qty: 1,
                              original_price: p?.price_sell || 0,
                              hpp: p?.price_cost || 0
                            };
                          }));
                          aiToast.success("Saran paket diterapkan!");
                        }}
                        className="flex-shrink-0 bg-white border border-indigo-100 hover:border-indigo-400 hover:bg-indigo-50 p-2.5 rounded-lg flex flex-col items-start gap-1 transition-all min-w-[160px] text-left group"
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <div className="size-5 rounded bg-indigo-100 flex items-center justify-center text-indigo-600">
                            <Sparkles className="size-2.5 group-hover:scale-110 transition-transform" />
                          </div>
                          <span className="text-[10px] font-black text-indigo-600 tracking-tight">{Math.round(s.confidence)}% Relevan</span>
                        </div>
                        <p className="text-[10px] font-bold text-slate-800 line-clamp-2 uppercase leading-tight">
                          {s.productNames.join(' + ')}
                        </p>
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">Sering dibeli bersama</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Section: Rincian Paket */}
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
              <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
                <div className="size-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-900 shadow-sm">
                  <LayoutGrid className="size-3" />
                </div>
                <h2 className="text-[9px] font-black text-slate-900 uppercase tracking-[0.2em]">Rincian Produk dalam Paket</h2>
              </div>
              
              <div className="p-4 space-y-2">
                {selectedItems.length === 0 ? (
                  <div className="py-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-lg">
                    <Package className="size-8 text-slate-200 mx-auto mb-2" />
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Belum ada produk terpilih</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {selectedItems.map((item, idx) => {
                      const p = allProducts.find(prod => prod.id === item.product_id);
                      return (
                        <div key={`${item.product_id}-${idx}`} className="flex items-center gap-3 p-3 bg-slate-50/50 border border-slate-100 rounded-lg hover:border-indigo-200 group transition-all">
                          <div className="size-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                            <Package className="size-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-black text-slate-900 uppercase truncate leading-tight">{p?.name || 'Produk'}</p>
                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Harga Normal: Rp {item.original_price.toLocaleString('id-ID')}</p>
                          </div>
                          <button 
                            onClick={() => removeItem(idx)} 
                            className="p-1.5 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
                
                <div className="pt-2">
                  <Select onValueChange={(v) => v && addItem(v as string)} value="">
                    <SelectTrigger className="w-full h-10 rounded-lg border-slate-200 border-dashed bg-slate-50/30 text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50/50 transition-all">
                      <div className="flex items-center justify-center w-full gap-2">
                        <Plus className="size-3.5" />
                        <span>Tambah Produk Ke Bundling</span>
                      </div>
                    </SelectTrigger>
                    <SelectContent className="rounded-lg border-slate-200 shadow-lg p-1">
                      {allProducts.map(p => (
                        <SelectItem key={p.id} value={p.id} className="rounded-lg font-bold text-[11px] py-2.5 cursor-pointer">{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Section: AI Suggestions */}
            <div className={cn(
              "bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm transition-all",
              selectedItems.length < 2 && "opacity-50 grayscale"
            )}>
              <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between bg-indigo-600 text-white">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-3" />
                  <h2 className="text-[9px] font-black uppercase tracking-[0.2em]">Smart Pricing Suggestions</h2>
                </div>
                {selectedItems.length < 2 && (
                  <div className="flex items-center gap-1.5 bg-white/10 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest">
                    <AlertCircle className="size-2.5" /> Minimum 2 Produk
                  </div>
                )}
              </div>

              <div className="p-4">
                {selectedItems.length < 2 ? (
                  <div className="py-12 flex flex-col items-center justify-center text-center space-y-3 bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
                    <Sparkles className="size-10 text-slate-200" />
                    <div className="space-y-1">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Analisa AI Menunggu Data</p>
                      <p className="text-[9px] font-medium text-slate-400 max-w-[200px]">Tambahkan minimal 2 produk untuk memicu kalkulasi strategi bundling.</p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {tiers.map((tier) => (
                      <div 
                        key={tier.id}
                        className={cn(
                          "group p-5 rounded-lg border-2 flex flex-col relative transition-all cursor-pointer",
                          selectedPrice === tier.price
                            ? "border-indigo-600 bg-indigo-50/50 shadow-lg shadow-indigo-100/50 scale-[1.02]" 
                            : tier.id === 'seimbang' && !selectedPrice
                              ? "border-indigo-500 bg-indigo-50/30 shadow-md shadow-indigo-100/50"
                              : "border-slate-100 bg-white hover:border-indigo-200 shadow-sm"
                        )}
                        onClick={() => setSelectedPrice(tier.price)}
                      >
                        {(selectedPrice === tier.price || (tier.id === 'seimbang' && !selectedPrice)) && (
                          <div className="absolute top-0 right-0 p-1.5 bg-indigo-600 text-white rounded-bl-lg">
                            <Check className="size-3" />
                          </div>
                        )}

                        <div className="text-[8px] font-black uppercase tracking-widest text-slate-500 mb-4">{tier.name}</div>
                        
                        <div className="mb-4">
                          <h4 className="text-xl font-black text-slate-900 tracking-tight">Rp {tier.price.toLocaleString('id-ID')}</h4>
                          <p className="text-[9px] font-bold text-slate-400 line-through">Rp {totalNormalPrice.toLocaleString('id-ID')}</p>
                        </div>

                        <div className="space-y-1.5 mb-6">
                          <div className="flex justify-between items-center p-1.5 rounded bg-white/50 border border-slate-100">
                            <span className="text-[8px] font-bold text-slate-400 uppercase">Profit:</span>
                            <span className="text-[10px] font-black text-emerald-600">Rp {tier.profit.toLocaleString('id-ID')}</span>
                          </div>
                          <div className="flex justify-between items-center p-1.5 rounded bg-white/50 border border-slate-100">
                            <span className="text-[8px] font-bold text-slate-400 uppercase">Margin:</span>
                            <span className="text-[10px] font-black text-slate-900">{tier.margin.toFixed(1)}%</span>
                          </div>
                        </div>

                        <p className="text-[9px] font-medium text-slate-500 leading-relaxed italic mb-6 px-1">
                          {tier.desc}
                        </p>
                        
                        <Button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPrice(tier.price);
                          }}
                          className={cn(
                            "w-full h-8 rounded-lg font-black uppercase tracking-widest text-[9px] mt-auto",
                            selectedPrice === tier.price ? "bg-indigo-600 text-white shadow-sm" : "bg-white border border-slate-200 text-slate-900 hover:bg-slate-50"
                          )}
                        >
                          {selectedPrice === tier.price ? 'Harga Terpilih' : 'Pilih Harga'}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Decorative */}
      <div className="fixed bottom-0 right-0 -z-10 p-20 opacity-[0.03] pointer-events-none">
         <Sparkles className="h-96 w-96 text-indigo-600" />
      </div>
    </div>
  );
}
