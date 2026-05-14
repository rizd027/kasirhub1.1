/**
 * useOrientationClass — detects device orientation
 * and adds 'landscape-desktop' class to <html> element when in landscape mode.
 *
 * For smartphones and tablets, it dynamically scales the viewport to 70% 
 * to simulate a wider desktop screen, allowing desktop UI layouts to fit perfectly.
 */
'use client';

import { useEffect, useLayoutEffect } from 'react';
import { usePathname } from 'next/navigation';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export function useOrientationClass() {
  const pathname = usePathname();

  useIsomorphicLayoutEffect(() => {
    // Keep a reference to the viewport meta tag
    let viewportMeta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null;
    if (!viewportMeta) {
      viewportMeta = document.createElement('meta');
      viewportMeta.name = 'viewport';
      document.head.appendChild(viewportMeta);
    }

    const update = () => {
      // Use matchMedia for reliable orientation detection, especially in Chrome DevTools
      const isLandscape = window.matchMedia('(orientation: landscape)').matches;

      // Identify if the device is likely a smartphone or tablet
      const isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
      const maxScreenDimension = Math.max(window.screen?.width || 0, window.screen?.height || 0);
      const isMobileOrTablet = isTouchDevice || maxScreenDimension < 1366;

      if (isLandscape && isMobileOrTablet) {
        // Activate desktop layout classes
        document.documentElement.classList.add('landscape-desktop');
        document.documentElement.classList.remove('portrait-mobile');
        
        // Force layout width to 1200px globally in landscape mobile/tablet
        // to maintain the "desktop" ~70% scale feel across all pages.
        viewportMeta.setAttribute('content', 'width=1200, user-scalable=no');
      } else if (isLandscape) {
        // Real Desktop Landscape
        document.documentElement.classList.add('landscape-desktop');
        document.documentElement.classList.remove('portrait-mobile');
        viewportMeta.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
      } else {
        // Portrait Mode (Mobile/Tablet)
        document.documentElement.classList.add('portrait-mobile');
        document.documentElement.classList.remove('landscape-desktop');
        viewportMeta.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
      }
    };

    update();
    window.addEventListener('orientationchange', update);
    window.addEventListener('resize', update);

    return () => {
      window.removeEventListener('orientationchange', update);
      window.removeEventListener('resize', update);
      
      // Restore standard viewport on unmount
      if (viewportMeta) {
        viewportMeta.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
      }
    };
  }, [pathname]);
}

