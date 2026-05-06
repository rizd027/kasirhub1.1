'use client';

import { MenuCatalog } from '@/features/menu/MenuCatalog';
import { useParams } from 'next/navigation';

export default function CustomMenuPage() {
  const params = useParams();
  const slug = params.slug as string;

  return <MenuCatalog slug={slug} />;
}
