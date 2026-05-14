'use client';

import { useState, useEffect, useRef } from 'react';
import { ShieldCheck, X, Delete } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface PinDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  title?: string;
  description?: string;
}

const PIN_KEY = 'kasirhub_app_password';
const PIN_LENGTH = 6;

const KEYPAD = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['', '0', 'del'],
];

export function PinDialog({
  isOpen,
  onClose,
  onSuccess,
  title = 'Verifikasi Keamanan',
  description = 'Masukkan PIN untuk melanjutkan.',
}: PinDialogProps) {
  const [pin, setPin] = useState('');
  const [isError, setIsError] = useState(false);
  const [isShaking, setIsShaking] = useState(false);

  // Handle Keyboard Input
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handleKey(e.key);
      } else if (e.key === 'Backspace') {
        handleKey('del');
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, pin, isError]); // Added dependencies to ensure fresh state access

  useEffect(() => {
    if (isOpen) {
      setPin('');
      setIsError(false);
      setIsShaking(false);
    }
  }, [isOpen]);

  const verify = (value: string) => {
    const savedPin = localStorage.getItem(PIN_KEY);
    if (value === savedPin) {
      toast.success('Verifikasi Berhasil');
      onSuccess();
    } else {
      setIsShaking(true);
      setIsError(true);
      setTimeout(() => {
        setPin('');
        setIsError(false);
        setIsShaking(false);
      }, 600);
      toast.error('PIN Salah!');
    }
  };

  const handleKey = (key: string) => {
    if (key === 'del') {
      setPin(prev => prev.slice(0, -1));
      if (isError) setIsError(false);
      return;
    }
    if (key === '') return;

    if (pin.length >= PIN_LENGTH) return;

    const next = (pin + key);
    setPin(next);
    if (isError) setIsError(false);

    if (next.length === PIN_LENGTH) {
      verify(next);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex bg-slate-950 text-white select-none overflow-hidden">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-6 right-6 p-3 rounded-full bg-white/5 hover:bg-white/10 transition-colors z-50"
      >
        <X className="size-6" />
      </button>

      {/* Main Container - Two Columns on Desktop */}
      <div className="flex flex-col md:flex-row w-full h-full">
        
        {/* Left Section: Status & Instructions */}
        <div className="flex-1 flex flex-col items-center justify-center p-12 border-b md:border-b-0 md:border-r border-white/5 bg-slate-950">
          <div className="mb-8 p-6 rounded-[2.5rem] bg-indigo-600/10 border border-indigo-600/20">
            <ShieldCheck className="size-12 text-indigo-600" strokeWidth={1.5} />
          </div>
          
          <h2 className="text-3xl font-bold tracking-tight mb-2 text-center">{title}</h2>
          <p className="text-slate-400 text-sm font-medium text-center max-w-xs mb-12">
            {description}
          </p>

          {/* PIN Indicator Dots */}
          <div className={cn(
            "flex gap-4 p-6 rounded-lg bg-white/5 border border-white/5",
            isShaking && "border-red-500/50 bg-red-500/5"
          )}>
            {Array.from({ length: PIN_LENGTH }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "w-4 h-4 rounded-full border-2",
                  i < pin.length
                    ? isError 
                      ? "bg-red-500 border-red-500" 
                      : "bg-indigo-600 border-indigo-600 shadow-[0_0_15px_rgba(79,70,229,0.5)]"
                    : "bg-transparent border-slate-700"
                )}
              />
            ))}
          </div>

          <div className="h-8 mt-6 text-center">
            {isError && (
              <p className="text-red-400 text-xs font-bold uppercase tracking-widest">
                PIN SALAH, SILAKAN COBA LAGI
              </p>
            )}
          </div>
        </div>

        {/* Right Section: Numpad (Always on right on desktop) */}
        <div className="flex-1 flex flex-col items-center justify-center bg-slate-900/50 p-12 lg:p-24">
          <div className="w-full max-w-[280px]">
            <div className="grid grid-cols-3 gap-3">
              {KEYPAD.map((row, ri) => 
                row.map((key, ki) => {
                  if (key === '') return <div key={ki} />;
                  
                  const isDel = key === 'del';
                  
                  return (
                    <button
                      key={`${ri}-${ki}`}
                      onClick={() => handleKey(key)}
                      className={cn(
                        "aspect-square rounded-lg flex items-center justify-center text-2xl font-medium transition-colors",
                        isDel 
                          ? "bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-white" 
                          : "bg-white/5 border border-white/5 hover:bg-white/10 active:bg-indigo-600 active:text-white"
                      )}
                    >
                      {isDel ? <Delete className="size-7" /> : key}
                    </button>
                  );
                })
              )}
            </div>
            
            <p className="mt-10 text-center text-[11px] text-slate-500 font-medium tracking-wide">
              Gunakan layar sentuh atau keyboard laptop Anda
            </p>

            <button 
              className="w-full mt-4 text-center text-[11px] text-indigo-500/50 hover:text-indigo-500 font-bold uppercase tracking-widest"
              onClick={() => toast.info('Reset PIN melalui Dashboard Admin')}
            >
              Lupa PIN?
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

