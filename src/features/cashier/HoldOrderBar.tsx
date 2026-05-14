'use client';

import { useCartStore, HeldOrder } from "@/store/useCartStore";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Pause, Play, Trash2, Clock, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export function HoldOrderBar() {
  const { holdOrders, holdCart, restoreCart, deleteHeldOrder, items } = useCartStore();

  if (holdOrders.length === 0 && items.length === 0) return null;

  return (
    <div className="bg-indigo-900 text-white border-b border-indigo-800 shadow-inner no-print">
      <div className="flex items-center px-4 py-2 gap-4">
        {items.length > 0 && (
          <Button 
            size="sm" 
            variant="ghost" 
            className="h-8 bg-indigo-800 hover:bg-indigo-700 text-white font-bold text-[10px] uppercase tracking-wider"
            onClick={() => holdCart()}
          >
            <Pause className="h-3 w-3 mr-1.5" />
            Tahan Pesanan
          </Button>
        )}

        <ScrollArea className="flex-1 whitespace-nowrap">
          <div className="flex gap-2 py-1">
            {holdOrders.map((order) => (
              <div 
                key={order.id}
                className="group relative inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/10 rounded-lg px-3 py-1.5 transition-all cursor-pointer"
                onClick={() => restoreCart(order.id)}
              >
                <Clock className="h-3 w-3 text-indigo-300" />
                <div className="flex flex-col">
                  <span className="text-[10px] font-black leading-none truncate max-w-[80px]">{order.label}</span>
                  <span className="text-[8px] font-bold text-indigo-300">{order.items.length} Item</span>
                </div>
                
                <button 
                  className="ml-1 p-1 rounded-full hover:bg-red-500 transition-colors opacity-0 group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteHeldOrder(order.id);
                  }}
                >
                  <Trash2 className="h-2.5 w-2.5" />
                </button>
              </div>
            ))}
          </div>
          <ScrollBar orientation="horizontal" className="hidden" />
        </ScrollArea>

        {holdOrders.length > 0 && (
          <div className="flex items-center gap-1.5 px-2 py-1 bg-white/5 rounded-full">
            <ShoppingCart className="h-3 w-3 text-indigo-400" />
            <span className="text-[10px] font-black">{holdOrders.length}</span>
          </div>
        )}
      </div>
    </div>
  );
}
