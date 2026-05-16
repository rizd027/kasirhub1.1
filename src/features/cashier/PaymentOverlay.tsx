'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Wallet, Banknote, QrCode, CreditCard, History, CheckCircle2, ChevronRight, ChevronLeft, Calculator } from "lucide-react";

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
  const [tableNumber, setTableNumber] = useState<string>('');

  useEffect(() => {
    const handlePopState = () => {
      onOpenChange(false);
    };

    if (open) {
      setMethod('cash');
      setPaidAmount('');
      setChange(0);
      setCustomerName(initialCustomerName || '');
      setTableNumber('');

      // Push state for hardware back button support
      window.history.pushState({ modal: 'payment' }, '');
      window.addEventListener('popstate', handlePopState);
    }

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [open, initialCustomerName, onOpenChange]);

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
    
    // Combine name and table number for the existing onConfirm prop
    const finalIdentity = tableNumber 
      ? `${customerName}${customerName ? ' ' : ''}(Meja ${tableNumber})`
      : customerName;
      
    onConfirm(method, paid, finalIdentity);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[300] flex bg-white no-print items-center justify-center animate-in fade-in duration-300">
      {/* Split Layout Container */}
      <div className="flex flex-col md:flex-row w-full h-full bg-white overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
        
        {/* Left Side: Bill Summary (Now Indigo Accent) */}
        <div className="md:w-2/5 bg-indigo-600 p-6 md:p-12 flex flex-col justify-center relative overflow-hidden shrink-0">
          {/* Decorative pattern */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-20 -mt-20 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-400/10 rounded-full -ml-10 -mb-10 blur-2xl" />
          
          <Button 
            variant="ghost" 
            size="icon" 
            className="absolute top-4 left-4 text-white/50 hover:text-white hover:bg-white/10 rounded-full"
            onClick={() => onOpenChange(false)}
          >
            <ChevronLeft className="size-6" />
          </Button>

          <div className="space-y-1 relative z-10 text-center md:text-left pt-6 md:pt-0">
            <p className="text-[10px] font-black text-indigo-200 uppercase tracking-[0.3em] mb-1">Total Tagihan</p>
            <div className="flex items-baseline justify-center md:justify-start gap-2">
              <span className="text-xl font-bold text-indigo-300">Rp</span>
              <h2 className="text-5xl md:text-7xl font-black text-white tracking-tighter">
                {total.toLocaleString('id-ID')}
              </h2>
            </div>
          </div>

          <div className="hidden md:flex mt-12 pt-8 border-t border-white/10 space-y-6 relative z-10">
            <div className="flex items-center gap-4">
              <div className="size-10 rounded-lg bg-white/10 flex items-center justify-center text-indigo-100">
                <Calculator className="size-5" />
              </div>
              <div className="space-y-0.5">
                <p className="text-[9px] font-black text-indigo-200 uppercase tracking-widest">Status Pembayaran</p>
                <p className="text-sm font-bold text-white">Menunggu Konfirmasi</p>
              </div>
            </div>
          </div>

          <div className="absolute -bottom-20 -left-20 size-80 bg-indigo-600/10 rounded-full blur-[100px]" />
        </div>

        {/* Right Side: Inputs (Light/Gray) */}
        <div className="md:w-3/5 bg-white flex flex-col flex-1 min-h-0 overflow-y-auto md:overflow-hidden relative border-l border-slate-100 overscroll-contain">
          <div className="px-6 md:px-14 flex flex-col md:justify-center max-w-2xl mx-auto w-full space-y-6 py-8 md:py-6">
            
            {/* 1. Customer Identity */}
            <section className="pb-4 border-b border-slate-200/60">
              <div className="grid grid-cols-3 gap-6">
                <div className="col-span-2 flex flex-col gap-2">
                  <Label className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">Nama Pelanggan</Label>
                  <Input 
                    placeholder="Nama Pelanggan..."
                    className="h-10 px-0 bg-transparent border-0 border-b-2 border-slate-200 focus:border-indigo-600 rounded-none text-base font-bold shadow-none focus-visible:ring-0 transition-all placeholder:text-slate-300"
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">No. Meja</Label>
                  <Input 
                    placeholder="Meja..."
                    className="h-10 px-0 bg-transparent border-0 border-b-2 border-slate-200 focus:border-indigo-600 rounded-none text-base font-bold shadow-none focus-visible:ring-0 transition-all placeholder:text-slate-300"
                    value={tableNumber}
                    onChange={e => setTableNumber(e.target.value)}
                  />
                </div>
              </div>
            </section>

            {/* 2. Payment Method */}
            <section className="pb-4 border-b border-slate-200/60">
              <div className="space-y-3">
                <Label className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">Metode Pembayaran</Label>
                <div className="grid grid-cols-4 gap-2.5">
                  <PaymentMethodButton 
                    active={method === 'cash'} 
                    onClick={() => setMethod('cash')}
                    icon={<Banknote className="size-5" />}
                    label="Tunai"
                  />
                  <PaymentMethodButton 
                    active={method === 'qris'} 
                    onClick={() => setMethod('qris')}
                    icon={<QrCode className="size-5" />}
                    label="QRIS"
                  />
                  <PaymentMethodButton 
                    active={method === 'transfer'} 
                    onClick={() => setMethod('transfer')}
                    icon={<CreditCard className="size-5" />}
                    label="Bank"
                  />
                  <PaymentMethodButton 
                    active={method === 'tempo'} 
                    onClick={() => setMethod('tempo')}
                    icon={<History className="size-5" />}
                    label="Tempo"
                    variant="warning"
                  />
                </div>
              </div>
            </section>

            {/* 3. Input Amount / QRIS Display */}
            <section className="min-h-[160px] flex flex-col justify-start pt-2">
              {method === 'cash' ? (
                <div className="space-y-6">
                  <div className="flex flex-col gap-3">
                    <Label className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">Nominal Uang Diterima</Label>
                    <div className="flex items-end gap-6">
                      <div className="relative flex-1">
                        <span className="absolute left-0 bottom-3 text-lg font-bold text-slate-400">Rp</span>
                        <Input 
                          type="text"
                          inputMode="numeric"
                          placeholder={total.toLocaleString('id-ID')}
                          className="pl-10 h-14 text-4xl font-black border-0 border-b-2 border-slate-200 bg-transparent focus:border-indigo-600 rounded-none shadow-none focus-visible:ring-0 transition-all text-slate-900"
                          value={paidAmount ? Number(paidAmount).toLocaleString('id-ID') : ''}
                          onChange={e => {
                            const raw = e.target.value.replace(/\D/g, '');
                            setPaidAmount(raw);
                          }}
                        />
                      </div>
                      <div className="flex flex-col justify-end h-14 min-w-[120px]">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Kembalian</span>
                        <span className={cn(
                          "text-xl font-black transition-all",
                          change > 0 ? "text-emerald-600" : "text-slate-300"
                        )}>
                          Rp {change.toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2.5">
                    {quickAmounts.map(amt => (
                      <Button 
                        key={amt} 
                        variant="outline" 
                        className="h-11 px-5 text-xs font-black text-slate-700 hover:border-indigo-500 hover:text-indigo-600 rounded-lg transition-all border-slate-200 bg-white shadow-sm"
                        onClick={() => setPaidAmount(amt.toString())}
                      >
                        {amt.toLocaleString('id-ID')}
                      </Button>
                    ))}
                    <Button 
                      variant="outline" 
                      className="h-11 px-5 text-xs font-black text-indigo-700 border-indigo-200 bg-indigo-50 rounded-lg shadow-sm"
                      onClick={() => setPaidAmount(total.toString())}
                    >
                      Uang Pas
                    </Button>
                  </div>
                </div>
              ) : method === 'qris' ? (
                <div className="flex items-center gap-8 animate-in fade-in slide-in-from-left-4 duration-300">
                  <div className="bg-white p-3 shadow-xl rounded-lg border border-slate-200">
                    <QrCode className="size-24 text-indigo-600" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-black text-indigo-600 uppercase tracking-[0.2em]">Metode QRIS</p>
                    <p className="text-xl font-black text-slate-900">Scan QR untuk bayar</p>
                    <p className="text-xs text-slate-500 font-bold">Nominal harus sesuai tagihan</p>
                  </div>
                </div>
              ) : method === 'transfer' ? (
                <div className="flex items-center gap-8 animate-in fade-in slide-in-from-left-4 duration-300">
                  <div className="size-16 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-xl shadow-indigo-100">
                    <CreditCard className="size-8" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-black text-indigo-300 uppercase tracking-[0.2em]">Transfer Bank BCA</p>
                    <p className="text-3xl font-black text-slate-900 tracking-tight">123 456 7890</p>
                    <p className="text-sm font-bold text-indigo-600">a/n KasirHub Digital</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-8 animate-in fade-in slide-in-from-left-4 duration-300">
                  <div className="size-16 rounded-lg bg-amber-500 flex items-center justify-center text-white shadow-xl shadow-amber-100">
                    <History className="size-8" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-black text-amber-600 uppercase tracking-[0.2em]">Metode Tempo</p>
                    <p className="text-2xl font-black text-amber-900 leading-tight">
                      Simpan sebagai <span className="font-black text-amber-600">Piutang</span>
                    </p>
                    <p className="text-xs text-amber-700 font-bold">Catat piutang pelanggan</p>
                  </div>
                </div>
              )}
            </section>
          </div>

          {/* Footer: Confirm Button */}
          <div className="p-6 md:p-8 bg-white border-t border-slate-200 mt-auto">
            <div className="max-w-2xl mx-auto flex gap-4 items-center">
              <Button 
                variant="ghost" 
                className="h-14 px-8 text-[11px] font-black text-slate-500 hover:bg-slate-50 rounded-lg tracking-widest"
                onClick={() => onOpenChange(false)}
              >
                BATAL
              </Button>
              <Button 
                className={cn(
                  "flex-1 h-14 text-base font-black text-white shadow-2xl transition-all rounded-lg active:scale-95",
                  method === 'tempo' 
                    ? "bg-amber-500 hover:bg-amber-600 shadow-amber-200" 
                    : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200"
                )}
                onClick={handleConfirm}
                disabled={method === 'cash' && (Number(paidAmount) || 0) < total && paidAmount !== ''}
              >
                <CheckCircle2 className="size-5 mr-3" />
                KONFIRMASI {method === 'cash' ? 'BAYAR' : 'SIMPAN'}
              </Button>
            </div>
          </div>
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
        "flex flex-col items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all h-20",
        active 
          ? (variant === 'warning' ? "bg-amber-500 border-amber-500 text-white shadow-lg shadow-amber-200" : "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200")
          : "border-slate-200 bg-white hover:border-indigo-200 text-slate-600 shadow-sm font-bold"
      )}
    >
      <div className={cn(
        "transition-transform",
        active ? "scale-110" : ""
      )}>
        {icon}
      </div>
      <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
    </button>
  );
}


