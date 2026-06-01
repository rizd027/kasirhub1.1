'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/services/supabase';
import { cn } from '@/lib/utils';

import { useStaffStore } from '@/store/useStaffStore';
import { usePathname } from 'next/navigation';

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
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isAccountLinked, setIsAccountLinked] = useState(false);

  useEffect(() => {
    if (session?.role === 'staff') {
      const allowedPaths = ['/absensi', '/pengaturan/account', '/pengaturan/bantuan'];
      const isAllowed = allowedPaths.some(path => pathname.includes(path));
      if (!isAllowed) {
        router.push('/kasir');
      }
    }
  }, [session, pathname, router]);

  useEffect(() => {
    const hydrateLinkedAccount = async () => {
      const { data } = await supabase.auth.getUser();
      setIsAccountLinked(Boolean(data.user?.id));
    };

    const handleOnlineStatus = () => setIsOnline(navigator.onLine);

    handleOnlineStatus();
    hydrateLinkedAccount();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAccountLinked(Boolean(session?.user?.id));
    });
    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOnlineStatus);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('online', handleOnlineStatus);
      window.removeEventListener('offline', handleOnlineStatus);
    };
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="flex items-center h-16 border-b bg-background/80 backdrop-blur-md sticky top-0 z-40 px-3">
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
            <span className="text-[7px] sm:text-[8px] font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] text-indigo-600 opacity-70 mb-0.5 truncate hidden xs:block">
              {subtitle}
            </span>
          )}
          <h1 className="text-[9px] sm:text-xs md:text-sm font-black text-slate-800 uppercase tracking-widest truncate whitespace-nowrap">
            {title}
          </h1>
        </div>

        <div className="ml-auto flex min-w-0 shrink items-center gap-2 sm:gap-3">
          {rightAction}
        </div>
      </header>
      <div className="flex-1">
        {children}
      </div>
    </div>
  );
}

