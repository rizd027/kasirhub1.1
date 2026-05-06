'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle, X } from 'lucide-react';

interface DeleteAllDialogProps {
  productCount: number;
  onConfirm: () => void;
  onClose: () => void;
}

export function DeleteAllDialog({ productCount, onConfirm, onClose }: DeleteAllDialogProps) {
  const [inputValue, setInputValue] = useState('');
  const isValid = inputValue === 'HAPUS';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 bg-card rounded-2xl border shadow-2xl w-full max-w-sm p-6 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="p-3 rounded-full bg-red-500/10 shrink-0">
            <AlertTriangle className="h-6 w-6 text-red-500" />
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-bold">Hapus Semua Produk?</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Tindakan ini akan <strong className="text-red-500">permanen menghapus {productCount} produk</strong> dari database dan tidak dapat dibatalkan.
          </p>
        </div>

        <div className="space-y-2">
          <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Ketik <span className="font-mono text-red-500 font-bold">HAPUS</span> untuk konfirmasi
          </Label>
          <Input
            className="font-mono text-center text-sm font-bold border-2 focus-visible:border-red-500 focus-visible:ring-0"
            placeholder="HAPUS"
            value={inputValue}
            onChange={e => setInputValue(e.target.value.toUpperCase())}
            autoFocus
          />
        </div>

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Batal
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            disabled={!isValid}
            onClick={() => { onConfirm(); onClose(); }}
          >
            Hapus Semua
          </Button>
        </div>
      </div>
    </div>
  );
}
