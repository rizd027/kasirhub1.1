'use client';

import { useState, useEffect } from 'react';
import { Cloud, CloudOff, RefreshCw, AlertCircle } from 'lucide-react';
import { triggerSync } from '@/hooks/useSync';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export function SyncIndicator() {
  const [status, setStatus] = useState<'synced' | 'syncing' | 'offline' | 'error'>('synced');
  const [lastSync, setLastSync] = useState<Date | null>(null);

  useEffect(() => {
    const updateStatus = () => {
      if (!navigator.onLine) {
        setStatus('offline');
      } else {
        setStatus('synced');
      }
    };

    updateStatus();

    window.addEventListener('online', () => {
      setStatus('synced');
      toast.success('Koneksi tersambung. Menyinkronkan...');
      handleSync();
    });

    window.addEventListener('offline', () => {
      setStatus('offline');
      toast.error('Koneksi terputus. Mode Offline aktif.');
    });

    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
    };
  }, []);

  const handleSync = async () => {
    if (!navigator.onLine) {
      toast.error('Tidak ada koneksi internet');
      return;
    }

    setStatus('syncing');
    try {
      await triggerSync(true);
      const now = new Date();
      setStatus('synced');
      setLastSync(now);
      localStorage.setItem('kasirhub_last_sync', now.toISOString());
      toast.success('Data tersinkronisasi');
    } catch (err: any) {
      console.error('Sync error:', err);
      setStatus('error');
      toast.error(err.message || 'Sinkronisasi gagal. Periksa koneksi internet.');
    }
  };

  const timeLabel = lastSync ? lastSync.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <button
      onClick={handleSync}
      disabled={status === 'syncing'}
      className={cn(
        "relative size-9 flex items-center justify-center rounded-xl border transition-all active:scale-95",
        status === 'synced' ? "bg-white border-slate-100 text-slate-400 hover:border-emerald-100 hover:text-emerald-500" :
        status === 'syncing' ? "bg-indigo-50 border-indigo-100 text-indigo-600" :
        status === 'offline' ? "bg-slate-50 border-slate-200 text-slate-300" :
        "bg-red-50 border-red-100 text-red-600"
      )}
      title={status === 'synced' ? `Terakhir sinkron: ${timeLabel}` : status}
    >
      <div className="relative">
        {status === 'syncing' ? (
          <RefreshCw className="size-4 animate-spin" />
        ) : (
          <Cloud className="size-5" />
        )}
        
        <span className={cn(
          "absolute -top-1 -right-1 flex h-2.5 w-2.5 rounded-full border-2 border-white",
          (status === 'synced' || status === 'syncing') ? "bg-emerald-500" : "bg-red-500"
        )}>
          {(status === 'synced' || status === 'syncing') && (
             <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          )}
        </span>
      </div>
    </button>
  );
}
