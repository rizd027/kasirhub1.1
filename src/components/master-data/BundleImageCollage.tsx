'use client';

import { useState, useEffect } from 'react';
import { db, LocalProduct } from '@/db/dexie';
import { Boxes, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BundleImageCollageProps {
  productIds: string[];
  className?: string;
}

export function BundleImageCollage({ productIds, className }: BundleImageCollageProps) {
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchImages = async () => {
      try {
        const products = await db.products
          .where('id')
          .anyOf(productIds)
          .toArray();
        
        // Map back to maintain order if possible, and filter out null images
        const foundImages = productIds
          .map(id => products.find(p => p.id === id)?.image_url)
          .filter((img): img is string => !!img);
        
        setImages(foundImages);
      } catch (err) {
        console.error('Failed to fetch bundle images:', err);
      } finally {
        setLoading(false);
      }
    };

    if (productIds.length > 0) {
      fetchImages();
    } else {
      setLoading(false);
    }
  }, [productIds]);

  if (loading) {
    return (
      <div className={cn("bg-slate-50 flex items-center justify-center rounded-lg border border-slate-100", className)}>
        <div className="size-4 border-2 border-slate-200 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div className={cn("bg-slate-50 flex items-center justify-center rounded-lg border border-slate-100 group-hover:bg-indigo-50/50 transition-colors", className)}>
        <Boxes className="size-6 text-slate-300 group-hover:text-indigo-400" />
      </div>
    );
  }

  // Determine grid layout based on number of images
  const displayImages = images.slice(0, 4);
  const count = displayImages.length;

  return (
    <div className={cn("relative rounded-lg overflow-hidden border border-slate-100 bg-white grid", 
      count === 1 ? "grid-cols-1" : "grid-cols-2",
      className
    )}>
      {displayImages.map((src, idx) => (
        <div 
          key={idx} 
          className={cn(
            "relative overflow-hidden bg-slate-50",
            count === 3 && idx === 0 ? "row-span-2" : ""
          )}
        >
          <img 
            src={src} 
            alt="Product" 
            loading="lazy"
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'https://via.placeholder.com/150?text=?';
            }}
          />
        </div>
      ))}
      {/* Overlay count if more than 4 */}
      {images.length > 4 && (
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
          <span className="text-[10px] font-black text-white">+{images.length - 4}</span>
        </div>
      )}
    </div>
  );
}
