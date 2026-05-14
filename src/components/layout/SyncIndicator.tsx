'use client';

import { useState, useEffect } from 'react';
import { Cloud, CloudOff, RefreshCw, AlertCircle } from 'lucide-react';
import { useSync } from '@/hooks/useSync';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export function SyncIndicator() {
  const { isSyncing: isGlobalSyncing, pendingCount, failedCount, performSync } = useSync();
  const [lastSync, setLastSync] = useState<Date | null>(null);

  useEffect(() => {
    const handleOnline = () => {
      toast.success('Koneksi tersambung. Menyinkronkan...');
      performSync().catch(console.error);
    };

    const handleOffline = () => {
      toast.error('Koneksi terputus. Mode Offline aktif.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const isSyncing = isGlobalSyncing || pendingCount > 0;
  const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

  const timeLabel = lastSync ? lastSync.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <div
      className={cn(
        "relative size-9 flex items-center justify-center rounded-lg border transition-all duration-300",
        isSyncing ? "bg-indigo-50 border-indigo-100 text-indigo-600 shadow-sm" :
        failedCount > 0 ? "bg-rose-50 border-rose-100 text-rose-600" :
        isOffline ? "bg-slate-50 border-slate-200 text-slate-300" :
        "bg-white border-slate-100 text-slate-400 hover:border-slate-200"
      )}
      title={
        isOffline ? 'Mode Offline' : 
        failedCount > 0 ? `${failedCount} item gagal sinkron` :
        isSyncing ? `Sinkronisasi... (${pendingCount} item)` : 
        `Terakhir sinkron: ${timeLabel || 'Baru saja'}`
      }
    >
      <div className="relative flex items-center justify-center">
        {failedCount > 0 ? (
          <AlertCircle className="size-5 text-rose-500 animate-pulse" />
        ) : isSyncing ? (
          <RefreshCw className="size-4 animate-spin text-indigo-600" />
        ) : (
          <Cloud className="size-5 transition-transform hover:scale-110" />
        )}
        
        {/* Status Dot */}
        <span className={cn(
          "absolute -top-2.5 -right-2.5 flex h-2 w-2 rounded-full border border-white",
          isOffline ? "bg-rose-500" : "bg-emerald-500"
        )}>
          {!isOffline && (
             <span className={cn("absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75", (isSyncing || pendingCount > 0) && "animate-ping")}></span>
          )}
        </span>

        {/* Queue Count Badge */}
        {pendingCount > 0 && !isOffline && (
          <div className="absolute -bottom-3 -right-3 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-indigo-600 text-[9px] font-black text-white border-2 border-white shadow-sm">
            {pendingCount > 99 ? '99+' : pendingCount}
          </div>
        )}

        {/* Failed Count Badge */}
        {failedCount > 0 && (
          <div className="absolute -top-3 -left-3 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-rose-600 text-[9px] font-black text-white border-2 border-white shadow-sm">
            {failedCount}
          </div>
        )}
      </div>
    </div>
  );
}

