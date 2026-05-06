'use client';

import { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { useCartStore } from "@/store/useCartStore";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { LocalProduct } from "@/lib/dexie";
import { Plus, Check, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

import { useStaffStore } from '@/store/useStaffStore';
import { PinDialog } from "@/components/ui/PinDialog";
import { toast } from 'sonner';
import { LayoutGrid, List, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RestoMode({ 
  products, 
  categories, 
  isFullscreen, 
  setViewMode, 
  toggleFullscreen 
}: { 
  products: LocalProduct[], 
  categories: any[],
  isFullscreen?: boolean,
  setViewMode?: (mode: 'minimarket' | 'resto') => void,
  toggleFullscreen?: () => void
}) {
  const { addItem, items, updateQuantity, removeItem } = useCartStore();
  const { session } = useStaffStore();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [showPin, setShowPin] = useState(false);
  const [pinAction, setPinAction] = useState<{ id: string, next: number } | null>(null);

  const filteredProducts = activeCategory 
    ? products.filter(p => p.category_id === activeCategory)
    : products;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Category Filter */}
      <div className="bg-white border-b sticky top-0 z-30 px-6 h-16 flex items-center shrink-0">
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-2 pb-1 items-center">
            {isFullscreen && setViewMode && toggleFullscreen && (
              <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-100 shrink-0 mr-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setViewMode('minimarket')}
                  className="h-8 w-8 rounded-lg text-slate-400 hover:text-indigo-600"
                  title="Mode Minimarket"
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setViewMode('resto')}
                  className="h-8 w-8 rounded-lg bg-white text-indigo-600 shadow-sm"
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
            <button
              onClick={() => setActiveCategory(null)}
              className={cn(
                "px-4 py-1.5 rounded-full text-xs font-bold transition-all border",
                activeCategory === null 
                  ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-200" 
                  : "bg-white border-gray-200 text-gray-500 hover:border-indigo-200"
              )}
            >
              Semua
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={cn(
                  "px-4 py-1.5 rounded-full text-xs font-bold transition-all border",
                  activeCategory === cat.id 
                    ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-200" 
                    : "bg-white border-gray-200 text-gray-500 hover:border-indigo-200"
                )}
              >
                {cat.name}
              </button>
            ))}
          </div>
          <ScrollBar orientation="horizontal" className="hidden" />
        </ScrollArea>
      </div>

      {/* Product Grid */}
      <div className="flex-1 overflow-y-auto bg-slate-50/50">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 p-4 pb-40 lg:pb-4">
          {filteredProducts.map((product) => {
            const isOutOfStock = product.stock_store <= 0;
            const cartItem = items.find(i => i.id === product.id);
            const quantity = cartItem?.quantity || 0;

            const handleIncrement = (e: React.MouseEvent) => {
              e.stopPropagation();
              if (quantity > 0) {
                updateQuantity(product.id, quantity + 1);
              } else {
                addItem(product);
              }
            };

            const handleDecrement = (e: React.MouseEvent) => {
              e.stopPropagation();
              const nextVal = quantity - 1;
              const savedPin = localStorage.getItem('kasirhub_app_password');
              
              if (session?.role === 'staff' || savedPin) {
                setPinAction({ id: product.id, next: nextVal });
                setShowPin(true);
                return;
              }

              if (nextVal > 0) {
                updateQuantity(product.id, nextVal);
              } else {
                removeItem(product.id);
              }
            };

            return (
              <Card
                key={product.id}
                className={cn(
                  "group relative cursor-pointer overflow-hidden transition-all active:scale-95 select-none border-none shadow-sm hover:shadow-lg",
                  isOutOfStock ? "opacity-60 grayscale-[0.5]" : "hover:ring-2 hover:ring-indigo-500/30",
                  quantity > 0 && "ring-2 ring-indigo-600 shadow-indigo-100"
                )}
                onClick={() => !isOutOfStock && addItem(product)}
              >
                <div className="relative aspect-square w-full bg-gray-100 overflow-hidden">
                  {product.image_url ? (
                    <Image
                      src={product.image_url}
                      alt={product.name}
                      fill
                      className={cn(
                        "object-cover transition-transform duration-500",
                        quantity > 0 ? "scale-110" : "group-hover:scale-110"
                      )}
                      sizes="(max-width: 768px) 50vw, 25vw"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-gray-200 bg-gray-50">
                      <ShoppingBag className="h-10 w-10" />
                    </div>
                  )}
                  
                  {/* Stock Badge */}
                  <Badge className={cn(
                    "absolute top-2 right-2 border-none text-[9px] font-black tracking-tighter px-1.5 py-0 z-10",
                    isOutOfStock ? "bg-red-500 text-white" : "bg-black/40 backdrop-blur-sm text-white"
                  )}>
                    {isOutOfStock ? 'HABIS' : product.stock_store}
                  </Badge>

                  {/* Quick Add Overlay (only if not in cart) */}
                  {!isOutOfStock && quantity === 0 && (
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all flex items-center justify-center z-20">
                      <div className="opacity-0 group-hover:opacity-100 transform scale-75 group-hover:scale-100 transition-all bg-indigo-600 rounded-full p-2.5 text-white shadow-xl shadow-indigo-300/40">
                        <Plus className="h-5 w-5" />
                      </div>
                    </div>
                  )}
                </div>

                <CardContent className="p-3 bg-white">
                  <div className="text-[13px] font-bold text-gray-800 truncate mb-0.5 leading-tight">{product.name}</div>
                  <div className="text-[11px] font-black text-indigo-600 mb-2">
                    Rp {product.price_sell.toLocaleString('id-ID')}
                  </div>

                  {/* Counter Below Price */}
                  <div className="h-8 flex items-center justify-between">
                    {quantity > 0 ? (
                      <div className="flex items-center justify-between w-full bg-slate-50 rounded-lg p-0.5 border border-slate-100 animate-in fade-in slide-in-from-top-1 duration-200">
                        <button 
                          onClick={handleDecrement}
                          className="w-7 h-7 flex items-center justify-center rounded-md bg-white text-gray-500 hover:text-red-600 shadow-sm transition-colors"
                        >
                          <span className="text-lg font-bold leading-none">−</span>
                        </button>
                        <span className="text-xs font-black text-indigo-700">{quantity}</span>
                        <button 
                          onClick={handleIncrement}
                          className="w-7 h-7 flex items-center justify-center rounded-md bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm shadow-indigo-100 transition-colors"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-full text-[10px] font-bold text-muted-foreground/40 italic flex items-center gap-1.5">
                        <div className="h-px flex-1 bg-slate-100" />
                        Pilih
                        <div className="h-px flex-1 bg-slate-100" />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {filteredProducts.length === 0 && (
            <div className="col-span-full h-64 flex flex-col items-center justify-center text-muted-foreground gap-3">
              <div className="p-4 bg-gray-100 rounded-full opacity-20">
                <ShoppingBag className="h-12 w-12" />
              </div>
              <p className="text-sm font-medium opacity-50">Produk tidak ditemukan di kategori ini</p>
            </div>
          )}
        </div>
      </div>

      <PinDialog 
        isOpen={showPin}
        onClose={() => {
          setShowPin(false);
          setPinAction(null);
        }}
        onSuccess={() => {
          if (pinAction) {
            if (pinAction.next > 0) {
              updateQuantity(pinAction.id, pinAction.next);
            } else {
              removeItem(pinAction.id);
              toast.success('Item dihapus');
            }
          }
          setShowPin(false);
          setPinAction(null);
        }}
        title="Otorisasi Kasir"
        description="Pengurangan atau pembatalan pesanan memerlukan verifikasi PIN Pemilik."
      />
    </div>
  );
}

