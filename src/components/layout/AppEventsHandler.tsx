'use client';

import { useEffect } from 'react';
import { App } from '@capacitor/app';
import { usePathname, useRouter } from 'next/navigation';
import { toast } from 'sonner';

/**
 * AppEventsHandler handles Native Android events:
 * 1. Hardware Back Button: 
 *    - If on home/dashboard, ask before exit or just exit.
 *    - If in a sub-page, go back one step.
 *    - If a modal/overlay is open (managed by state elsewhere), this could be tricky, 
 *      but for standard routing it works well.
 */
export function AppEventsHandler() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    // 0. Global Error Logger for WSOD debugging
    const handleError = (event: ErrorEvent) => {
      const errorInfo = {
        message: event.message,
        source: event.filename,
        line: event.lineno,
        col: event.colno,
        stack: event.error?.stack,
        time: new Date().toISOString()
      };
      localStorage.setItem('kasirhub_last_crash', JSON.stringify(errorInfo));
      console.error('App Crash Logged:', errorInfo);
    };
    window.addEventListener('error', handleError);

    // 1. Version Check & Cache Purge (Fixes sync issues after APK update)
    const CURRENT_VERSION = '1.1.2'; 
    const lastVersion = localStorage.getItem('app_version');
    
    if (lastVersion !== CURRENT_VERSION) {
      localStorage.setItem('app_version', CURRENT_VERSION);
      
      if (lastVersion) {
        console.log('App updated: Purging stale caches...');
        // Clear Service Worker caches if any
        if ('caches' in window) {
          caches.keys().then(names => {
            for (let name of names) caches.delete(name);
          });
        }
        // Small toast to notify update
        toast.success('Aplikasi diperbarui ke versi ' + CURRENT_VERSION);
      }
    }

    // 2. Back Button Listener
    const listener = App.addListener('backButton', ({ canGoBack }) => {
      if (pathname === '/kasir' || pathname === '/login' || pathname === '/') {
        App.exitApp();
      } else {
        window.history.back();
      }
    });

    return () => {
      listener.then(h => h.remove());
    };
  }, [pathname]);

  return null;
}
