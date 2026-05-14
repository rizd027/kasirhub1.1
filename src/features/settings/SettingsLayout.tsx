'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, CloudCheck, CloudOff, CloudUpload, HardDrive, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { db } from '@/db/dexie';
import { supabase } from '@/services/supabase';
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
  leftAction,
  backUrl,
  subtitle,
}: {
  title: string;
  children: React.ReactNode;
  rightAction?: React.ReactNode;
  leftAction?: React.ReactNode;
  backUrl?: string;
  subtitle?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { session } = useStaffStore();
  const [pendingSync, setPendingSync] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isAccountLinked, setIsAccountLinked] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (session?.role === 'staff') {
      const allowedPaths = ['/absensi', '/pengaturan/account', '/pengaturan/bantuan'];
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
      const pending = await db.transactions.where('sync_status').equals('pending').count();
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
        {leftAction ? (
          leftAction
        ) : (
          <Button 
            variant="ghost" 
            size="icon" 
            className="size-9 rounded-lg hover:bg-slate-50 transition-all active:scale-90 shrink-0" 
            onClick={() => backUrl ? router.push(backUrl) : router.back()}
          >
            <ChevronLeft className="h-5 w-5 text-slate-600" />
          </Button>
        )}
        
        <div className="flex flex-col min-w-0 overflow-hidden ml-1 sm:ml-2">
          {subtitle && (
            <span className="text-[7px] sm:text-[8px] font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] text-indigo-600 opacity-70 mb-0.5 truncate">
              {subtitle}
            </span>
          )}
          <h1 className="text-[11px] sm:text-sm font-black text-slate-800 uppercase tracking-widest truncate whitespace-nowrap">
            {title}
          </h1>
        </div>

        <div className="ml-auto flex min-w-0 shrink items-center gap-2 sm:gap-3">
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

