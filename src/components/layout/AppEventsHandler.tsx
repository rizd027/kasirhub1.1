'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { toast } from 'sonner';

/**
 * AppEventsHandler handles app-wide events:
 * 1. Window Error Logging: for debugging production issues.
 * 2. Version Check & Cache Purge: ensures users get the latest assets.
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

    // 0.1 Handle ChunkLoadError (Next.js 404 fix on redeploy)
    const handleRejection = (event: PromiseRejectionEvent) => {
      if (event.reason && (
        event.reason.name === 'ChunkLoadError' || 
        event.reason.message?.includes('Loading chunk') ||
        event.reason.message?.includes('Failed to fetch dynamically imported module')
      )) {
        console.warn('ChunkLoadError detected, reloading page...');
        window.location.reload();
      }
    };
    window.addEventListener('unhandledrejection', handleRejection);

    // 1. Version Check & Cache Purge (Fixes sync issues after update)
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

    return () => {
      window.removeEventListener('error', handleError);
    };
  }, [pathname]);

  return null;
}
