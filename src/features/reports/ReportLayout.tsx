'use client';

import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ReportLayout({ title, children }: { title: string; children: React.ReactNode }) {
  const router = useRouter();
  return (
    <div className="flex flex-col h-full bg-slate-50 pb-20">
      <header className="flex items-center h-14 border-b bg-white sticky top-0 z-40 px-2">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="text-slate-600">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-base font-black text-slate-800 ml-1 tracking-tight">{title}</h1>
      </header>
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  );
}
