'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { db, LocalProduct } from '@/db/dexie';
import { ProductForm } from '@/features/produk/ProductForm';

export default function EditProductPage() {
  const params = useParams();
  const id = params.id as string;
  const [product, setProduct] = useState<LocalProduct | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      db.products.get(id).then(p => {
        if (p) setProduct(p);
        setLoading(false);
      });
    }
  }, [id]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-white">
      <div className="animate-pulse flex flex-col items-center gap-4">
        <div className="size-12 rounded-lg bg-slate-50 border border-slate-100" />
        <div className="h-4 w-32 bg-slate-50 rounded" />
      </div>
    </div>
  );
  
  if (!product) return <div>Produk tidak ditemukan</div>;

  return <ProductForm initialData={product} />;
}
