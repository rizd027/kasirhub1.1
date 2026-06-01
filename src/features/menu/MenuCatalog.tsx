'use client';

import { useState, useEffect, useCallback } from 'react';
import { anonSupabase } from '@/services/supabase';
import { ShoppingCart, Plus, Minus, Trash2, Send, CheckCircle2, ChevronLeft, Package, HelpCircle, X, Boxes } from 'lucide-react';
import { cn } from '@/lib/utils';
import { aiToast } from '@/services/aiService';

interface PublicProduct {
  id: string;
  name: string;
  price_sell: number;
  image_url: string | null;
  stock_store: number;
  category_id: string | null;
  is_bundle?: boolean;
  bundle_items?: any[];
}

interface CartItem {
  product: PublicProduct;
  quantity: number;
}

type OrderStatus = 'idle' | 'submitting' | 'success' | 'error';

interface MenuCatalogProps {
  initialUid?: string | null;
  slug?: string | null;
}

export function MenuCatalog({ initialUid, slug }: MenuCatalogProps) {
  const [uid, setUid] = useState<string | null>(initialUid || null);
  const [products, setProducts] = useState<PublicProduct[]>([]);
  const [shopName, setShopName] = useState<string>('Menu Digital');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [tableInput, setTableInput] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [orderStatus, setOrderStatus] = useState<OrderStatus>('idle');
  const [orderId, setOrderId] = useState<string | null>(null);
  const [buyerId, setBuyerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Handle system back button for modals
  useEffect(() => {
    const handleBackButton = (e: PopStateEvent) => {
      if (cartOpen || showHelp) {
        e.preventDefault();
        setCartOpen(false);
        setShowHelp(false);
        window.history.pushState(null, '', window.location.href);
      }
    };
    if (cartOpen || showHelp) {
      window.history.pushState(null, '', window.location.href);
      window.addEventListener('popstate', handleBackButton);
    }
    return () => window.removeEventListener('popstate', handleBackButton);
  }, [cartOpen, showHelp]);

  // Auth
  useEffect(() => {
    const initAuth = async () => {
      try {
        const { data, error: authError } = await anonSupabase.auth.signInAnonymously();
        if (authError) throw authError;
        setBuyerId(data.user?.id ?? null);
      } catch (err) {
        console.error('Anonymous auth failed:', err);
      }
    };
    initAuth();
  }, []);

  // Fetch Data by UID or SLUG
  useEffect(() => {
    const fetchData = async () => {
      try {
        let activeUid = uid;

        // If no UID, try to find it via SLUG
        if (!activeUid && slug) {
          const { data: profileBySlug, error: slugError } = await anonSupabase
            .from('profiles')
            .select('id, store_name')
            .eq('slug', slug.toLowerCase().trim())
            .maybeSingle(); // Use maybeSingle to avoid 406 errors on 0 results
          
          if (slugError) {
            console.error('Slug lookup error:', slugError);
            throw new Error('Gagal menyambung ke database.');
          }

          if (profileBySlug) {
            activeUid = profileBySlug.id;
            setUid(activeUid);
            if (profileBySlug.store_name) setShopName(profileBySlug.store_name);
          } else {
            setError('Toko tidak ditemukan. Pastikan URL sudah disimpan di Pengaturan Toko.');
            setLoading(false);
            return;
          }
        }

        if (!activeUid) {
          setError('QR Code tidak valid atau URL salah.');
          setLoading(false);
          return;
        }

        // Fetch shop profile (if not already set by slug)
        if (shopName === 'Menu Digital') {
          const { data: profileData } = await anonSupabase
            .from('profiles')
            .select('full_name, store_name')
            .eq('id', activeUid)
            .maybeSingle();
          
          setShopName(profileData?.store_name || profileData?.full_name || 'Menu Digital');
        }

        // Fetch products
        const { data: prodData, error: prodError } = await anonSupabase
          .from('products')
          .select('id, name, price_sell, image_url, stock_store, category_id')
          .eq('user_id', activeUid)
          .is('deleted_at', null)
          .gt('stock_store', 0)
          .order('name');

        if (prodError) throw prodError;

        // Fetch bundles
        const { data: bundleData, error: bundleError } = await anonSupabase
          .from('bundling')
          .select('*')
          .eq('user_id', activeUid)
          .eq('is_active', true)
          .is('deleted_at', null)
          .order('name');

        let allProducts: PublicProduct[] = prodData || [];

        if (bundleData && bundleData.length > 0) {
          const bundlesAsProducts = bundleData.map((bundle: any) => ({
            id: `bundle-${bundle.id}`,
            name: bundle.name,
            price_sell: Number(bundle.price_sell),
            image_url: null,
            stock_store: 999999, // Bypass stock check for bundles
            category_id: 'bundling',
            is_bundle: true,
            bundle_items: bundle.products
          }));
          allProducts = [...allProducts, ...bundlesAsProducts as any];
        }

        setProducts(allProducts);
      } catch (err: any) {
        setError('Gagal memuat katalog. Periksa koneksi internet Anda.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [uid, slug]);

  const addToCart = useCallback((product: PublicProduct) => {
    setCart(prev => {
      const existing = prev.find(c => c.product.id === product.id);
      if (existing) {
        return prev.map(c => c.product.id === product.id ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...prev, { product, quantity: 1 }];
    });
  }, []);

  const updateQty = useCallback((productId: string, delta: number) => {
    setCart(prev => {
      return prev
        .map(c => c.product.id === productId ? { ...c, quantity: c.quantity + delta } : c)
        .filter(c => c.quantity > 0);
    });
  }, []);

  const totalItems = cart.reduce((s, c) => s + c.quantity, 0);
  const totalPrice = cart.reduce((s, c) => s + c.product.price_sell * c.quantity, 0);

  const handleSubmitOrder = async () => {
    if (cart.length === 0 || !uid) return;
    if (!tableInput.trim() && !customerName.trim()) return;

    setOrderStatus('submitting');
    try {
      const items = cart.map(c => ({
        product_id: c.product.id,
        name: c.product.name,
        price: c.product.price_sell,
        quantity: c.quantity,
      }));

      const { data, error: insertError } = await anonSupabase
        .from('customer_orders')
        .insert({
          user_id: uid,
          buyer_id: buyerId,
          table_number: tableInput.trim() || null,
          customer_name: customerName.trim() || null,
          items,
          status: 'pending',
        })
        .select('id')
        .single();

      if (insertError) throw insertError;
      setOrderId(data.id);
      setOrderStatus('success');
      setCart([]);
      setCartOpen(false);
    } catch (err: any) {
      console.error('Order submission error:', err);
      setOrderStatus('error');
      // If error is 403/401, it's likely RLS. If 400, it's payload or schema.
      const errorMsg = err.message || 'Gagal mengirim pesanan. Silakan coba lagi.';
      aiToast.error('Gagal: ' + errorMsg);
      setTimeout(() => setOrderStatus('idle'), 3000);
    }
  };

  if (orderStatus === 'success') {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
        <div className="w-24 h-24 rounded-[32px] bg-emerald-50 border border-emerald-100 flex items-center justify-center mb-6">
          <CheckCircle2 className="size-12 text-emerald-500" />
        </div>
        <h1 className="text-2xl font-black text-slate-800 mb-2">Pesanan Terkirim!</h1>
        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-8">
          Mohon tunggu, staf kami sedang memproses
        </p>
        <div className="w-full max-w-xs bg-slate-50 rounded-lg border border-slate-100 p-6 text-left space-y-3">
          {tableInput && (
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nomor Meja</span>
              <span className="text-sm font-black text-slate-800">{tableInput}</span>
            </div>
          )}
          {customerName && (
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nama</span>
              <span className="text-sm font-black text-slate-800">{customerName}</span>
            </div>
          )}
          <div className="flex items-center justify-between border-t border-slate-100 pt-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Status</span>
            <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">Menunggu Konfirmasi</span>
          </div>
        </div>
        <button
          onClick={() => { setOrderStatus('idle'); setTableInput(''); setCustomerName(''); }}
          className="mt-8 px-8 py-3 rounded-lg bg-slate-100 text-slate-600 font-black text-sm uppercase tracking-widest hover:bg-slate-200 transition-colors"
        >
          Pesan Lagi
        </button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
        <div className="w-20 h-20 rounded-[28px] bg-red-50 border border-red-100 flex items-center justify-center mb-6">
          <Package className="size-10 text-red-400" />
        </div>
        <h1 className="text-xl font-black text-slate-800 mb-2">Oops!</h1>
        <p className="text-sm text-slate-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-32">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Menu Digital</p>
          <h1 className="text-base font-black text-slate-800 leading-tight">{shopName}</h1>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowHelp(true)} className="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors">
            <HelpCircle className="size-5" />
          </button>
          {totalItems > 0 && (
            <button onClick={() => setCartOpen(true)} className="relative flex items-center gap-2 bg-indigo-600 text-white font-black text-xs px-4 py-2.5 rounded-lg shadow-lg shadow-indigo-200 active:scale-95 transition-all">
              <ShoppingCart className="size-4" />
              <span>{totalItems}</span>
            </button>
          )}
        </div>
      </div>
      {/* Main Content - Responsive Desktop Layout */}
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-6 p-5">
        {/* Desktop Sidebar Navigation (lg+) */}
        <aside className="hidden lg:flex w-64 flex-col gap-4 shrink-0">
          <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm sticky top-24">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-6">Navigasi</h3>
            <div className="space-y-2">
              <button onClick={() => setShowHelp(true)} className="w-full flex items-center gap-3 p-3 rounded-lg bg-slate-50 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-all font-bold text-xs">
                <HelpCircle className="size-4" /> Bantuan Pesan
              </button>
              {totalItems > 0 && (
                <button onClick={() => setCartOpen(true)} className="w-full flex items-center justify-between p-3 rounded-lg bg-indigo-600 text-white shadow-lg shadow-indigo-100 font-bold text-xs">
                  <div className="flex items-center gap-3">
                    <ShoppingCart className="size-4" /> Keranjang
                  </div>
                  <span className="bg-white/20 px-2 py-0.5 rounded-lg">{totalItems}</span>
                </button>
              )}
            </div>
            
            <div className="mt-8 pt-8 border-t border-slate-50">
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest leading-relaxed">
                Pilih menu favorit Anda dan kirim pesanan langsung ke kasir kami.
              </p>
            </div>
          </div>
        </aside>

        {/* Product Grid - Responsive Columns */}
        <div className="flex-1">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1,2,3,4,5,6].map(i => (
                <div key={i} className="h-28 bg-white rounded-lg border border-slate-100 animate-pulse" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
              <Package className="size-12 text-slate-200 mb-4" />
              <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Belum ada produk tersedia</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {products.map(product => {
                const inCart = cart.find(c => c.product.id === product.id);
                return (
                  <div key={product.id} className="bg-white rounded-lg border border-slate-100 flex items-center gap-4 p-4 shadow-sm hover:shadow-md hover:border-indigo-100 transition-all group">
                    <div className="w-20 h-20 rounded-lg flex-shrink-0 overflow-hidden">
                      {product.is_bundle ? (
                        <PublicBundleImageCollage 
                          productIds={product.bundle_items?.map((item: any) => item.product_id) || []}
                          allProducts={products}
                          className="w-full h-full"
                        />
                      ) : product.image_url ? (
                        <img src={product.image_url} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-slate-50 border border-slate-100 rounded-lg">
                          <Package className="size-8 text-slate-300" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-black text-slate-800 truncate">{product.name}</p>
                        {product.is_bundle && (
                          <span className="shrink-0 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest bg-indigo-600 text-white rounded-md">
                            Paket
                          </span>
                        )}
                      </div>
                      <p className="text-base font-black text-indigo-600 mt-0.5">
                        Rp {product.price_sell.toLocaleString('id-ID')}
                      </p>
                    </div>
                    {inCart ? (
                      <div className="flex flex-col items-center gap-1">
                        <button onClick={() => updateQty(product.id, 1)} disabled={inCart.quantity >= product.stock_store} className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center active:scale-90 transition-all disabled:opacity-40">
                          <Plus className="size-4" />
                        </button>
                        <span className="text-xs font-black text-slate-800">{inCart.quantity}</span>
                        <button onClick={() => updateQty(product.id, -1)} className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 active:scale-90 transition-all">
                          <Minus className="size-4" />
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => addToCart(product)} className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center active:scale-90 transition-all hover:bg-indigo-600 hover:text-white hover:border-indigo-600 shadow-sm">
                        <Plus className="size-5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modals & Overlays (Help, Cart) simplified for clarity */}
      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowHelp(false)} />
          <div className="relative w-full max-w-sm bg-white rounded-lg shadow-2xl overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-indigo-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
                  <HelpCircle className="size-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-800">Cara Pesan</h2>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Panduan Pelanggan</p>
                </div>
              </div>
              <button onClick={() => setShowHelp(false)} className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-slate-400 hover:bg-slate-100">
                <X className="size-4" />
              </button>
            </div>
            <div className="p-6 divide-y divide-slate-100">
              {[
                { step: '1', title: 'Pilih Menu', desc: 'Tekan tombol (+) pada menu yang ingin dipesan untuk memasukkan ke keranjang.' },
                { step: '2', title: 'Buka Keranjang', desc: 'Klik tombol keranjang berwarna ungu di pojok kanan atas.' },
                { step: '3', title: 'Isi Identitas', desc: 'Masukkan nomor meja Anda atau nama Anda agar staf mudah mencari Anda.' },
                { step: '4', title: 'Kirim & Tunggu', desc: 'Tekan Kirim Pesanan. Staf kami akan mengkonfirmasi dan mengantarkan pesanan.' },
              ].map((s) => (
                <div key={s.step} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                  <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 font-black text-xs flex items-center justify-center shrink-0">
                    {s.step}
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-800">{s.title}</h3>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed mt-1">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {cartOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white">
          <div className="flex items-center gap-4 px-5 py-4 border-b border-slate-100">
            <button onClick={() => setCartOpen(false)} className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center">
              <ChevronLeft className="size-5 text-slate-600" />
            </button>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Keranjang Saya</p>
              <h2 className="text-base font-black text-slate-800">{totalItems} Item</h2>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            {cart.map(c => (
              <div key={c.product.id} className="flex items-center gap-4 bg-slate-50 rounded-lg p-4 border border-slate-100">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-slate-800 truncate">{c.product.name}</p>
                  <p className="text-xs font-black text-indigo-600">Rp {c.product.price_sell.toLocaleString('id-ID')} × {c.quantity}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => updateQty(c.product.id, -1)} className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center active:scale-90">
                    {c.quantity === 1 ? <Trash2 className="size-3.5 text-red-400" /> : <Minus className="size-3.5 text-slate-600" />}
                  </button>
                  <span className="text-sm font-black w-5 text-center">{c.quantity}</span>
                  <button onClick={() => updateQty(c.product.id, 1)} className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center active:scale-90">
                    <Plus className="size-3.5" />
                  </button>
                </div>
              </div>
            ))}

            <div className="bg-white border border-slate-100 rounded-lg p-5 space-y-4">
              <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-500">Info Pemesan</h3>
              <div className="space-y-1">
                <label htmlFor="table-number" className="sr-only">Nomor Meja</label>
                <input 
                  id="table-number"
                  name="table-number"
                  type="text" 
                  value={tableInput} 
                  onChange={e => setTableInput(e.target.value)} 
                  placeholder="Nomor Meja" 
                  className="w-full h-11 border-b border-slate-200 font-bold text-sm outline-none" 
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="customer-name" className="sr-only">Nama Anda</label>
                <input 
                  id="customer-name"
                  name="customer-name"
                  type="text" 
                  value={customerName} 
                  onChange={e => setCustomerName(e.target.value)} 
                  placeholder="Nama Anda" 
                  className="w-full h-11 border-b border-slate-200 font-bold text-sm outline-none" 
                />
              </div>
            </div>
          </div>

          <div className="p-5 border-t border-slate-100 bg-white space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Total Pesanan</span>
              <span className="text-xl font-black text-indigo-600">Rp {totalPrice.toLocaleString('id-ID')}</span>
            </div>
            <button onClick={handleSubmitOrder} disabled={orderStatus === 'submitting' || (!tableInput.trim() && !customerName.trim())} className="w-full h-14 rounded-lg bg-indigo-600 text-white font-black text-sm uppercase tracking-widest active:scale-[0.98]">
              {orderStatus === 'submitting' ? 'Mengirim...' : 'Kirim Pesanan'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PublicBundleImageCollage({ 
  productIds, 
  allProducts, 
  className 
}: { 
  productIds: string[]; 
  allProducts: PublicProduct[]; 
  className?: string;
}) {
  // Find images from the already loaded allProducts list
  const foundImages = productIds
    .map(id => allProducts.find(p => p.id === id)?.image_url)
    .filter((img): img is string => !!img);

  if (foundImages.length === 0) {
    return (
      <div className={cn("bg-slate-50 flex items-center justify-center rounded-lg border border-slate-100 group-hover:bg-indigo-50/50 transition-colors", className)}>
        <Boxes className="size-6 text-slate-300 group-hover:text-indigo-400" />
      </div>
    );
  }

  const displayImages = foundImages.slice(0, 4);
  const count = displayImages.length;

  return (
    <div className={cn("relative rounded-lg overflow-hidden border border-slate-100 bg-white grid", 
      count === 1 ? "grid-cols-1" : "grid-cols-2",
      className
    )}>
      {displayImages.map((src, idx) => (
        <div 
          key={idx} 
          className={cn(
            "relative overflow-hidden bg-slate-50",
            count === 3 && idx === 0 ? "row-span-2 animate-in fade-in duration-300" : "animate-in fade-in duration-300"
          )}
        >
          <img 
            src={src} 
            alt="Product" 
            loading="lazy"
            className="w-full h-full object-cover"
          />
        </div>
      ))}
      {foundImages.length > 4 && (
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
          <span className="text-[10px] font-black text-white">+{foundImages.length - 4}</span>
        </div>
      )}
    </div>
  );
}

