'use client';

import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { LocalTransaction } from '@/db/dexie';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface ReceiptProps {
  transaction: LocalTransaction;
  idElement?: string;
}

export function Receipt({ transaction, idElement = 'receipt-content' }: ReceiptProps) {
  const [tokoInfo, setTokoInfo] = useState({
    nama: 'KasirHub POS',
    alamat: 'Jl. Raya Digital No. 123',
    telepon: '08123456789',
    pesan_nota: 'Terima kasih sudah berbelanja!',
    kebijakan_pengembalian: '',
    logo_url: '',
    signature_url: '',
    instagram: '',
    tiktok: '',
    email_bisnis: '',
    google_maps_link: '',
  });

  const [prefs, setPrefs] = useState({
    currency: 'IDR',
    dateFormat: 'dd/MM/yyyy',
    paperSize: '58mm',
    showLogoOnReceipt: true,
    showQrOnReceipt: false,
    showCashierName: true,
  });

  const [cashierName, setCashierName] = useState('Administrator');

  useEffect(() => {
    const savedToko = localStorage.getItem('toko_info');
    if (savedToko) {
      setTokoInfo(prev => ({ ...prev, ...JSON.parse(savedToko) }));
    }

    const savedProfile = localStorage.getItem('kasirhub_user_profile');
    if (savedProfile) {
      try {
        const p = JSON.parse(savedProfile);
        if (p.full_name) setCashierName(p.full_name);
      } catch (e) {}
    }

    const savedPrefs = localStorage.getItem('kasirhub_prefs');
    if (savedPrefs) {
      try {
        const p = JSON.parse(savedPrefs);
        setPrefs(prev => ({ ...prev, ...p }));
        setTokoInfo(prev => ({
          ...prev,
          pesan_nota: p.pesanNota || prev.pesan_nota,
          kebijakan_pengembalian: p.kebijakanPengembalian || prev.kebijakan_pengembalian,
        }));
      } catch (e) {
        console.error("Error parsing prefs in Receipt", e);
      }
    }
  }, []);

  const formatCurrency = (amount: number) => {
    const val = amount || 0;
    const symbol = prefs.currency === 'IDR' ? 'Rp' : prefs.currency;
    return `${symbol} ${val.toLocaleString(prefs.currency === 'IDR' ? 'id-ID' : 'en-US')}`;
  };

  return (
    <div 
      id={idElement}
      className={cn(
        "bg-white text-black p-4 font-mono text-[10px] mx-auto shadow-sm",
        prefs.paperSize === '80mm' ? "w-[80mm]" : "w-[58mm]"
      )}
      style={{ lineHeight: '1.2' }}
    >
      {/* Header */}
      <div className="text-center mb-4">
        {tokoInfo.logo_url && prefs.showLogoOnReceipt && (
          <div className="mb-2 flex justify-center">
            <img 
              src={tokoInfo.logo_url} 
              alt="Logo toko" 
              className="h-10 w-10 rounded object-cover" 
              crossOrigin="anonymous"
            />
          </div>
        )}
        <div className="text-sm font-bold uppercase">{tokoInfo.nama}</div>
        <div className="text-[8px]">{tokoInfo.alamat}</div>
        <div className="text-[8px]">{tokoInfo.telepon}</div>
      </div>

      <div className="border-t border-dashed border-black my-2"></div>

      {/* Info Transaksi */}
      <div className="flex justify-between mb-1">
        <span>Tgl:</span>
        <span>{format(new Date(transaction.created_at), prefs.dateFormat.replace('yyyy', 'yy').replace('MMMM', 'MMM'), { locale: id })}</span>
      </div>
      <div className="flex justify-between mb-1">
        <span>Nota:</span>
        <span>{transaction.id?.toString().slice(-6).toUpperCase() || 'NEW'}</span>
      </div>
      {transaction.customer_name && (
        <div className="flex justify-between mb-1 font-bold">
          <span>Pelanggan:</span>
          <span>{transaction.customer_name}</span>
        </div>
      )}
      {prefs.showCashierName && (
        <div className="flex justify-between mb-1">
          <span>Kasir:</span>
          <span>{transaction.cashier_name || cashierName}</span>
        </div>
      )}
      <div className="flex justify-between mb-2">
        <span>Bayar:</span>
        <span className="uppercase">{transaction.payment_method === 'cash' ? 'Tunai' : 'Tempo'}</span>
      </div>

      <div className="border-t border-dashed border-black my-2"></div>

      {/* Items */}
      <div className="flex flex-col gap-1 mb-2">
        {transaction.items.map((item: any, idx) => (
          <div key={idx} className="flex flex-col">
            <div className="flex justify-between font-bold">
              <span className="truncate max-w-[140px]">{item.name_at_time || item.name}</span>
            </div>
            <div className="flex justify-between">
              <span>{item.quantity} x {formatCurrency(item.price_at_time || item.price)}</span>
              <span>{formatCurrency((item.price_at_time || item.price) * item.quantity)}</span>
            </div>
            {(item.disc1 > 0 || item.disc2 > 0 || item.nominalDisc > 0) && (
              <div className="text-right text-[8px] italic">
                Diskon: -{formatCurrency(((item.price_at_time || item.price) * item.quantity) - ((item.price_at_time || item.price) * (1 - (item.disc1||0)/100) * (1 - (item.disc2||0)/100) * item.quantity - (item.nominalDisc||0)))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="border-t border-dashed border-black my-2"></div>

      {/* Summary */}
      <div className="flex flex-col gap-1">
        <div className="flex justify-between">
          <span>Subtotal:</span>
          <span>{formatCurrency(transaction.subtotal || transaction.total_amount)}</span>
        </div>

        {(transaction.service_charge_amount || 0) > 0 && (
          <div className="flex justify-between">
            <span>Service Charge:</span>
            <span>{formatCurrency(transaction.service_charge_amount)}</span>
          </div>
        )}

        {(transaction.tax_amount || 0) > 0 && (
          <div className="flex justify-between">
            <span>Pajak (PPN):</span>
            <span>{formatCurrency(transaction.tax_amount)}</span>
          </div>
        )}
        
        <div className="flex justify-between font-bold text-sm mt-1">
          <span>TOTAL:</span>
          <span>{formatCurrency(transaction.total_amount)}</span>
        </div>
        
        {transaction.discount_total > 0 && (
          <div className="flex justify-between text-[8px] italic">
            <span>Hemat (Diskon):</span>
            <span>{formatCurrency(transaction.discount_total)}</span>
          </div>
        )}
      </div>

      <div className="border-t border-dashed border-black my-2"></div>

      {/* QR Code Simulation */}
      {prefs.showQrOnReceipt && (
        <div className="flex flex-col items-center my-4">
          <div className="w-20 h-20 border border-gray-200 flex items-center justify-center p-1">
            {/* Simple QR Mockup */}
            <div className="grid grid-cols-5 grid-rows-5 gap-0.5 w-full h-full bg-black">
              {[...Array(25)].map((_, i) => (
                <div key={i} className={cn("bg-white", Math.random() > 0.5 ? "opacity-100" : "opacity-0")} />
              ))}
            </div>
          </div>
          <span className="text-[6px] mt-1">Scan untuk Cek Nota</span>
        </div>
      )}

      {/* Footer */}
      <div className="text-center mt-4 italic text-[8px] whitespace-pre-wrap">
        {tokoInfo.pesan_nota}
      </div>
      {tokoInfo.kebijakan_pengembalian && (
        <div className="text-center mt-1 text-[7px] whitespace-pre-wrap">{tokoInfo.kebijakan_pengembalian}</div>
      )}
      {(tokoInfo.instagram || tokoInfo.tiktok || tokoInfo.email_bisnis || tokoInfo.google_maps_link) && (
        <div className="text-center mt-2 text-[7px] space-y-0.5">
          {tokoInfo.instagram && <div>IG: {tokoInfo.instagram}</div>}
          {tokoInfo.tiktok && <div>TikTok: {tokoInfo.tiktok}</div>}
          {tokoInfo.email_bisnis && <div>Email: {tokoInfo.email_bisnis}</div>}
          {tokoInfo.google_maps_link && <div>Maps: {tokoInfo.google_maps_link}</div>}
        </div>
      )}
      {tokoInfo.signature_url && (
        <div className="mt-2 flex justify-center">
          <img 
            src={tokoInfo.signature_url} 
            alt="Signature toko" 
            className="h-10 w-20 object-contain" 
            crossOrigin="anonymous"
          />
        </div>
      )}
      <div className="text-center mt-2 text-[6px] opacity-50">
        KasirHub POS - v1.0.0
      </div>
    </div>
  );
}
