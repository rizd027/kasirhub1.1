'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Wallet, Banknote, QrCode, CreditCard, History, CheckCircle2, ChevronRight, Calculator } from "lucide-react";

interface PaymentOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  total: number;
  initialCustomerName?: string;
  onConfirm: (method: 'cash' | 'tempo' | 'qris' | 'transfer', paidAmount: number, customerName?: string) => void;
}

export function PaymentOverlay({ open, onOpenChange, total, initialCustomerName, onConfirm }: PaymentOverlayProps) {
  const [method, setMethod] = useState<'cash' | 'tempo' | 'qris' | 'transfer'>('cash');
  const [paidAmount, setPaidAmount] = useState<string>('');
  const [change, setChange] = useState(0);
  const [customerName, setCustomerName] = useState<string>('');

  useEffect(() => {
    if (open) {
      setMethod('cash');
      setPaidAmount('');
      setChange(0);
      setCustomerName(initialCustomerName || '');
    }
  }, [open, initialCustomerName]);

  useEffect(() => {
    const paid = Number(paidAmount) || 0;
    setChange(Math.max(0, paid - total));
  }, [paidAmount, total]);

  const quickAmounts = [
    total,
    Math.ceil(total / 10000) * 10000,
    Math.ceil(total / 50000) * 50000,
    Math.ceil(total / 100000) * 100000,
    50000,
    100000
  ].filter((a, i, self) => a >= total && self.indexOf(a) === i).sort((a, b) => a - b).slice(0, 4);

  const handleConfirm = () => {
    const paid = method === 'cash' ? (Number(paidAmount) || total) : total;
    if (method === 'cash' && paid < total) return;
    onConfirm(method, paid, customerName);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-white animate-in slide-in-from-bottom duration-300 no-print">
      {/* Fullscreen Header - Compact */}
      <div className="pt-6 pb-6 bg-indigo-600 text-white relative shrink-0">
        <button 
          onClick={() => onOpenChange(false)}
          className="absolute top-2 left-1 p-3 hover:bg-white/10 rounded-full transition-colors active:scale-90"
        >
          <ChevronRight className="h-6 w-6 rotate-180" />
        </button>
        
        <div className="flex flex-col items-center text-center">
          <span className="text-[9px] font-black text-indigo-200 uppercase tracking-widest mb-0.5">Total Tagihan</span>
          <div className="flex items-baseline gap-1">
            <span className="text-sm font-bold opacity-70">Rp</span>
            <span className="text-3xl font-black tracking-tighter">{total.toLocaleString('id-ID')}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-slate-50/50">
        <div className="max-w-md mx-auto p-4 space-y-5">
          
          {/* Customer Name Input */}
          <div className="space-y-1 mb-2">
            <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Pelanggan (Opsional)</Label>
            <Input 
              placeholder="Ketik nama pelanggan..."
              className="h-10 px-1 border-0 border-b-2 border-slate-200 bg-transparent rounded-none focus-visible:ring-0 focus-visible:border-indigo-500 shadow-none text-base font-medium placeholder:text-slate-300"
              value={customerName}
              onChange={e => setCustomerName(e.target.value)}
            />
          </div>
          {/* Method Selection - Compact */}
          <div className="space-y-3">
            <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Metode Pembayaran</Label>
            <div className="grid grid-cols-2 gap-2">
              <PaymentMethodButton 
                active={method === 'cash'} 
                onClick={() => setMethod('cash')}
                icon={<Banknote className="h-4 w-4" />}
                label="Tunai"
              />
              <PaymentMethodButton 
                active={method === 'qris'} 
                onClick={() => setMethod('qris')}
                icon={<QrCode className="h-4 w-4" />}
                label="QRIS"
              />
              <PaymentMethodButton 
                active={method === 'transfer'} 
                onClick={() => setMethod('transfer')}
                icon={<CreditCard className="h-4 w-4" />}
                label="Transfer"
              />
              <PaymentMethodButton 
                active={method === 'tempo'} 
                onClick={() => setMethod('tempo')}
                icon={<History className="h-4 w-4" />}
                label="Tempo"
                variant="warning"
              />
            </div>
          </div>

          {/* Dynamic Content - Compact */}
          <div className="bg-white rounded-lg p-5 shadow-sm border border-slate-100 min-h-[240px] flex flex-col justify-center">
            {method === 'cash' && (
              <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                <div className="space-y-2 text-center">
                  <Label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Uang Diterima</Label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-300">Rp</span>
                    <Input 
                      type="text"
                      inputMode="numeric"
                      autoFocus
                      placeholder={total.toLocaleString('id-ID')}
                      className="pl-10 h-14 text-3xl font-black border-slate-100 bg-slate-50/50 focus-visible:ring-indigo-500/20 focus-visible:ring-4 focus-visible:border-indigo-500 rounded-lg text-center transition-all"
                      value={paidAmount ? Number(paidAmount).toLocaleString('id-ID') : ''}
                      onChange={e => {
                        const raw = e.target.value.replace(/\D/g, '');
                        setPaidAmount(raw);
                      }}
                    />
                  </div>
                </div>

                {/* Quick Cash Buttons */}
                <div className="grid grid-cols-4 gap-1.5">
                  {quickAmounts.map(amt => (
                    <Button 
                      key={amt} 
                      variant="outline" 
                      className="h-9 text-[10px] font-black text-slate-500 hover:border-indigo-500 rounded-lg transition-all active:scale-95 bg-slate-50/50 border-transparent"
                      onClick={() => setPaidAmount(amt.toString())}
                    >
                      {amt >= 1000 ? `${amt/1000}k` : amt}
                    </Button>
                  ))}
                  <Button 
                    variant="outline" 
                    className="h-9 text-[10px] font-black text-indigo-600 border-indigo-100 bg-indigo-50/50 rounded-lg"
                    onClick={() => setPaidAmount(total.toString())}
                  >
                    Pas
                  </Button>
                </div>

                {/* Change Indicator - Compact */}
                <div className={cn(
                  "p-3 rounded-lg flex items-center justify-between border-2 transition-all",
                  change > 0 
                    ? "bg-emerald-50 border-emerald-100 text-emerald-700" 
                    : "bg-slate-50 border-transparent text-slate-300 opacity-50"
                )}>
                  <div className="flex items-center gap-2">
                    <Calculator className="h-4 w-4" />
                    <span className="text-[10px] font-black uppercase tracking-wider">Kembalian</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-[10px] font-bold opacity-50">Rp</span>
                    <span className="text-xl font-black">{change.toLocaleString('id-ID')}</span>
                  </div>
                </div>
              </div>
            )}

            {method === 'qris' && (
              <div className="flex flex-col items-center justify-center py-4 animate-in fade-in zoom-in-95 duration-200">
                <div className="bg-white p-4 shadow-xl rounded-lg border-4 border-slate-50 mb-4">
                  <div className="w-32 h-32 bg-indigo-600 flex items-center justify-center p-3 rounded-lg">
                    <QrCode className="w-full h-full text-white" />
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-[11px] font-black text-slate-800 uppercase tracking-widest">Metode QRIS</p>
                  <p className="text-[10px] text-slate-400 font-medium">Scan barcode dengan aplikasi pembayaran</p>
                </div>
              </div>
            )}

            {method === 'transfer' && (
              <div className="p-5 border border-indigo-50 bg-indigo-50/30 rounded-lg space-y-4 animate-in fade-in duration-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-lg">
                    <CreditCard className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Bank BCA</p>
                    <p className="text-lg font-black text-indigo-900 leading-none">123 456 7890</p>
                    <p className="text-[10px] font-bold text-indigo-500 mt-0.5">a/n KasirHub Digital</p>
                  </div>
                </div>
              </div>
            )}

            {method === 'tempo' && (
              <div className="p-6 border border-amber-100 bg-amber-50/50 rounded-lg flex flex-col items-center text-center space-y-3 animate-in shake-in duration-300">
                <div className="w-10 h-10 rounded-lg bg-amber-500 flex items-center justify-center text-white">
                  <History className="h-5 w-5" />
                </div>
                <p className="text-[11px] font-bold text-amber-900 leading-relaxed">
                  Transaksi akan dicatat sebagai <span className="text-amber-600 font-black">PIUTANG</span>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Fullscreen Footer - Compact */}
      <div className="p-4 bg-white border-t shrink-0">
        <div className="max-w-md mx-auto flex gap-2">
          <Button 
            variant="ghost" 
            className="flex-1 h-11 text-sm font-bold text-slate-400 hover:text-slate-900 rounded-lg"
            onClick={() => onOpenChange(false)}
          >
            Batal
          </Button>
          <Button 
            className={cn(
              "flex-[2.5] h-11 text-sm font-black text-white shadow-lg transition-all rounded-lg active:scale-95",
              method === 'tempo' 
                ? "bg-amber-500 hover:bg-amber-600 shadow-amber-100" 
                : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100"
            )}
            onClick={handleConfirm}
            disabled={method === 'cash' && (Number(paidAmount) || 0) < total && paidAmount !== ''}
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Konfirmasi {method === 'cash' ? 'Bayar' : 'Simpan'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function PaymentMethodButton({ active, onClick, icon, label, variant = 'primary' }: any) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 p-4 rounded-lg border-2 transition-all text-left",
        active 
          ? (variant === 'warning' ? "border-amber-500 bg-amber-50 text-amber-700" : "border-indigo-600 bg-indigo-50 text-indigo-700")
          : "border-gray-100 hover:border-gray-200 text-gray-400"
      )}
    >
      <div className={cn(
        "shrink-0",
        active ? (variant === 'warning' ? "text-amber-600" : "text-indigo-600") : "text-gray-300"
      )}>
        {icon}
      </div>
      <span className="text-sm font-bold truncate">{label}</span>
    </button>
  );
}
