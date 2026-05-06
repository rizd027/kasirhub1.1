'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { MenuCatalog } from '@/features/menu/MenuCatalog';

function MenuPageContent() {
  const searchParams = useSearchParams();
  const uid = searchParams.get('uid');

  return <MenuCatalog initialUid={uid} />;
}

export default function MenuPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="size-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    }>
      <MenuPageContent />
    </Suspense>
  );
}
