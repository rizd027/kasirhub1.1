'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { CheckCircle2, Printer, Share2, PlusCircle, X, ChevronRight, Calculator } from "lucide-react";
import { Receipt } from "@/features/cashier/Receipt";
import { LocalTransaction } from "@/db/dexie";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SuccessOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: LocalTransaction | null;
  onPrint: (size: string) => void;
  onShare: (size: string) => void;
}

export function SuccessOverlay({ open, onOpenChange, transaction, onPrint, onShare }: SuccessOverlayProps) {
  const [paperSize, setPaperSize] = useState('80mm');
  if (!transaction || !open) return null;

  return (
    <div className="fixed inset-0 z-[400] flex bg-white no-print overflow-hidden">
      <div className="w-full h-full flex flex-col md:flex-row overflow-hidden relative">
        
        {/* Close Button Desktop */}
        <button 
          onClick={() => onOpenChange(false)}
          className="hidden md:flex absolute top-6 right-6 z-50 size-12 rounded-full bg-white/10 hover:bg-white/20 items-center justify-center text-white transition-all"
        >
          <X className="size-6" />
        </button>

        {/* --- MOBILE LAYOUT --- */}
        <div className="md:hidden flex flex-col h-full w-full bg-slate-50">
          {/* Mobile Header (Indigo) */}
          <div className="bg-indigo-600 p-6 pb-10 text-white text-center rounded-b-[2.5rem] shadow-lg relative shrink-0">
              <button 
                onClick={() => onOpenChange(false)}
                className="absolute top-4 right-4 size-8 rounded-full bg-white/10 flex items-center justify-center"
              >
                <X className="size-4" />
              </button>

              <div className="flex flex-col items-center gap-3">
                <div className="size-12 rounded-lg bg-white/20 flex items-center justify-center">
                  <CheckCircle2 className="size-6" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-xl font-black tracking-tight">Transaksi Berhasil!</h2>
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full">
                    <Calculator className="size-3 text-indigo-200" />
                    <span className="text-[10px] font-bold tracking-widest uppercase">Rp {transaction.total_amount.toLocaleString('id-ID')}</span>
                  </div>
                </div>
              </div>
          </div>

          {/* Mobile Receipt Content (Scrollable) */}
          <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center">
            <div className="w-full max-w-[300px]">
               <div className="relative">
                  <div className="absolute top-0 left-0 right-0 h-1 flex gap-1 px-1 z-10">
                    {[...Array(30)].map((_, i) => (
                      <div key={i} className="w-2 h-2 bg-slate-50 rotate-45 -mt-1" />
                    ))}
                  </div>
                  <div className="p-0 shadow-xl shadow-slate-200/50">
                     <Receipt transaction={transaction} idElement="receipt-content-mobile" />
                  </div>
                  <div className="h-4 w-full bg-slate-50" style={{ clipPath: 'polygon(0% 0%, 5% 100%, 10% 0%, 15% 100%, 20% 0%, 25% 100%, 30% 0%, 35% 100%, 40% 0%, 45% 100%, 50% 0%, 55% 100%, 60% 0%, 65% 100%, 70% 0%, 75% 100%, 80% 0%, 85% 100%, 90% 0%, 95% 100%, 100% 0%)' }}></div>
               </div>
            </div>
            <p className="mt-4 text-[9px] font-bold text-slate-400 uppercase tracking-widest">Pratinjau Struk</p>
          </div>

          {/* Mobile Footer Actions (Sticky) */}
          <div className="p-5 bg-white border-t border-slate-100 space-y-4 shrink-0 pb-8">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Ukuran Kertas</label>
              <Select value={paperSize} onValueChange={(val) => setPaperSize(val || '80mm')}>
                <SelectTrigger className="w-full h-12 bg-slate-50 border-slate-200 rounded-lg px-4 text-xs font-bold text-slate-700">
                  <SelectValue placeholder="Pilih Ukuran" />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false} side="top" sideOffset={10} className="bg-white border-slate-200 rounded-lg shadow-2xl z-[500] p-1">
                  <SelectItem value="58mm" className="text-xs font-bold data-[highlighted]:bg-indigo-50 data-[highlighted]:text-indigo-600 data-[selected]:bg-indigo-600 data-[selected]:text-white rounded-lg transition-colors cursor-pointer outline-none">58 mm (Kasir Mini / EDC)</SelectItem>
                  <SelectItem value="80mm" className="text-xs font-bold data-[highlighted]:bg-indigo-50 data-[highlighted]:text-indigo-600 data-[selected]:bg-indigo-600 data-[selected]:text-white rounded-lg transition-colors cursor-pointer outline-none">80 mm (Kasir Standar)</SelectItem>
                  <SelectItem value="1/8 Folio" className="text-xs font-bold data-[highlighted]:bg-indigo-50 data-[highlighted]:text-indigo-600 data-[selected]:bg-indigo-600 data-[selected]:text-white rounded-lg transition-colors cursor-pointer outline-none">1/8 Folio (Nota Mini / Olshop)</SelectItem>
                  <SelectItem value="1/4 Folio" className="text-xs font-bold data-[highlighted]:bg-indigo-50 data-[highlighted]:text-indigo-600 data-[selected]:bg-indigo-600 data-[selected]:text-white rounded-lg transition-colors cursor-pointer outline-none">1/4 Folio (Nota Kecil / Bon)</SelectItem>
                  <SelectItem value="1/2 A5" className="text-xs font-bold data-[highlighted]:bg-indigo-50 data-[highlighted]:text-indigo-600 data-[selected]:bg-indigo-600 data-[selected]:text-white rounded-lg transition-colors cursor-pointer outline-none">1/2 A5 (Struk Sedang)</SelectItem>
                  <SelectItem value="A5" className="text-xs font-bold data-[highlighted]:bg-indigo-50 data-[highlighted]:text-indigo-600 data-[selected]:bg-indigo-600 data-[selected]:text-white rounded-lg transition-colors cursor-pointer outline-none">A5 (Nota Standar)</SelectItem>
                  <SelectItem value="1/2 Folio" className="text-xs font-bold data-[highlighted]:bg-indigo-50 data-[highlighted]:text-indigo-600 data-[selected]:bg-indigo-600 data-[selected]:text-white rounded-lg transition-colors cursor-pointer outline-none">1/2 Folio (Nota Besar / Kontan)</SelectItem>
                  <SelectItem value="A4" className="text-xs font-bold data-[highlighted]:bg-indigo-50 data-[highlighted]:text-indigo-600 data-[selected]:bg-indigo-600 data-[selected]:text-white rounded-lg transition-colors cursor-pointer outline-none">A4 / F4 (Nota Full / Invoice)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button 
              onClick={() => onPrint(paperSize)}
              className="w-full h-14 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg font-black text-sm gap-2 shadow-lg shadow-indigo-100"
            >
              <Printer className="size-4" />
              CETAK STRUK SEKARANG
            </Button>
            <div className="grid grid-cols-2 gap-3">
              <Button 
                variant="outline"
                onClick={() => onShare(paperSize)}
                className="h-12 border-slate-200 text-slate-600 rounded-lg font-bold text-xs gap-2"
              >
                <Share2 className="size-3.5" />
                BAGI
              </Button>
              <Button 
                variant="ghost"
                onClick={() => onOpenChange(false)}
                className="h-12 bg-slate-50 text-slate-500 rounded-lg font-bold text-xs gap-2"
              >
                SELESAI
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          </div>
        </div>

        {/* --- DESKTOP LAYOUT --- */}
        {/* Left Side: Receipt Preview */}
        <div className="hidden md:flex md:w-1/2 bg-slate-50 p-12 lg:p-20 flex-col items-center justify-center min-h-0 overflow-y-auto">
          <div className="w-full max-w-md">
            <div className="relative">
              <div className="absolute top-0 left-0 right-0 h-1 flex gap-1 px-1 z-10">
                {[...Array(30)].map((_, i) => (
                  <div key={i} className="w-2 h-2 bg-slate-50 rotate-45 -mt-1" />
                ))}
              </div>
              
              <div className="p-0">
                 <Receipt transaction={transaction} idElement="receipt-content-desktop" />
              </div>

              <div className="h-5 w-full bg-slate-50" style={{ clipPath: 'polygon(0% 0%, 5% 100%, 10% 0%, 15% 100%, 20% 0%, 25% 100%, 30% 0%, 35% 100%, 40% 0%, 45% 100%, 50% 0%, 55% 100%, 60% 0%, 65% 100%, 70% 0%, 75% 100%, 80% 0%, 85% 100%, 90% 0%, 95% 100%, 100% 0%)' }}></div>
            </div>
          </div>
          <p className="mt-8 text-xs font-bold text-slate-400 uppercase tracking-[0.3em] text-center">Pratinjau Struk Belanja</p>
        </div>

        {/* Right Side: Success Status & Actions */}
        <div className="hidden md:flex md:w-1/2 bg-indigo-600 px-10 lg:px-24 flex-col justify-center relative overflow-hidden text-white shrink-0">
          {/* Background Ornaments */}
          <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-white/5 rounded-full -ml-40 -mt-40 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-[300px] h-[300px] bg-indigo-400/10 rounded-full -mr-20 -mb-20 blur-2xl pointer-events-none" />

          <div className="relative z-10 max-w-md mx-auto w-full space-y-5 lg:space-y-6">
            <div className="flex flex-col items-center md:items-start gap-3">
              <div className="size-14 rounded-[1.25rem] bg-white/10 flex items-center justify-center">
                <CheckCircle2 className="size-7 text-white" />
              </div>
              <div className="text-center md:text-left space-y-1.5">
                <h2 className="text-3xl md:text-4xl lg:text-5xl font-black tracking-tight leading-[1.1]">Transaksi<br/>Berhasil!</h2>
                <p className="text-indigo-200 text-[10px] font-black uppercase tracking-[0.4em]">Pembayaran Diterima</p>
              </div>
            </div>

            <div className="bg-white/5 rounded-[1.25rem] p-4 lg:p-5 border border-white/10 flex items-center gap-4 backdrop-blur-sm">
              <div className="size-11 rounded-lg bg-white/10 flex items-center justify-center">
                <Calculator className="size-5 text-indigo-100" />
              </div>
              <div className="space-y-0">
                <p className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest">Total Pembayaran</p>
                <p className="text-2xl lg:text-3xl font-black text-white">Rp {transaction.total_amount.toLocaleString('id-ID')}</p>
              </div>
            </div>

            <div className="space-y-4 lg:space-y-5">
              {/* Desktop Paper Size Selector - BEAUTIFIED */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-indigo-200 uppercase tracking-[0.4em] px-1">Pilih Ukuran Kertas</label>
                <Select value={paperSize} onValueChange={(val) => setPaperSize(val || '80mm')}>
                  <SelectTrigger className="w-full h-12 bg-white/10 border-white/20 rounded-[0.75rem] px-5 text-sm font-black text-white hover:bg-white/20 transition-all backdrop-blur-md">
                    <SelectValue placeholder="Pilih Ukuran" />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false} side="top" sideOffset={12} className="bg-indigo-900/95 border-white/10 text-white rounded-lg shadow-2xl backdrop-blur-2xl z-[500] p-1.5">
                    <SelectItem value="58mm" className="font-bold data-[highlighted]:bg-white/15 data-[highlighted]:text-white data-[selected]:bg-white/25 data-[selected]:text-white rounded-lg transition-colors cursor-pointer outline-none">58 mm (Kasir Mini / EDC)</SelectItem>
                    <SelectItem value="80mm" className="font-bold data-[highlighted]:bg-white/15 data-[highlighted]:text-white data-[selected]:bg-white/25 data-[selected]:text-white rounded-lg transition-colors cursor-pointer outline-none">80 mm (Kasir Standar)</SelectItem>
                    <SelectItem value="1/8 Folio" className="font-bold data-[highlighted]:bg-white/15 data-[highlighted]:text-white data-[selected]:bg-white/25 data-[selected]:text-white rounded-lg transition-colors cursor-pointer outline-none">1/8 Folio (Nota Mini / Olshop)</SelectItem>
                    <SelectItem value="1/4 Folio" className="font-bold data-[highlighted]:bg-white/15 data-[highlighted]:text-white data-[selected]:bg-white/25 data-[selected]:text-white rounded-lg transition-colors cursor-pointer outline-none">1/4 Folio (Nota Kecil / Bon)</SelectItem>
                    <SelectItem value="1/2 A5" className="font-bold data-[highlighted]:bg-white/15 data-[highlighted]:text-white data-[selected]:bg-white/25 data-[selected]:text-white rounded-lg transition-colors cursor-pointer outline-none">1/2 A5 (Struk Sedang)</SelectItem>
                    <SelectItem value="A5" className="font-bold data-[highlighted]:bg-white/15 data-[highlighted]:text-white data-[selected]:bg-white/25 data-[selected]:text-white rounded-lg transition-colors cursor-pointer outline-none">A5 (Nota Standar)</SelectItem>
                    <SelectItem value="1/2 Folio" className="font-bold data-[highlighted]:bg-white/15 data-[highlighted]:text-white data-[selected]:bg-white/25 data-[selected]:text-white rounded-lg transition-colors cursor-pointer outline-none">1/2 Folio (Nota Besar / Kontan)</SelectItem>
                    <SelectItem value="A4" className="font-bold data-[highlighted]:bg-white/15 data-[highlighted]:text-white data-[selected]:bg-white/25 data-[selected]:text-white rounded-lg transition-colors cursor-pointer outline-none">A4 / F4 (Nota Full / Invoice)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="pt-0.5 space-y-3 lg:space-y-4">
                <Button onClick={() => onPrint(paperSize)} className="w-full h-14 bg-white text-indigo-700 hover:bg-indigo-50 rounded-[0.75rem] font-black text-base gap-3 shadow-xl shadow-indigo-900/40 transition-all active:scale-[0.98]">
                  <Printer className="size-5" />
                  CETAK STRUK
                </Button>
                <div className="grid grid-cols-2 gap-3">
                  <Button variant="ghost" onClick={() => onShare(paperSize)} className="h-12 bg-white/10 hover:bg-white/20 text-white border-0 rounded-[0.75rem] font-bold text-sm gap-2 backdrop-blur-sm">
                    <Share2 className="size-4" />
                    BAGI
                  </Button>
                  <Button variant="ghost" onClick={() => onOpenChange(false)} className="h-12 bg-indigo-800/40 hover:bg-indigo-800/60 text-white border-0 rounded-[0.75rem] font-bold text-sm gap-2 transition-colors">
                    SELESAI
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

