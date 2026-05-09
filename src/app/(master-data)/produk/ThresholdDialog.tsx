'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Settings2, X } from 'lucide-react';
import { toast } from 'sonner';

interface ThresholdDialogProps {
  currentThreshold: number;
  onSave: (value: number) => void;
  onClose: () => void;
}

export function ThresholdDialog({ currentThreshold, onSave, onClose }: ThresholdDialogProps) {
  const [value, setValue] = useState(String(currentThreshold));

  const handleSave = () => {
    const num = parseInt(value, 10);
    if (isNaN(num) || num < 0) {
      toast.error('Masukkan angka yang valid');
      return;
    }
    onSave(num);
    onClose();
    toast.success(`Threshold stok diatur ke ${num}`);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 bg-card rounded-2xl border shadow-2xl w-full max-w-sm p-6 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="p-3 rounded-full bg-indigo-500/10 shrink-0">
            <Settings2 className="h-6 w-6 text-indigo-500" />
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-1">
          <h2 className="text-lg font-bold">Threshold Stok Menipis</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Produk dengan total stok di bawah angka ini akan ditandai sebagai <strong className="text-amber-500">Menipis</strong>.
          </p>
        </div>

        <div className="space-y-2">
          <Label className="text-[10px] font-bold uppercase tracking-widest">
            Batas Minimum Stok
          </Label>
          <div className="relative">
            <Input
              type="number"
              min={0}
              className="text-center text-2xl font-bold h-14 border-2 focus-visible:border-indigo-500 focus-visible:ring-0"
              value={value}
              onChange={e => setValue(e.target.value)}
              autoFocus
            />
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Saat ini: produk dengan stok ≤ <strong>{currentThreshold}</strong> dianggap menipis
          </p>
        </div>

        {/* Preview */}
        <div className="rounded-xl border bg-muted/20 p-3 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Preview Status</p>
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span>Stok 0</span>
              <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 border border-red-500/20 text-[10px] font-bold">Stok Habis</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Stok 1 – {parseInt(value) || currentThreshold}</span>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20 text-[10px] font-bold">Menipis</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Stok &gt; {parseInt(value) || currentThreshold}</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[10px] font-bold">Aman</span>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>Batal</Button>
          <Button className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white" onClick={handleSave}>Simpan</Button>
        </div>
      </div>
    </div>
  );
}
