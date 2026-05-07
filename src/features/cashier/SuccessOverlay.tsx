'use client';

import { Button } from "@/components/ui/button";
import { CheckCircle2, Printer, Share2, PlusCircle } from "lucide-react";
import { Receipt } from "@/features/cashier/Receipt";
import { LocalTransaction } from "@/lib/dexie";
import { cn } from "@/lib/utils";

interface SuccessOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: LocalTransaction | null;
  onPrint: () => void;
  onShare: () => void;
}

export function SuccessOverlay({ open, onOpenChange, transaction, onPrint, onShare }: SuccessOverlayProps) {
  if (!transaction || !open) return null;

  return (
    <div className="fixed inset-0 z-[110] flex flex-col bg-slate-50 animate-in fade-in zoom-in-95 duration-300 no-print">
      {/* Fullscreen Success Header */}
      <div className="pt-6 pb-6 bg-indigo-600 text-white text-center relative shrink-0 shadow-lg shadow-indigo-100">
        <button 
          onClick={() => onOpenChange(false)}
          className="absolute top-2 right-2 p-2 hover:bg-white/10 rounded-full transition-all active:scale-90"
        >
          <PlusCircle className="h-6 w-6 rotate-45" />
        </button>
        
        <div className="flex justify-center mb-2">
          <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center animate-in zoom-in duration-500 delay-150">
            <CheckCircle2 className="h-6 w-6 text-white" />
          </div>
        </div>
        <h2 className="text-xl font-black mb-1 tracking-tight">Transaksi Berhasil!</h2>
        <p className="text-indigo-100 text-[9px] font-black uppercase tracking-[0.2em] opacity-80">Pembayaran Diterima</p>
      </div>
      
      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="max-w-md mx-auto space-y-10">
          {/* Receipt Canvas Only */}
          <div className="max-h-[420px] overflow-y-auto custom-scrollbar flex justify-center animate-in slide-in-from-bottom duration-500 delay-200">
            <div className="bg-white shadow-lg">
              <Receipt transaction={transaction} idElement="receipt-content-success" />
            </div>
          </div>
        </div>
      </div>

      {/* Fixed Action Bottom Bar */}
      <div className="p-6 bg-white border-t border-slate-100 shadow-[0_-8px_30px_-15px_rgba(0,0,0,0.1)] shrink-0 pb-10 sm:pb-6">
        <div className="max-w-md mx-auto grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300">
          <ActionButton 
            icon={<Printer className="h-5 w-5" />} 
            label="Cetak" 
            onClick={onPrint}
            variant="indigo"
          />
          <ActionButton 
            icon={<Share2 className="h-5 w-5" />} 
            label="Bagi" 
            onClick={onShare}
          />
        </div>
        <Button 
          variant="ghost" 
          className="w-full mt-4 h-11 text-slate-400 font-bold uppercase tracking-widest text-[10px]"
          onClick={() => onOpenChange(false)}
        >
          Selesai & Tutup
        </Button>
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
}

function ActionButton({ icon, label, onClick, variant = 'gray' }: any) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-2 transition-all active:scale-90 shadow-sm",
        variant === 'indigo' ? "border-indigo-50 bg-indigo-50 text-indigo-700" :
        variant === 'whatsapp' ? "border-emerald-50 bg-emerald-50 text-emerald-700" :
        "border-slate-50 bg-white text-slate-500"
      )}
    >
      <div className={cn(
        "p-2.5 rounded-xl",
        variant === 'indigo' ? "bg-indigo-600 text-white" :
        variant === 'whatsapp' ? "bg-emerald-600 text-white" :
        "bg-slate-100 text-slate-400"
      )}>
        {icon}
      </div>
      <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
    </button>
  );
}
