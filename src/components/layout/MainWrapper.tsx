'use client';

import { useLayoutStore } from '@/store/useLayoutStore';
import { cn } from '@/lib/utils';
import { usePathname } from 'next/navigation';
import { useOrientationClass } from '@/hooks/useOrientationClass';

export function MainWrapper({ children }: { children: React.ReactNode }) {
  const { isFullscreen } = useLayoutStore();
  const pathname = usePathname();
  
  useOrientationClass();
  
  const isOperationalPage = pathname?.startsWith('/absensi') || pathname?.startsWith('/kasir') || pathname?.startsWith('/login') || pathname?.startsWith('/register') || pathname?.startsWith('/pengaturan') || pathname?.startsWith('/laporan') || pathname?.startsWith('/riwayat') || pathname?.startsWith('/karyawan') || pathname?.startsWith('/toko') || pathname?.startsWith('/produk') || pathname?.startsWith('/stok') || pathname?.startsWith('/kalkulator-hpp') || pathname?.startsWith('/paket-bundling') || pathname?.startsWith('/bahan-baku') || pathname?.startsWith('/biaya-pengolahan') || pathname?.startsWith('/produk-turunan') || pathname?.startsWith('/kategori') || pathname?.startsWith('/qr-menu');
  

  return (
    <main className={cn(
      "flex-1 transition-all duration-300 min-h-0 flex flex-col",
      !isFullscreen && "pb-16 lg:pb-0"
    )}>
      <div className={cn(
        "flex-1 flex flex-col min-h-0",
        !isOperationalPage && !isFullscreen && "lg:w-full lg:px-12"
      )}>
        {children}
      </div>
    </main>
  );
}
