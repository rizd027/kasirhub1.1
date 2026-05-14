'use client';

import { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, RefreshCw, Check, X } from 'lucide-react';

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
      // Robust cleanup: stop all tracks from the ref
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          track.stop();
          console.log('Camera track stopped:', track.label);
        });
        streamRef.current = null;
      }
    };
  }, []);

  const startCamera = async () => {
    setLoading(true);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user', width: 1280, height: 720 }, 
        audio: false 
      });
      setStream(s);
      streamRef.current = s; // Store in ref for cleanup
      if (videoRef.current) {
        videoRef.current.srcObject = s;
      }
    } catch (err) {
      console.error('Camera error:', err);
      alert('Gagal mengakses kamera. Mohon periksa izin kamera di browser Anda.');
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
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setCapturedImage(dataUrl);
        
        canvas.toBlob((blob) => {
          if (blob) {
            // We'll pass the blob to the parent when confirmed
          }
        }, 'image/jpeg');
      }
    }
  };

  const confirmCapture = () => {
    if (canvasRef.current) {
      canvasRef.current.toBlob((blob) => {
        if (blob) onCapture(blob);
      }, 'image/jpeg');
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden shadow-2xl border-4 border-white ring-2 ring-slate-200">
        {!capturedImage ? (
          <>
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              className="w-full h-full object-cover mirror"
            />
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white">
                <RefreshCw className="h-8 w-8 animate-spin" />
              </div>
            )}
            
            {/* Shutter Overlay */}
            {!loading && (
              <div className="absolute inset-0 flex flex-col items-center justify-end pb-4 bg-gradient-to-t from-black/40 to-transparent">
                <button 
                  onClick={capture}
                  className="w-16 h-16 rounded-full border-4 border-white flex items-center justify-center bg-white/20 hover:bg-white/40 active:scale-90 transition-all shadow-xl"
                >
                  <div className="w-12 h-12 rounded-full bg-white" />
                </button>
                <p className="text-[9px] text-white font-black uppercase tracking-widest mt-2 drop-shadow-md">Ambil Foto</p>
              </div>
            )}
          </>
        ) : (
          <>
            <img src={capturedImage} className="w-full h-full object-cover" />
            <div className="absolute inset-0 flex flex-col items-center justify-end pb-4 bg-gradient-to-t from-black/60 to-transparent">
              <div className="flex gap-4">
                <Button 
                  variant="outline"
                  className="h-14 px-6 rounded-lg bg-white/10 backdrop-blur-md border-2 border-white/30 text-white hover:bg-white/20 font-black text-[10px] uppercase tracking-widest gap-2"
                  onClick={() => setCapturedImage(null)}
                >
                  <X className="h-4 w-4" /> Ulangi
                </Button>
                <Button 
                  className="h-14 px-8 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] uppercase tracking-widest gap-2 shadow-xl shadow-indigo-500/20"
                  onClick={confirmCapture}
                >
                  <Check className="h-4 w-4" /> Konfirmasi
                </Button>
              </div>
            </div>
          </>
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

