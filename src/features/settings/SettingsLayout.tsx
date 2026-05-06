'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, CloudCheck, CloudOff, CloudUpload, HardDrive, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/dexie';
import { supabase } from '@/lib/supabase';
import { triggerSync } from '@/hooks/useSync';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

import { useStaffStore } from '@/store/useStaffStore';
import { usePathname } from 'next/navigation';

export function SettingsLayout({
  title,
  children,
  rightAction,
}: {
  title: string;
  children: React.ReactNode;
  rightAction?: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { session } = useStaffStore();
  const [pendingSync, setPendingSync] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const [isAccountLinked, setIsAccountLinked] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (session?.role === 'staff') {
      const allowedPaths = ['/settings/absensi', '/settings/account', '/settings/bantuan'];
      const isAllowed = allowedPaths.some(path => pathname.includes(path));
      if (!isAllowed) {
        router.push('/kasir');
      }
    }
  }, [session, pathname, router]);

  const handleManualSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    const toastId = toast.loading('Menyinkronkan data ke awan...');
    try {
      await triggerSync(true);
      toast.success('Data berhasil disinkronkan!', { id: toastId });
    } catch (err: any) {
      toast.error(`Gagal sinkron: ${err.message || 'Koneksi bermasalah'}`, { id: toastId });
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    const updateSyncStatus = async () => {
      const pending = await db.transactions.where('synced').equals(0).count();
      setPendingSync(pending);
    };

    const hydrateLinkedAccount = async () => {
      const { data } = await supabase.auth.getUser();
      setIsAccountLinked(Boolean(data.user?.id));
    };

    const handleOnlineStatus = () => setIsOnline(navigator.onLine);

    handleOnlineStatus();
    hydrateLinkedAccount();
    updateSyncStatus();
    const interval = setInterval(updateSyncStatus, 3000);
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAccountLinked(Boolean(session?.user?.id));
    });
    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOnlineStatus);

    return () => {
      clearInterval(interval);
      subscription.unsubscribe();
      window.removeEventListener('online', handleOnlineStatus);
      window.removeEventListener('offline', handleOnlineStatus);
    };
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-background pb-20">
      <header className="flex items-center h-14 border-b bg-card sticky top-0 z-40 px-2">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-base font-semibold ml-1 min-w-0 truncate">{title}</h1>
        <div className="ml-auto flex min-w-0 shrink items-center gap-2">
          <button 
            onClick={handleManualSync}
            disabled={!isOnline || isSyncing}
            className={cn(
              "inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-1 text-[10px] text-muted-foreground shrink-0 transition-all active:scale-95",
              isSyncing && "animate-pulse border-indigo-200"
            )}
          >
            {isSyncing ? (
              <>
                <RefreshCw className="h-3 w-3 animate-spin text-indigo-500" />
                Proses...
              </>
            ) : !isAccountLinked ? (
              <>
                <HardDrive className="h-3 w-3 text-indigo-500" />
                Lokal
              </>
            ) : !isOnline ? (
              <>
                <CloudOff className="h-3 w-3 text-destructive" />
                Offline
              </>
            ) : pendingSync > 0 ? (
              <>
                <CloudUpload className="h-3 w-3 text-amber-500" />
                {pendingSync} Data
              </>
            ) : (
              <>
                <CloudCheck className="h-3 w-3 text-emerald-500" />
                Sinkron
              </>
            )}
          </button>
          {rightAction}
        </div>
      </header>
      <div className="flex-1">
        {children}
      </div>
    </div>
  );
}
