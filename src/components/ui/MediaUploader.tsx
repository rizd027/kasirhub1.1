'use client';

import { useState, useRef } from 'react';
import { Camera, Image, Trash2, Loader2, Sparkles, X, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface MediaUploaderProps {
  imageUrl?: string;
  onUpload: (url: string) => void;
  onRemove: () => void;
  isIdentifying?: boolean;
  modeLabel?: string;
}

export function MediaUploader({ 
  imageUrl, 
  onUpload, 
  onRemove, 
  isIdentifying = false,
  modeLabel = "Produk"
}: MediaUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onUpload(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="relative w-full aspect-square bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 overflow-hidden group">
      {imageUrl ? (
        <>
          <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="absolute top-2 right-2 z-30 p-2 bg-rose-600 text-white rounded-lg shadow-lg hover:bg-rose-700 transition-all transform hover:scale-110 active:scale-95"
            title="Hapus Foto"
          >
            <Trash2 className="size-4" />
          </button>

          {/* AI Analyzing Overlay */}
          {isIdentifying && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-indigo-900/40 backdrop-blur-[2px] text-white">
              <div className="relative mb-3">
                <Sparkles className="size-10 text-indigo-300 animate-pulse" />
                <div className="absolute -inset-2 bg-indigo-400/20 rounded-full blur-xl animate-pulse"></div>
              </div>
              <p className="text-[10px] font-black tracking-[0.2em] uppercase text-indigo-50 drop-shadow-lg">AI ANALYZING</p>
              <p className="text-[10px] font-medium text-indigo-100/80 mb-2 italic">Identifying {modeLabel}...</p>
              <div className="flex gap-1.5 mt-1">
                <span className="size-1.5 rounded-full bg-indigo-300 animate-bounce [animation-delay:-0.3s]"></span>
                <span className="size-1.5 rounded-full bg-indigo-200 animate-bounce [animation-delay:-0.15s]"></span>
                <span className="size-1.5 rounded-full bg-white animate-bounce"></span>
              </div>
            </div>
          )}

          <div className={`absolute inset-0 bg-black/40 ${isIdentifying ? 'opacity-0 pointer-events-none' : 'opacity-0 group-hover:opacity-100'} flex flex-col gap-2 items-center justify-center transition-opacity`}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-full h-9 px-5 font-black uppercase tracking-widest text-[9px] w-32"
            >
              Ganti Foto
            </Button>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center text-center p-6 w-full h-full justify-center">
          <div className="flex gap-3 mb-4">
            <div 
              className="size-14 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-200 cursor-pointer transition-all"
              onClick={() => fileInputRef.current?.click()}
              title="Upload dari Galeri"
            >
              <Image className="size-6" />
            </div>
            <div 
              className="size-14 rounded-2xl bg-indigo-600 border border-indigo-500 shadow-lg shadow-indigo-100 flex items-center justify-center text-white hover:bg-indigo-700 cursor-pointer transition-all animate-in zoom-in duration-300"
              onClick={() => cameraInputRef.current?.click()}
              title="Ambil Foto Langsung"
            >
              <Camera className="size-6" />
            </div>
          </div>
          <p className="text-[11px] font-black text-slate-900 uppercase tracking-widest mb-1">Pilih Media</p>
          <p className="text-[10px] font-medium text-slate-400 uppercase tracking-tighter">Ambil Foto atau Pilih Galeri</p>
        </div>
      )}

      {/* Hidden Inputs */}
      <input 
        type="file" 
        ref={fileInputRef}
        className="hidden" 
        accept="image/*"
        onChange={handleFileInput}
      />
      <input 
        type="file" 
        ref={cameraInputRef}
        className="hidden" 
        accept="image/*"
        capture="environment"
        onChange={handleFileInput}
      />
    </div>
  );
}
