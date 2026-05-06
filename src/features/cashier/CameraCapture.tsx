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
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startCamera = async () => {
    setLoading(true);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user' }, 
        audio: false 
      });
      setStream(s);
      if (videoRef.current) {
        videoRef.current.srcObject = s;
      }
    } catch (err) {
      console.error('Camera error:', err);
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
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-full aspect-square bg-black rounded-2xl overflow-hidden shadow-xl border-4 border-white">
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
            <div className="absolute bottom-4 left-0 right-0 flex justify-center">
              <Button 
                onClick={capture}
                className="h-14 w-14 rounded-full bg-white text-indigo-600 hover:bg-slate-100 shadow-lg border-4 border-indigo-100"
              >
                <Camera className="h-6 w-6" />
              </Button>
            </div>
          </>
        ) : (
          <>
            <img src={capturedImage} className="w-full h-full object-cover" />
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
              <Button 
                variant="destructive"
                className="h-12 w-12 rounded-full"
                onClick={() => setCapturedImage(null)}
              >
                <X className="h-5 w-5" />
              </Button>
              <Button 
                className="h-12 w-12 rounded-full bg-emerald-500 hover:bg-emerald-600"
                onClick={confirmCapture}
              >
                <Check className="h-5 w-5 text-white" />
              </Button>
            </div>
          </>
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" />
      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
        {capturedImage ? 'Konfirmasi Foto Selfie' : 'Posisikan Wajah di Tengah'}
      </p>

      <style jsx>{`
        .mirror {
          transform: scaleX(-1);
        }
      `}</style>
    </div>
  );
}
