'use client';

import { Button } from "@/components/ui/button";
import { Receipt } from "@/features/cashier/Receipt";
import { LocalTransaction } from "@/lib/dexie";
import { Printer, MessageCircle, X } from "lucide-react";
import { generateReceiptPDF } from "@/utils/receipt";

interface ReprintModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: LocalTransaction | null;
}

export function ReprintModal({ open, onOpenChange, transaction }: ReprintModalProps) {
  if (!open || !transaction) return null;

  const handlePrint = async () => {
    const blob = await generateReceiptPDF('receipt-reprint');
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    win?.print();
  };

  const handleWhatsApp = () => {
    const lines = transaction.items.map((item: any) =>
      `${item.quantity}x ${item.name}: Rp ${(item.price * item.quantity).toLocaleString('id-ID')}`
    ).join('\n');
    const text = encodeURIComponent(
      `🧾 *Struk KasirHub*\n\n${lines}\n\n*TOTAL: Rp ${transaction.total_amount.toLocaleString('id-ID')}*\n\nTerima kasih sudah berbelanja!`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-[150] flex flex-col bg-white animate-in slide-in-from-bottom duration-300 no-print">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-14 border-b bg-white sticky top-0 z-10 shrink-0">
        <h2 className="text-base font-black text-slate-800">Cetak Ulang Struk</h2>
        <button
          onClick={() => onOpenChange(false)}
          className="p-2 hover:bg-slate-100 rounded-full transition-colors"
        >
          <X className="h-5 w-5 text-slate-500" />
        </button>
      </div>

      {/* Receipt Preview */}
      <div className="flex-1 overflow-y-auto bg-slate-50 py-6 flex justify-center">
        <div className="bg-white shadow-lg">
          <Receipt transaction={transaction} idElement="receipt-reprint" />
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-4 bg-white border-t shrink-0 flex gap-3">
        <Button
          variant="outline"
          className="flex-1 h-11 rounded-lg border-indigo-200 text-indigo-600 hover:bg-indigo-50 font-bold gap-2"
          onClick={handleWhatsApp}
        >
          <MessageCircle className="h-4 w-4" />
          WhatsApp
        </Button>
        <Button
          className="flex-1 h-11 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-2 shadow-md shadow-indigo-100"
          onClick={handlePrint}
        >
          <Printer className="h-4 w-4" />
          Cetak
        </Button>
      </div>
    </div>
  );
}
