'use client';

import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Camera, Zap, ZapOff, Loader2, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BarcodeScannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (decodedText: string) => void;
}

export function BarcodeScanner({ open, onOpenChange, onScan }: BarcodeScannerProps) {
  const [isInitializing, setIsInitializing] = useState(true);
  const [hasError, setHasError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    if (open) {
      setIsInitializing(true);
      setHasError(null);
      
      const startScanner = async () => {
        try {
          const html5QrCode = new Html5Qrcode("reader");
          html5QrCodeRef.current = html5QrCode;

          const config = {
            fps: 20,
            qrbox: { width: 250, height: 180 },
            aspectRatio: 1.0,
            formatsToSupport: [
              Html5QrcodeSupportedFormats.EAN_13,
              Html5QrcodeSupportedFormats.EAN_8,
              Html5QrcodeSupportedFormats.CODE_128,
              Html5QrcodeSupportedFormats.UPC_A,
              Html5QrcodeSupportedFormats.UPC_E,
              Html5QrcodeSupportedFormats.QR_CODE
            ]
          };

          await html5QrCode.start(
            { facingMode: "environment" },
            config,
            (decodedText) => {
              onScan(decodedText);
              stopScanner();
              onOpenChange(false);
            },
            () => {} 
          );
          
          setIsInitializing(false);
        } catch (err: any) {
          console.error("Scanner Error:", err);
          setHasError("Kamera tidak dapat diakses. Periksa izin di browser Anda.");
          setIsInitializing(false);
        }
      };

      const timer = setTimeout(startScanner, 400);
      return () => {
        clearTimeout(timer);
        stopScanner();
      };
    }
  }, [open]);

  const stopScanner = async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        await html5QrCodeRef.current.stop();
      } catch (err) {
        console.error("Failed to stop scanner:", err);
      }
    }
  };

  const toggleTorch = async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        const newState = !torchOn;
        await html5QrCodeRef.current.applyVideoConstraints({
          // @ts-ignore
          advanced: [{ torch: newState }]
        });
        setTorchOn(newState);
      } catch (err) {
        console.warn("Torch not supported");
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-[360px] p-0 overflow-hidden bg-white border-none shadow-2xl rounded-xl duration-0 animate-none data-[open]:animate-none data-[closed]:animate-none data-[state=open]:animate-none data-[state=closed]:animate-none">
        {/* Style to hide library UI elements and fix video fit */}
        <style dangerouslySetInnerHTML={{ __html: `
          #reader video { 
            object-fit: cover !important;
            width: 100% !important;
            height: 100% !important;
            border-radius: 0px !important;
          }
          #reader * {
            border: none !important;
            box-shadow: none !important;
          }
          #reader img {
            display: none !important;
          }
          #reader {
            border: none !important;
          }
        `}} />

        <DialogHeader className="px-5 py-4 bg-white border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-100">
                <Camera className="h-4 w-4" />
              </div>
              <div>
                <DialogTitle className="text-sm font-bold text-gray-900 tracking-tight">Scanner Barcode</DialogTitle>
                <div className="flex items-center gap-1.5">
                  <div className="h-1 w-1 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Kamera Aktif</span>
                </div>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="rounded-full h-8 w-8 text-gray-300 hover:text-gray-900 transition-all"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="relative aspect-square bg-gray-900 flex items-center justify-center overflow-hidden">
          {/* Scanner Container */}
          <div id="reader" className="absolute inset-0 w-full h-full" />

          {/* Loading / Error States */}
          {(isInitializing || hasError) && (
            <div className="absolute inset-0 z-40 bg-white flex flex-col items-center justify-center p-8 text-center">
              {isInitializing ? (
                <>
                  <div className="relative">
                    <Loader2 className="h-12 w-12 text-indigo-600 animate-spin mb-4" />
                    <div className="absolute inset-0 blur-xl bg-indigo-400/20 animate-pulse" />
                  </div>
                  <p className="text-sm font-black text-gray-900 tracking-tight">Menghubungkan...</p>
                </>
              ) : (
                <>
                  <div className="h-16 w-16 rounded-full bg-red-50 flex items-center justify-center text-red-500 mb-4">
                    <Info className="h-8 w-8" />
                  </div>
                  <p className="text-sm font-bold text-gray-900 mb-6">{hasError}</p>
                  <Button onClick={() => onOpenChange(false)} variant="outline" className="rounded-2xl border-2 px-8">
                    Tutup
                  </Button>
                </>
              )}
            </div>
          )}

          {/* Minimalist Scan Box */}
          {!isInitializing && !hasError && (
            <div className="absolute inset-0 z-30 pointer-events-none flex items-center justify-center">
              <div className="relative w-[240px] h-[160px]">
                {/* Corner Marks (Sharp) */}
                <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-indigo-600 rounded-none" />
                <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-indigo-600 rounded-none" />
                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-indigo-600 rounded-none" />
                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-indigo-600 rounded-none" />
                
                {/* Minimal Ready Text */}
                <div className="absolute -bottom-8 left-0 right-0 text-center">
                  <span className="text-[8px] font-black text-white/80 uppercase tracking-[0.3em]">
                    Ready to Scan
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Compact Footer */}
        <div className="px-5 py-4 bg-white border-t border-gray-100 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest leading-none mb-1">Instruksi</span>
            <span className="text-[11px] font-bold text-gray-500">Posisikan barcode di tengah</span>
          </div>
          
          {!isInitializing && !hasError && (
            <Button 
              variant={torchOn ? "default" : "outline"} 
              size="sm" 
              onClick={toggleTorch}
              className={cn(
                "h-9 px-4 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all",
                torchOn 
                  ? "bg-amber-500 border-amber-400 hover:bg-amber-600 text-white" 
                  : "bg-white border-gray-100 text-gray-500 hover:bg-gray-50"
              )}
            >
              {torchOn ? <ZapOff className="h-3.5 w-3.5 mr-2" /> : <Zap className="h-3.5 w-3.5 mr-2" />}
              Flash {torchOn ? "OFF" : "ON"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
