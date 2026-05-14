'use client';

import { useEffect, useLayoutEffect } from 'react';
import { usePathname } from 'next/navigation';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export function useOrientationClass() {
  const pathname = usePathname();

  useIsomorphicLayoutEffect(() => {
    let viewportMeta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null;
    if (!viewportMeta) {
      viewportMeta = document.createElement('meta');
      viewportMeta.name = 'viewport';
      document.head.appendChild(viewportMeta);
    }

    const update = () => {
      const isLandscape = window.matchMedia('(orientation: landscape)').matches;

      const isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
      const maxScreenDimension = Math.max(window.screen?.width || 0, window.screen?.height || 0);
      const isMobileOrTablet = isTouchDevice || maxScreenDimension < 1366;

      if (isLandscape && isMobileOrTablet) {
        document.documentElement.classList.add('landscape-desktop');
        document.documentElement.classList.remove('portrait-mobile');
        
        viewportMeta.setAttribute('content', 'width=1200, user-scalable=no');
      } else if (isLandscape) {
        document.documentElement.classList.add('landscape-desktop');
        document.documentElement.classList.remove('portrait-mobile');
        viewportMeta.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
      } else {
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
      
      if (viewportMeta) {
        viewportMeta.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
      }
    };
  }, [pathname]);
}

