'use client';

import { useLayoutStore } from '@/store/useLayoutStore';
import { cn } from '@/lib/utils';

export function MainWrapper({ children }: { children: React.ReactNode }) {
  const { isFullscreen } = useLayoutStore();
  
  return (
    <main className={cn("flex-1 transition-all duration-300", !isFullscreen && "pb-16 lg:pb-0")}>
      {children}
    </main>
  );
}
