/**
 * useOrientationClass — detects device orientation on Capacitor APK
 * and adds 'landscape-desktop' class to <html> element when in landscape mode.
 *
 * This enables CSS to apply desktop-style layout when the app is rotated horizontal.
 */
'use client';

import { useEffect } from 'react';

export function useOrientationClass() {
  useEffect(() => {
    const update = () => {
      const isLandscape =
        window.screen?.orientation?.type?.includes('landscape') ||
        window.innerWidth > window.innerHeight;

      if (isLandscape) {
        document.documentElement.classList.add('landscape-desktop');
        document.documentElement.classList.remove('portrait-mobile');
      } else {
        document.documentElement.classList.add('portrait-mobile');
        document.documentElement.classList.remove('landscape-desktop');
      }
    };

    update();
    window.addEventListener('orientationchange', update);
    window.addEventListener('resize', update);

    return () => {
      window.removeEventListener('orientationchange', update);
      window.removeEventListener('resize', update);
    };
  }, []);
}
