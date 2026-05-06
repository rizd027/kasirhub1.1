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
      onClose();
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

    const next = (pin + key).slice(0, PIN_LENGTH);
    setPin(next);
    if (isError) setIsError(false);

    if (next.length === PIN_LENGTH) {
      verify(next);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-gradient-to-br from-[#4F46E5] via-[#4338CA] to-[#312E81] text-white select-none overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-[-10%] left-[-10%] w-64 h-64 bg-white/5 rounded-full blur-3xl" />
      <div className="absolute bottom-[-5%] right-[-5%] w-80 h-80 bg-indigo-400/10 rounded-full blur-3xl" />

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-6 right-6 p-2.5 rounded-2xl bg-white/10 hover:bg-white/20 backdrop-blur-lg transition-all active:scale-90"
      >
        <X className="size-5" />
      </button>

      {/* Header Section */}
      <div className="flex flex-col items-center justify-center flex-1 gap-4 px-10">
        <div className="bg-white/10 w-16 h-16 rounded-[2rem] flex items-center justify-center backdrop-blur-xl mb-4 border border-white/10 shadow-2xl">
          <ShieldCheck className="size-8 text-white" strokeWidth={2.5} />
        </div>
        <h2 className="text-2xl font-black tracking-tight text-center">{title}</h2>
        <p className="text-indigo-100/60 text-[13px] font-bold text-center leading-tight max-w-[240px] uppercase tracking-wide">
          {description}
        </p>

        {/* PIN Dots */}
        <div
          className={cn(
            'flex items-center gap-5 mt-10 transition-all',
            isShaking && 'animate-[shake_0.4s_ease-in-out]'
          )}
        >
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'w-3.5 h-3.5 rounded-full border-2 transition-all duration-300',
                i < pin.length
                  ? isError
                    ? 'bg-red-400 border-red-400 scale-125 shadow-[0_0_15px_rgba(248,113,113,0.5)]'
                    : 'bg-white border-white scale-125 shadow-[0_0_15px_rgba(255,255,255,0.4)]'
                  : 'bg-transparent border-white/20'
              )}
            />
          ))}
        </div>

        <div className="h-6 mt-4">
          <p className={cn(
            'text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-300',
            isError ? 'text-red-300 opacity-100' : 'opacity-0'
          )}>
            PIN SALAH, COBA LAGI
          </p>
        </div>
      </div>

      {/* Keypad Section */}
      <div className="w-full max-w-[320px] mx-auto px-8 pb-16">
        <div className="grid grid-cols-3 gap-y-6 gap-x-8">
          {KEYPAD.map((row, ri) => 
            row.map((key, ki) => {
              if (key === '') return <div key={ki} />;
              
              const isDel = key === 'del';
              
              return (
                <button
                  key={`${ri}-${ki}`}
                  onClick={() => handleKey(key)}
                  className={cn(
                    "relative aspect-square rounded-full flex items-center justify-center transition-all active:scale-90",
                    "text-2xl font-black",
                    isDel 
                      ? "bg-transparent text-white/50 hover:text-white" 
                      : "bg-white/10 hover:bg-white/20 border border-white/5 backdrop-blur-md shadow-lg active:bg-white/30"
                  )}
                >
                  {isDel ? <Delete className="size-7" /> : key}
                </button>
              );
            })
          )}
        </div>

        <button 
          className="w-full mt-10 text-center text-[10px] text-white/30 font-black uppercase tracking-[0.2em] hover:text-white/50 transition-colors"
          onClick={() => toast.info('Fitur reset PIN tersedia di dashboard Admin')}
        >
          Lupa PIN?
        </button>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-10px); }
          40% { transform: translateX(10px); }
          60% { transform: translateX(-7px); }
          80% { transform: translateX(7px); }
        }
      `}</style>
    </div>
  );
}
