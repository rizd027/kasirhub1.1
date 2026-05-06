'use client';

import { useState, useRef, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Barcode, Plus, Minus, Trash2, Search, Tag, AlertCircle, Sparkles, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCartStore } from "@/store/useCartStore";
import { LocalProduct } from "@/lib/dexie";
import { calculateTieredDiscount } from "@/utils/calculations";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { BarcodeScanner } from "./BarcodeScanner";
import { Badge } from "@/components/ui/badge";
import { PinDialog } from "@/components/ui/PinDialog";

import { useStaffStore } from '@/store/useStaffStore';
import { List, LayoutGrid, Maximize2 } from "lucide-react";

export function MinimarketMode({ 
  products, 
  isFullscreen, 
  setViewMode, 
  toggleFullscreen 
}: { 
  products: LocalProduct[], 
  isFullscreen?: boolean,
  setViewMode?: (mode: 'minimarket' | 'resto') => void,
  toggleFullscreen?: () => void
}) {
  const { items, addItem, addCustomItem, updateQuantity, removeItem, updateDiscount } = useCartStore();
  const { session } = useStaffStore();
  const [query, setQuery] = useState('');
  const [isCustomOpen, setIsCustomOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isDiscountOpen, setIsDiscountOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [customForm, setCustomForm] = useState({ name: '', price: '' });
  const [discountForm, setDiscountForm] = useState({ disc1: 0, disc2: 0, nominal: 0, quantity: 1 });
  const [showPin, setShowPin] = useState(false);
  const [pinAction, setPinAction] = useState<{ type: 'custom' | 'discount' | 'delete' | 'decrease', data?: any } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  const handleScan = (decodedText: string) => {
    const product = products.find(p => p.sku === decodedText);
    if (product) {
      addItem(product);
    } else {
      setQuery(decodedText);
      // Optional: sonner notification could be added here
    }
  };

  // Keyboard shortcut F2 to focus
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && query.trim()) {
      const found = products.find(
        p => p.sku === query.trim() || p.name.toLowerCase().includes(query.toLowerCase())
      );
      if (found) {
        addItem(found);
        setQuery('');
      }
    }
  };

  const handleAddCustom = () => {
    if (!customForm.name || !customForm.price) return;

    const savedPin = localStorage.getItem('kasirhub_app_password');
    if (session?.role === 'staff' || savedPin) {
      setPinAction({ type: 'custom', data: { ...customForm } });
      setShowPin(true);
      return;
    }

    performAddCustom(customForm.name, Number(customForm.price));
  };

  const performAddCustom = (name: string, price: number) => {
    addCustomItem(name, price);
    setCustomForm({ name: '', price: '' });
    setIsCustomOpen(false);
  };

  const openDiscount = (id: string) => {
    const item = items.find(i => i.id === id);
    if (!item) return;
    setSelectedItemId(id);
    setDiscountForm({ disc1: item.disc1, disc2: item.disc2, nominal: item.nominalDisc, quantity: item.quantity });
    setIsDiscountOpen(true);
  };

  const handleSaveDiscount = () => {
    if (!selectedItemId) return;
    const item = items.find(i => i.id === selectedItemId);
    if (!item) return;

    const hasDiscount = discountForm.disc1 > 0 || discountForm.disc2 > 0 || discountForm.nominal > 0;
    const isDecreasing = discountForm.quantity < item.quantity;
    const savedPin = localStorage.getItem('kasirhub_app_password');

    if ((hasDiscount || isDecreasing) && (session?.role === 'staff' || savedPin)) {
      setPinAction({ type: isDecreasing ? 'decrease' : 'discount' });
      setShowPin(true);
      return;
    }

    performSaveDiscount();
  };

  const performSaveDiscount = () => {
    if (selectedItemId) {
      if (discountForm.quantity > 0) {
        updateQuantity(selectedItemId, discountForm.quantity);
        updateDiscount(selectedItemId, discountForm.disc1, discountForm.disc2, discountForm.nominal);
      } else {
        removeItem(selectedItemId);
      }
    }
    setIsDiscountOpen(false);
  };

  const handleRemoveItemFromConfig = () => {
    if (!selectedItemId) return;
    const savedPin = localStorage.getItem('kasirhub_app_password');
    if (session?.role === 'staff' || savedPin) {
      setPinAction({ type: 'delete' });
      setShowPin(true);
      return;
    }
    removeItem(selectedItemId);
    setIsDiscountOpen(false);
  };

  const filtered = query
    ? products.filter(
      p => p.sku.includes(query) || p.name.toLowerCase().includes(query.toLowerCase())
    )
    : [];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Search / Scan Input - Fixed at top */}
      <div className="h-16 px-6 border-b flex items-center gap-4 shrink-0 bg-white">
        {/* ... existing search input ... */}
        <div className="relative flex-1 group">
          <button
            type="button"
            className="absolute left-0 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-indigo-600 transition-all z-10 active:scale-90"
            title="Scan barcode dengan kamera"
            onClick={() => setIsScannerOpen(true)}
          >
            <div className="relative">
              <svg 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                className="h-5 w-5"
              >
                <path d="M3 7V5a2 2 0 0 1 2-2h2" />
                <path d="M17 3h2a2 2 0 0 1 2 2v2" />
                <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
                <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
                <line x1="7" y1="8" x2="7" y2="16" strokeWidth="1.5" />
                <line x1="10" y1="8" x2="10" y2="16" strokeWidth="2.5" />
                <line x1="13" y1="8" x2="13" y2="16" strokeWidth="1" />
                <line x1="15" y1="8" x2="15" y2="16" strokeWidth="2" />
                <line x1="18" y1="8" x2="18" y2="16" strokeWidth="1" />
                <line x1="4" y1="12" x2="20" y2="12" stroke="#ef4444" strokeWidth="1.5" />
              </svg>
            </div>
          </button>
          <Input
            ref={inputRef}
            placeholder="Scan barcode / ketik nama..."
            className="pl-10 pr-4 h-12 text-base shadow-none bg-transparent border-0 border-b border-slate-100 rounded-none focus-visible:ring-0 focus-visible:border-indigo-500 transition-all placeholder:text-slate-300 font-medium"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleSearch}
          />
        </div>
        <Dialog open={isCustomOpen} onOpenChange={setIsCustomOpen}>
          <DialogTrigger render={
            <Button 
              variant="outline" 
              className="h-11 w-11 sm:w-auto sm:px-4 rounded-xl border-indigo-100 bg-indigo-50/30 text-indigo-600 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all shadow-sm active:scale-90 flex items-center justify-center gap-2 group"
            >
              <div className="relative">
                <Plus className="h-4 w-4 stroke-[3px]" />
              </div>
              <span className="hidden sm:inline font-black text-[10px] uppercase tracking-widest">Manual</span>
            </Button>
          } />
          <DialogContent className="max-w-xs rounded-lg sm:rounded-lg">
            <DialogHeader>
              <DialogTitle>Tambah Jasa / Item Kustom</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-1">
                <Label className="text-xs font-bold text-slate-600 text-left">Nama Layanan / Barang</Label>
                <Input
                  className="h-10 px-0 border-0 border-b-2 border-slate-200 bg-transparent rounded-none focus-visible:ring-0 focus-visible:border-primary shadow-none text-base font-bold text-left placeholder:text-slate-300"
                  placeholder="Contoh: Jasa Desain Banner"
                  value={customForm.name}
                  onChange={e => setCustomForm({ ...customForm, name: e.target.value })}
                />
              </div>
              <div className="grid gap-1 mt-2">
                <Label className="text-xs font-bold text-slate-600 text-left">Harga</Label>
                <Input
                  type="number"
                  className="h-10 px-0 border-0 border-b-2 border-slate-200 bg-transparent rounded-none focus-visible:ring-0 focus-visible:border-primary shadow-none text-base font-bold text-left placeholder:text-slate-300"
                  placeholder="Rp 0"
                  value={customForm.price}
                  onChange={e => setCustomForm({ ...customForm, price: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter className="flex flex-col gap-2 pt-2 rounded-b-lg sm:flex-col">
              <Button className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm rounded-lg shadow-md shadow-indigo-100" onClick={handleAddCustom}>
                Tambah ke Keranjang
              </Button>
              <Button variant="ghost" className="w-full h-10 text-xs font-bold text-slate-400 rounded-lg" onClick={() => setIsCustomOpen(false)}>
                Batal
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        {/* Fullscreen View Menu - Integrated into search row */}
        {isFullscreen && setViewMode && toggleFullscreen && (
          <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-100 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setViewMode('minimarket')}
              className="h-8 w-8 rounded-lg bg-white text-indigo-600 shadow-sm"
              title="Mode Minimarket"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setViewMode('resto')}
              className="h-8 w-8 rounded-lg text-slate-400 hover:text-indigo-600"
              title="Mode Resto"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <div className="w-px h-4 bg-slate-200 mx-0.5" />
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleFullscreen}
              className="h-8 w-8 rounded-lg bg-white text-indigo-600 shadow-sm"
              title="Layar Penuh"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Suggestions dropdown - Absolute positioned to not push content */}
      <div className="relative">
        {filtered.length > 0 && (
          <div className="absolute top-0 left-0 right-0 border rounded-xl overflow-hidden shadow-lg bg-white z-50 mt-1 max-h-60 overflow-y-auto">
            {filtered.slice(0, 10).map(p => (
              <button
                key={p.id}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-indigo-50 transition-colors border-b last:border-b-0"
                onClick={() => { addItem(p); setQuery(''); }}
              >
                <div className="flex flex-col">
                  <span className="font-bold text-gray-800">{p.name}</span>
                  <span className="text-muted-foreground text-xs font-mono">{p.sku}</span>
                </div>
                <div className="text-right">
                  <div className="text-indigo-600 font-bold">Rp {p.price_sell.toLocaleString('id-ID')}</div>
                  <div className="text-[10px] text-gray-400">Stok: {p.stock_store}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Cart Table - Edge to Edge */}
      <div className="flex-1 bg-white flex flex-col min-h-0">
        <div className="overflow-y-auto flex-1 scrollbar-hide pb-40 lg:pb-0">
          <Table>
            <TableHeader className="bg-slate-50/80 sticky top-0 z-20 border-b border-slate-100">
              <TableRow className="h-10 border-none">
                <TableHead className="pl-5 pr-2 font-black text-slate-400 uppercase text-[9px] tracking-[0.15em] text-left">Produk</TableHead>
                <TableHead className="pl-2 pr-5 text-right font-black text-slate-400 uppercase text-[9px] tracking-[0.15em]">Subtotal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const product = products.find(p => p.id === item.id);
                const isOverStock = product && !item.isCustom && item.quantity > product.stock_store;
                const finalPrice = calculateTieredDiscount(item.price, item.disc1, item.disc2, item.nominalDisc);

                return (
                  <TableRow key={item.id} className="group hover:bg-gray-50/80 transition-colors h-14 border-b border-slate-50 last:border-none">
                    <TableCell onClick={() => openDiscount(item.id)} className="cursor-pointer pl-5 pr-2 py-1">
                      <div className="font-bold text-gray-900 leading-tight text-xs line-clamp-2">{item.name}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] font-bold text-indigo-600">
                          {item.quantity} <span className="text-slate-400">x</span> Rp {finalPrice.toLocaleString('id-ID')}
                        </span>
                        {(item.disc1 > 0 || item.disc2 > 0 || item.nominalDisc > 0) && (
                          <Badge variant="outline" className="text-[8px] h-3 px-1 bg-amber-50 text-amber-700 border-amber-200">DISC</Badge>
                        )}
                        {isOverStock && (
                          <span className="text-[8px] font-bold text-red-500 tracking-tighter">Stok: {product.stock_store}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell onClick={() => openDiscount(item.id)} className="pl-2 pr-5 py-1 text-right text-xs font-black text-slate-800 cursor-pointer">
                      Rp {(finalPrice * item.quantity).toLocaleString('id-ID')}
                    </TableCell>
                  </TableRow>
                );
              })}
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={2} className="h-64 text-center text-muted-foreground bg-gray-50/30">
                    <div className="flex flex-col items-center justify-center gap-2 opacity-30">
                      <div className="p-4 bg-gray-200 rounded-full">
                        <Search className="h-8 w-8" />
                      </div>
                      <p className="text-sm font-medium">Keranjang masih kosong</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Item Configuration Dialog */}
      <Dialog open={isDiscountOpen} onOpenChange={setIsDiscountOpen}>
        <DialogContent className="max-w-xs rounded-lg sm:rounded-lg">
          <DialogHeader>
            <DialogTitle>Konfigurasi Item</DialogTitle>
          </DialogHeader>
          <div className="grid gap-5 py-4 border-y border-slate-50">
            {/* Quantity Adjuster */}
            <div className="flex flex-col gap-2">
              <Label className="text-[10px] uppercase text-gray-400 font-black tracking-widest text-center">Jumlah Item</Label>
              <div className="flex items-center justify-center gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 rounded-xl border-slate-200 shadow-sm text-slate-600 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50"
                  onClick={() => setDiscountForm(prev => ({ ...prev, quantity: Math.max(1, prev.quantity - 1) }))}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <div className="relative w-20">
                  <Input
                    type="text"
                    inputMode="numeric"
                    className="h-10 text-lg font-black text-center bg-slate-50/50"
                    value={discountForm.quantity || ''}
                    onChange={e => {
                      const val = parseInt(e.target.value);
                      setDiscountForm(prev => ({ ...prev, quantity: isNaN(val) ? 0 : val }));
                    }}
                  />
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 rounded-xl border-slate-200 shadow-sm text-slate-600 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50"
                  onClick={() => setDiscountForm(prev => ({ ...prev, quantity: prev.quantity + 1 }))}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="h-px bg-slate-100 mx-4" />

            {/* Discount Inputs */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1">
                <Label className="text-[10px] uppercase text-gray-400 font-black tracking-widest text-center">Diskon 1 (%)</Label>
                <Input
                  type="number"
                  className="h-10 px-1 border-0 border-b-2 border-slate-200 bg-transparent rounded-none focus-visible:ring-0 focus-visible:border-indigo-500 shadow-none text-base font-bold text-center"
                  value={discountForm.disc1 || ''}
                  onChange={e => setDiscountForm({ ...discountForm, disc1: Number(e.target.value) })}
                />
              </div>
              <div className="grid gap-1">
                <Label className="text-[10px] uppercase text-gray-400 font-black tracking-widest text-center">Diskon 2 (%)</Label>
                <Input
                  type="number"
                  className="h-10 px-1 border-0 border-b-2 border-slate-200 bg-transparent rounded-none focus-visible:ring-0 focus-visible:border-indigo-500 shadow-none text-base font-bold text-center"
                  value={discountForm.disc2 || ''}
                  onChange={e => setDiscountForm({ ...discountForm, disc2: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="grid gap-1">
              <Label className="text-[10px] uppercase text-gray-400 font-black tracking-widest text-center">Diskon Nominal (Rp)</Label>
              <Input
                type="number"
                className="h-10 px-1 border-0 border-b-2 border-slate-200 bg-transparent rounded-none focus-visible:ring-0 focus-visible:border-indigo-500 shadow-none text-base font-bold text-center"
                value={discountForm.nominal || ''}
                onChange={e => setDiscountForm({ ...discountForm, nominal: Number(e.target.value) })}
              />
            </div>
          </div>
          <DialogFooter className="flex flex-col gap-2 pt-2 rounded-b-lg">
            <Button className="w-full h-11 bg-primary hover:bg-primary/90 text-white font-black text-sm rounded-xl shadow-lg shadow-primary/10" onClick={handleSaveDiscount}>
              Simpan Perubahan
            </Button>
            <Button
              variant="outline"
              className="w-full h-11 border-red-100 bg-red-50/50 text-red-600 hover:bg-red-100 hover:text-red-700 font-bold text-sm rounded-xl transition-colors"
              onClick={handleRemoveItemFromConfig}
            >
              Hapus dari Keranjang
            </Button>
            <Button variant="ghost" className="w-full h-10 text-xs font-bold text-slate-400" onClick={() => setIsDiscountOpen(false)}>Batal</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Camera Barcode Scanner */}
      <BarcodeScanner
        open={isScannerOpen}
        onOpenChange={setIsScannerOpen}
        onScan={handleScan}
      />

      <PinDialog
        isOpen={showPin}
        onClose={() => {
          setShowPin(false);
          setPinAction(null);
        }}
        onSuccess={() => {
          if (pinAction?.type === 'custom') {
            performAddCustom(pinAction.data.name, Number(pinAction.data.price));
          } else if (pinAction?.type === 'delete') {
            if (selectedItemId) {
              removeItem(selectedItemId);
              setIsDiscountOpen(false);
            }
          } else {
            performSaveDiscount();
          }
          setShowPin(false);
          setPinAction(null);
        }}
        title="Otorisasi Kasir"
        description={
          pinAction?.type === 'custom' ? "Penambahan item kustom memerlukan PIN Pemilik." :
            pinAction?.type === 'delete' ? "Penghapusan item memerlukan PIN Pemilik." :
              pinAction?.type === 'decrease' ? "Pengurangan jumlah item memerlukan PIN Pemilik." :
                "Pemberian diskon manual memerlukan verifikasi PIN Pemilik."
        }
      />
    </div>
  );
}


