'use client';

import { useState, useEffect } from 'react';
import { Cloud, CloudOff, RefreshCw, AlertCircle } from 'lucide-react';
import { triggerSync } from '@/hooks/useSync';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Network } from '@capacitor/network';

export function SyncIndicator() {
  const [status, setStatus] = useState<'synced' | 'syncing' | 'offline' | 'error'>('synced');
  const [lastSync, setLastSync] = useState<Date | null>(null);

  useEffect(() => {
    const updateStatus = async () => {
      const netStatus = await Network.getStatus();
      if (!netStatus.connected) {
        setStatus('offline');
      } else {
        setStatus('synced');
      }
    };

    updateStatus();

    let listener: any;
    Network.addListener('networkStatusChange', (status) => {
      if (!status.connected) {
        setStatus('offline');
        toast.error('Koneksi terputus. Mode Offline aktif.');
      } else {
        setStatus('synced');
        toast.success('Koneksi tersambung. Menyinkronkan...');
        handleSync();
      }
    }).then(h => { listener = h; });

    return () => {
      if (listener) listener.remove();
    };
  }, []);

  const handleSync = async () => {
    const netStatus = await Network.getStatus();
    if (!netStatus.connected) {
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
    } catch (err) {
      console.error('Sync error:', err);
      setStatus('error');
      toast.error('Sinkronisasi gagal. Periksa koneksi internet.');
    }
  };

  const timeLabel = lastSync ? lastSync.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <button
      onClick={handleSync}
      title={lastSync ? `Terakhir sinkron: ${lastSync.toLocaleString('id-ID')}` : 'Belum sinkron'}
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all active:scale-95 group",
        status === 'synced' ? "bg-emerald-50 border-emerald-100 text-emerald-600" :
        status === 'syncing' ? "bg-indigo-50 border-indigo-100 text-indigo-600" :
        status === 'offline' ? "bg-slate-100 border-slate-200 text-slate-400" :
        "bg-red-50 border-red-100 text-red-600"
      )}
    >
      <div className="relative">
        {status === 'synced' && <Cloud className="size-3.5" />}
        {status === 'syncing' && <RefreshCw className="size-3.5 animate-spin" />}
        {status === 'offline' && <CloudOff className="size-3.5" />}
        {status === 'error' && <AlertCircle className="size-3.5" />}
        
        {status === 'synced' && (
          <span className="absolute -top-1 -right-1 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
        )}
      </div>
      
      <div className="flex flex-col items-start leading-none gap-0.5">
        <span className="text-[9px] font-black uppercase tracking-widest">
          {status === 'synced' ? 'Online' :
           status === 'syncing' ? 'Syncing' :
           status === 'offline' ? 'Offline' : 'Error'}
        </span>
        {timeLabel && (
          <span className="text-[7px] font-bold text-slate-400 group-hover:text-slate-500">{timeLabel}</span>
        )}
      </div>
    </button>
  );
}
