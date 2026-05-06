'use client';

import { useState, useEffect } from 'react';
import { SettingsLayout } from '@/features/settings/SettingsLayout';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Check, ShieldCheck, ShieldAlert, Info, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

const PIN_KEY = 'kasirhub_app_password';

export default function PinPage() {
  const [form, setForm] = useState({ current: '', new: '', confirm: '' });
  const [savedPin, setSavedPin] = useState<string | null>(null);
  const [showPin, setShowPin] = useState(false);

  useEffect(() => {
    setSavedPin(localStorage.getItem(PIN_KEY));
  }, []);

  const handleSave = async () => {
    if (savedPin && form.current !== savedPin) {
      toast.error('PIN lama salah!');
      return;
    }
    if (form.new.length !== 6 || !/^\d+$/.test(form.new)) {
      toast.error('PIN harus berupa 6 digit angka');
      return;
    }
    if (form.new !== form.confirm) {
      toast.error('Konfirmasi PIN tidak cocok');
      return;
    }
    localStorage.setItem(PIN_KEY, form.new);
    setSavedPin(form.new);
    setForm({ current: '', new: '', confirm: '' });
    setShowPin(false);
    toast.success('PIN berhasil diaktifkan!');

    // Sync to cloud
    try {
      const { triggerSync } = await import('@/hooks/useSync');
      await triggerSync();
    } catch (err) {
      console.error('Auto-sync failed:', err);
    }
  };

  const handleRemove = async () => {
    if (!savedPin) return;
    if (form.current !== savedPin) {
      toast.error('Masukkan PIN saat ini untuk menonaktifkan');
      return;
    }
    localStorage.removeItem(PIN_KEY);
    setSavedPin(null);
    setForm({ current: '', new: '', confirm: '' });
    setShowPin(false);
    toast.success('Keamanan PIN dinonaktifkan');

    // Sync to cloud
    try {
      const { triggerSync } = await import('@/hooks/useSync');
      await triggerSync();
    } catch (err) {
      console.error('Auto-sync failed:', err);
    }
  };

  // Validasi sederhana untuk menyalakan tombol centang
  const canSave = form.new.length === 6 && form.confirm.length === 6 && (savedPin ? form.current.length === 6 : true);

  return (
    <SettingsLayout 
      title="Keamanan PIN"
      rightAction={
        <Button 
          variant="ghost" 
          size="icon" 
          className={cn(
            "h-9 w-9 rounded-full transition-all duration-300",
            canSave ? "text-indigo-600 opacity-100 scale-110" : "text-gray-300 opacity-20 scale-100 pointer-events-none"
          )}
          onClick={handleSave}
          disabled={!canSave}
        >
          <Check className="h-5 w-5" />
        </Button>
      }
    >
      <div className="flex flex-col pb-32">
        
        {/* STATUS BAR */}
        <div className={cn(
          "px-6 py-4 flex items-center gap-3 border-b",
          savedPin ? "bg-emerald-50/30 border-emerald-100" : "bg-amber-50/30 border-amber-100"
        )}>
          {savedPin ? (
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
          ) : (
            <ShieldAlert className="h-4 w-4 text-amber-500" />
          )}
          <span className={cn(
            "text-[10px] font-black uppercase tracking-widest",
            savedPin ? "text-emerald-600" : "text-amber-600"
          )}>
            {savedPin ? 'Status: PIN Aktif' : 'Status: PIN Belum Aktif'}
          </span>
        </div>

        {/* FORM FIELDS */}
        <div className="flex flex-col">
          {savedPin && (
            <div className="px-6 py-3 border-b border-gray-100 flex flex-col relative group">
              <Label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">PIN Saat Ini</Label>
              <div className="flex items-center">
                <Input
                  type={showPin ? "text" : "password"}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="••••••"
                  value={form.current}
                  onChange={e => setForm({ ...form, current: e.target.value.replace(/\D/g, '') })}
                  className="h-8 border-none bg-transparent p-0 font-bold text-sm tracking-[0.5em] focus-visible:ring-0 shadow-none rounded-none text-gray-600 flex-1"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-gray-300 hover:text-indigo-600 transition-colors"
                  onClick={() => setShowPin(!showPin)}
                >
                  {showPin ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
          )}

          <div className="px-6 py-3 border-b border-gray-100 flex flex-col relative group">
            <Label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">PIN Baru (6 Digit)</Label>
            <div className="flex items-center">
              <Input 
                type={showPin ? "text" : "password"}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="••••••" 
                value={form.new} 
                onChange={e => setForm({ ...form, new: e.target.value.replace(/\D/g, '') })} 
                className="h-8 border-none bg-transparent p-0 font-bold text-sm tracking-[0.5em] focus-visible:ring-0 shadow-none rounded-none text-gray-600 flex-1"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-gray-300 hover:text-indigo-600 transition-colors"
                onClick={() => setShowPin(!showPin)}
              >
                {showPin ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
          
          <div className="px-6 py-3 border-b border-gray-100 flex flex-col relative group">
            <Label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Konfirmasi PIN Baru</Label>
            <div className="flex items-center">
              <Input 
                type={showPin ? "text" : "password"}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="••••••" 
                value={form.confirm} 
                onChange={e => setForm({ ...form, confirm: e.target.value.replace(/\D/g, '') })} 
                className="h-8 border-none bg-transparent p-0 font-bold text-sm tracking-[0.5em] focus-visible:ring-0 shadow-none rounded-none text-gray-600 flex-1"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-gray-300 hover:text-indigo-600 transition-colors"
                onClick={() => setShowPin(!showPin)}
              >
                {showPin ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
        </div>

        {/* FOOTER INFO */}
        <div className="px-6 py-5 flex gap-3 text-gray-400">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <p className="text-[9px] font-bold uppercase leading-relaxed tracking-wider">
            PIN ini tersimpan secara lokal di perangkat Anda. Jika aplikasi dihapus, PIN perlu diatur ulang.
          </p>
        </div>

        {/* DANGER ZONE (Jika PIN Aktif) */}
        {savedPin && (
          <div className="mt-8 px-6">
            <button 
              onClick={handleRemove}
              className="text-[10px] font-black uppercase tracking-widest text-red-500 hover:text-red-600 transition-colors"
            >
              Nonaktifkan PIN Keamanan
            </button>
          </div>
        )}
      </div>
    </SettingsLayout>
  );
}
