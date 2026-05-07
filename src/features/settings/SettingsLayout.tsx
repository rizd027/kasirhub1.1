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
import { SyncIndicator } from '@/components/layout/SyncIndicator';

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
    <div className="flex flex-col min-h-screen bg-background">
      <header className="flex items-center h-16 border-b bg-background/80 backdrop-blur-md sticky top-0 z-40 px-4">
        <Button variant="ghost" size="icon" className="size-9 rounded-xl hover:bg-slate-50 transition-all active:scale-90" onClick={() => router.back()}>
          <ChevronLeft className="h-5 w-5 text-slate-600" />
        </Button>
        <h1 className="text-sm font-black ml-2 min-w-0 truncate text-slate-800 uppercase tracking-widest">{title}</h1>
        <div className="ml-auto flex min-w-0 shrink items-center gap-3">
          <SyncIndicator />
          {rightAction}
        </div>
      </header>
      <div className="flex-1">
        {children}
      </div>
    </div>
  );
}
