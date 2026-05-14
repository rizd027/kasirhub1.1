'use client';

import { useRouter, usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export function MasterDataTabs() {
  const router = useRouter();
  const pathname = usePathname();

  const tabs = [
    { name: 'Daftar Produk', path: '/produk' },
    { name: 'Kategori', path: '/kategori' },
    { name: 'Bahan & Kemasan', path: '/bahan-baku' },
    { name: 'Bundling Paket', path: '/paket-bundling' },
    { name: 'Kalkulator HPP', path: '/kalkulator-hpp' },
  ];

  return (
    <div className="flex items-center px-4 border-b border-slate-100 bg-slate-50/50 overflow-x-auto no-scrollbar w-full">
      {tabs.map((tab) => {
        const isActive = pathname === tab.path;
        return (
          <button
            key={tab.path}
            onClick={() => router.push(tab.path)}
            className={cn(
              "px-4 md:px-6 py-4 text-[10px] font-black uppercase tracking-widest whitespace-nowrap border-b-2",
              isActive 
                ? "text-indigo-600 border-indigo-600 bg-white/50" 
                : "text-slate-400 hover:text-slate-600 border-transparent hover:bg-slate-100/30"
            )}
          >
            {tab.name}
          </button>
        );
      })}
    </div>
  );
}
