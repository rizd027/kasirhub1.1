'use client';

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Receipt } from "@/features/cashier/Receipt";
import { LocalTransaction } from "@/db/dexie";
import { Printer, Share2, X, ChevronLeft } from "lucide-react";
import { generateReceiptPDF } from "@/utils/receipt";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface ReprintModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: LocalTransaction | null;
}

export function ReprintModal({ open, onOpenChange, transaction }: ReprintModalProps) {
  const [paperSize, setPaperSize] = useState('80mm');
  const [isGenerating, setIsGenerating] = useState(false);

  if (!open || !transaction) return null;

  const handlePrint = async () => {
    try {
      const blob = await generateReceiptPDF('receipt-reprint', paperSize);
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const win = window.open(url, '_blank');
      win?.print();
    } catch (error) {
      console.error('Print error:', error);
    }
  };

  const handleShare = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    try {
      const blob = await generateReceiptPDF('receipt-reprint', paperSize);
      if (!blob) return;
      
      const file = new File([blob], `Nota_${transaction.id?.toString().slice(-6)}.pdf`, { type: 'application/pdf' });
      
      if (navigator.share) {
        await navigator.share({
          files: [file],
          title: 'Nota KasirHub',
          text: 'Terima kasih sudah berbelanja!'
        });
      } else {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
      }
    } catch (error) {
      console.error('Share error:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex flex-col bg-white lg:flex-row no-print">
      {/* Mobile Header (Back Button Style) */}
      <div className="lg:hidden flex items-center justify-between px-4 h-16 border-b bg-white sticky top-0 z-10 shrink-0">
        <button onClick={() => onOpenChange(false)} className="flex items-center gap-2 text-slate-800">
          <ChevronLeft className="h-5 w-5" />
          <span className="font-bold">Kembali</span>
        </button>
        <h2 className="text-sm font-black uppercase tracking-widest text-slate-400">Cetak Ulang</h2>
        <div className="w-9" /> {/* Spacer */}
      </div>

      {/* LEFT SIDE: Preview (Desktop) / Main Content (Mobile) */}
      <div className="flex-1 overflow-y-auto bg-slate-50 lg:bg-[#312ECB] flex flex-col items-center justify-start lg:justify-center p-6 lg:p-12">
        <div className="hidden lg:block absolute top-10 left-10 text-white/50">
          <h2 className="text-xs font-black uppercase tracking-[0.4em]">Pratinjau Nota</h2>
          <p className="text-[10px] mt-1 font-medium tracking-widest opacity-60">Transaksi #{transaction.id?.toString().slice(-6)}</p>
        </div>

        <div className="bg-white shadow-2xl rounded-sm transform lg:scale-110 origin-center transition-transform">
          <Receipt transaction={transaction} idElement="receipt-reprint" />
        </div>

        <p className="lg:hidden text-[10px] font-black text-slate-400 uppercase tracking-widest mt-8 mb-4">Opsi Cetak</p>
      </div>

      {/* RIGHT SIDE: Action Panel (Desktop) / Bottom Panel (Mobile) */}
      <div className="w-full lg:w-[450px] bg-white border-t lg:border-t-0 lg:border-l border-slate-100 flex flex-col shrink-0">
        <div className="hidden lg:flex items-center justify-between p-8 border-b border-slate-50">
          <div>
            <h2 className="text-xl font-black text-slate-800">Cetak Ulang</h2>
            <p className="text-xs text-slate-400 font-medium mt-1 uppercase tracking-wider">Atur & Bagikan Nota</p>
          </div>
          <button onClick={() => onOpenChange(false)} className="size-10 flex items-center justify-center bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors">
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        <div className="p-6 lg:p-8 flex-1 flex flex-col justify-center space-y-6">
          {/* Paper Size Selector */}
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Pilih Ukuran Kertas</label>
            <Select value={paperSize} onValueChange={(val) => setPaperSize(val || '80mm')}>
              <SelectTrigger className="w-full h-14 bg-slate-50 border-slate-200 rounded-2xl px-5 text-sm font-bold text-slate-700 hover:bg-slate-100 transition-all">
                <SelectValue placeholder="Ukuran Kertas" />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false} side="top" sideOffset={8} className="bg-white border-slate-200 rounded-2xl shadow-2xl z-[1100] p-1.5">
                <SelectItem value="58mm" className="font-bold data-[highlighted]:bg-indigo-50 data-[highlighted]:text-indigo-600 data-[selected]:bg-indigo-600 data-[selected]:text-white rounded-xl transition-colors cursor-pointer p-3 text-xs outline-none">58 mm (Kasir Mini / EDC)</SelectItem>
                <SelectItem value="80mm" className="font-bold data-[highlighted]:bg-indigo-50 data-[highlighted]:text-indigo-600 data-[selected]:bg-indigo-600 data-[selected]:text-white rounded-xl transition-colors cursor-pointer p-3 text-xs outline-none">80 mm (Kasir Standar)</SelectItem>
                <SelectItem value="1/8 Folio" className="font-bold data-[highlighted]:bg-indigo-50 data-[highlighted]:text-indigo-600 data-[selected]:bg-indigo-600 data-[selected]:text-white rounded-xl transition-colors cursor-pointer p-3 text-xs outline-none">1/8 Folio (Nota Mini / Olshop)</SelectItem>
                <SelectItem value="1/4 Folio" className="font-bold data-[highlighted]:bg-indigo-50 data-[highlighted]:text-indigo-600 data-[selected]:bg-indigo-600 data-[selected]:text-white rounded-xl transition-colors cursor-pointer p-3 text-xs outline-none">1/4 Folio (Nota Kecil / Bon)</SelectItem>
                <SelectItem value="1/2 A5" className="font-bold data-[highlighted]:bg-indigo-50 data-[highlighted]:text-indigo-600 data-[selected]:bg-indigo-600 data-[selected]:text-white rounded-xl transition-colors cursor-pointer p-3 text-xs outline-none">1/2 A5 (Struk Sedang)</SelectItem>
                <SelectItem value="A5" className="font-bold data-[highlighted]:bg-indigo-50 data-[highlighted]:text-indigo-600 data-[selected]:bg-indigo-600 data-[selected]:text-white rounded-xl transition-colors cursor-pointer p-3 text-xs outline-none">A5 (Nota Standar)</SelectItem>
                <SelectItem value="1/2 Folio" className="font-bold data-[highlighted]:bg-indigo-50 data-[highlighted]:text-indigo-600 data-[selected]:bg-indigo-600 data-[selected]:text-white rounded-xl transition-colors cursor-pointer p-3 text-xs outline-none">1/2 Folio (Nota Besar / Kontan)</SelectItem>
                <SelectItem value="A4" className="font-bold data-[highlighted]:bg-indigo-50 data-[highlighted]:text-indigo-600 data-[selected]:bg-indigo-600 data-[selected]:text-white rounded-xl transition-colors cursor-pointer p-3 text-xs outline-none">A4 / F4 (Nota Full / Invoice)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-1 gap-4">
            <Button
              onClick={handleShare}
              disabled={isGenerating}
              variant="outline"
              className="h-16 rounded-2xl border-2 border-indigo-100 text-indigo-600 hover:bg-indigo-50 font-black text-sm gap-3 transition-all"
            >
              <Share2 className={cn("size-5", isGenerating && "animate-pulse")} />
              {isGenerating ? 'MENGOLAH...' : 'BAGIKAN'}
            </Button>

            <Button
              onClick={handlePrint}
              className="h-16 rounded-2xl bg-indigo-600 text-white hover:bg-indigo-700 font-black text-sm gap-3 shadow-xl shadow-indigo-100 transition-all active:scale-95"
            >
              <Printer className="size-5" />
              CETAK NOTA
            </Button>
          </div>
        </div>

        <div className="p-6 text-center border-t border-slate-50 lg:bg-slate-50/50">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.3em]">KasirHub POS • v1.0.0</p>
        </div>
      </div>
    </div>
  );
}
