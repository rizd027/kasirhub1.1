'use client';

import { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, RefreshCw, Check, X, ArrowLeft, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CameraCaptureProps {
  onCapture: (blob: Blob) => void;
  onClose: () => void;
}

export function CameraCapture({ onCapture, onClose }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    startCamera();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          track.stop();
          console.log('Camera track stopped:', track.label);
        });
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, []);

  const startCamera = async () => {
    setLoading(true);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'user', 
          width: { ideal: 1920 },
          height: { ideal: 1080 } 
        }, 
        audio: false 
      });
      setStream(s);
      streamRef.current = s;
      if (videoRef.current) {
        videoRef.current.srcObject = s;
      }
    } catch (err) {
      console.error('Camera error:', err);
      alert('Gagal mengakses kamera. Mohon periksa izin kamera di browser Anda.');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const capture = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Flip horizontal for the saved image to match the preview
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setCapturedImage(dataUrl);
      }
    }
  };

  const confirmCapture = () => {
    if (canvasRef.current) {
      canvasRef.current.toBlob((blob) => {
        if (blob) onCapture(blob);
      }, 'image/jpeg', 0.85);
    }
  };

  return (
    <div className="relative h-screen w-screen bg-black overflow-hidden flex flex-col">
      {/* BACKGROUND VIDEO/IMAGE */}
      <div className="absolute inset-0 z-0">
        {!capturedImage ? (
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            className="w-full h-full object-cover mirror"
          />
        ) : (
          <img src={capturedImage} className="w-full h-full object-cover" alt="Captured" />
        )}
        
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black gap-4">
            <RefreshCw className="size-10 text-indigo-500 animate-spin" />
            <p className="text-[10px] font-black text-white uppercase tracking-[0.4em]">Menyiapkan Kamera...</p>
          </div>
        )}
      </div>

      {/* TOP HEADER - FLOATING */}
      <div className="relative z-10 p-6 pt-12 lg:pt-8 flex items-center justify-between pointer-events-none">
        <button 
          onClick={onClose}
          className="size-12 rounded-2xl bg-black/30 backdrop-blur-xl border border-white/10 flex items-center justify-center text-white pointer-events-auto hover:bg-black/50 transition-all active:scale-90"
        >
          <ArrowLeft className="size-6" />
        </button>

        <div className="px-6 py-3 rounded-2xl bg-black/30 backdrop-blur-xl border border-white/10 flex items-center gap-3">
          <div className="size-2 rounded-full bg-emerald-500 animate-pulse" />
          <p className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Live Verification</p>
        </div>

        <div className="size-12 rounded-2xl bg-black/30 backdrop-blur-xl border border-white/10 flex items-center justify-center text-white opacity-40">
           <Zap className="size-5" />
        </div>
      </div>

      {/* CENTER GUIDE (Optional) */}
      {!capturedImage && !loading && (
        <div className="flex-1 flex items-center justify-center pointer-events-none">
           <div className="w-64 h-80 rounded-[3rem] border-2 border-white/20 border-dashed relative">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 px-4 py-1 bg-white/10 backdrop-blur-md rounded-full border border-white/20">
                <p className="text-[8px] font-black text-white uppercase tracking-widest">Posisikan Wajah</p>
              </div>
           </div>
        </div>
      )}

      {/* BOTTOM CONTROLS */}
      <div className="relative z-10 p-10 pb-20 lg:pb-12 flex items-center justify-center">
        {!capturedImage ? (
          <div className="flex flex-col items-center gap-6">
            <p className="text-[9px] font-black text-white uppercase tracking-[0.3em] drop-shadow-lg opacity-60">Pastikan pencahayaan cukup</p>
            <button 
              onClick={capture}
              disabled={loading}
              className="group relative size-24 flex items-center justify-center"
            >
              <div className="absolute inset-0 rounded-full border-4 border-white opacity-40 group-active:scale-110 transition-transform" />
              <div className="size-20 rounded-full bg-white shadow-2xl flex items-center justify-center group-active:scale-90 transition-transform">
                <div className="size-16 rounded-full border-2 border-slate-900/10" />
              </div>
            </button>
          </div>
        ) : (
          <div className="w-full max-w-md grid grid-cols-2 gap-4">
            <button 
              onClick={() => setCapturedImage(null)}
              className="h-16 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 text-white font-black text-[11px] uppercase tracking-[0.2em] hover:bg-white/20 active:scale-95 transition-all flex items-center justify-center gap-3"
            >
              <RefreshCw className="size-5" /> Ulangi
            </button>
            <button 
              onClick={confirmCapture}
              className="h-16 rounded-2xl bg-emerald-600 text-white font-black text-[11px] uppercase tracking-[0.2em] shadow-xl shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-3"
            >
              <Check className="size-5" /> Konfirmasi
            </button>
          </div>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />
      
      <style jsx>{`
        .mirror {
          transform: scaleX(-1);
        }
      `}</style>
    </div>
  );
}
