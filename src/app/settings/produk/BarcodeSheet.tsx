'use client';

import { useEffect, useRef, useState } from 'react';
import { LocalProduct } from '@/lib/dexie';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Printer, Settings2 } from 'lucide-react';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import JsBarcode from 'jsbarcode';

interface BarcodeSheetProps {
  products: LocalProduct[];
  onClose: () => void;
}

const LABEL_CONFIGS = {
  '33x15': { name: 'Ritel (33x15mm)', width: '33mm', height: '15mm', fontSize: '7px', barcodeHeight: 25, columns: 3 },
  '30x40': { name: 'Kemasan (30x40mm)', width: '30mm', height: '40mm', fontSize: '9px', barcodeHeight: 40, columns: 3 },
  '32x64': { name: 'No. 103 (64x32mm)', width: '64mm', height: '32mm', fontSize: '10px', barcodeHeight: 35, columns: 2 },
  '33x25': { name: 'Gudang (33x25mm)', width: '33mm', height: '25mm', fontSize: '8px', barcodeHeight: 30, columns: 3 },
  '48x33': { name: 'Aset (48x33mm)', width: '48mm', height: '33mm', fontSize: '10px', barcodeHeight: 40, columns: 2 },
  '38x76': { name: 'No. 121 (76x38mm)', width: '76mm', height: '38mm', fontSize: '11px', barcodeHeight: 45, columns: 2 },
};

type LabelSizeKey = keyof typeof LABEL_CONFIGS;

function normalizeSkuForFormat(sku: string, format: string): string {
  const digits = sku.replace(/\D/g, '');
  
  switch (format) {
    case 'EAN13':
      // EAN13 needs 13 digits. If shorter, pad with zeros. If longer, truncate.
      return digits.padStart(13, '0').slice(-13);
    case 'EAN8':
      return digits.padStart(8, '0').slice(-8);
    case 'UPC':
      return digits.padStart(12, '0').slice(-12);
    case 'ITF14':
      return digits.padStart(14, '0').slice(-14);
    default:
      return sku; // Code 128 and Code 39 are flexible
  }
}

function BarcodeLabel({ product, storeName, config, barcodeType }: { 
  product: LocalProduct; 
  storeName: string; 
  config: typeof LABEL_CONFIGS['33x15'];
  barcodeType: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [isNormalized, setIsNormalized] = useState(false);
  const [isFallback, setIsFallback] = useState(false);

  useEffect(() => {
    if (svgRef.current && product.sku) {
      const tryRender = (data: string, format: string) => {
        try {
          JsBarcode(svgRef.current, data, {
            format: format,
            width: config.width === '33mm' ? 1.1 : 1.7,
            height: config.barcodeHeight,
            displayValue: false,
            margin: 0,
            background: 'transparent',
          });
          return true;
        } catch (e) {
          return false;
        }
      };

      setIsNormalized(false);
      setIsFallback(false);

      // 1. Try original data with selected format
      if (tryRender(product.sku, barcodeType)) return;

      // 2. Try normalized data with selected format
      const normalizedData = normalizeSkuForFormat(product.sku, barcodeType);
      if (normalizedData !== product.sku) {
        if (tryRender(normalizedData, barcodeType)) {
          setIsNormalized(true);
          return;
        }
      }

      // 3. Absolute Fallback: Code 128 (always works)
      if (tryRender(product.sku, 'CODE128')) {
        setIsFallback(true);
      }
    }
  }, [product.sku, barcodeType, config]);

  const toCurrency = (v: number) => `Rp ${v.toLocaleString('id-ID')}`;

  return (
    <div
      className="barcode-label border border-black/10 rounded flex flex-col items-center bg-white shadow-sm overflow-hidden"
      style={{ 
        width: config.width, 
        height: config.height, 
        pageBreakInside: 'avoid', 
        breakInside: 'avoid',
        padding: '1mm'
      }}
    >
      <div className="w-full text-center border-b border-dashed border-black/10 pb-0.5 mb-0.5">
        <p style={{ fontSize: `calc(${config.fontSize} - 2px)` }} className="font-black uppercase tracking-tighter text-gray-800 truncate px-0.5">
          {storeName || 'KASIRHUB'}
        </p>
      </div>

      <p style={{ fontSize: config.fontSize }} className="font-bold text-center leading-none text-gray-900 truncate w-full px-0.5 mb-0.5">
        {product.name}
      </p>

      <div className="flex-1 w-full flex items-center justify-center py-0.5 overflow-hidden relative">
        <svg ref={svgRef} className="max-w-full h-auto" />
        {(isNormalized || isFallback) && (
          <div className={`absolute top-0 right-0 ${isFallback ? 'bg-red-500' : 'bg-amber-500'} text-white text-[5px] px-1 rounded-bl-sm font-bold print:hidden uppercase`}>
            {isFallback ? 'Emergency Fix' : 'Auto-Fix'}
          </div>
        )}
      </div>

      <div className="w-full flex justify-between items-end px-0.5 mt-0.5 border-t border-dashed border-black/10 pt-0.5">
        <div className="flex flex-col">
          <p style={{ fontSize: `calc(${config.fontSize} - 4px)` }} className="text-[5px] text-muted-foreground uppercase font-bold leading-none mb-0.5">
            {isFallback ? 'Format Dialihkan' : `SKU ${isNormalized ? '(Disesuaikan)' : ''}`}
          </p>
          <p style={{ fontSize: `calc(${config.fontSize} - 3px)` }} className="font-mono text-gray-500 truncate max-w-[50px]">
            {product.sku}
          </p>
        </div>
        <p style={{ fontSize: `calc(${config.fontSize} + 1px)` }} className="font-black text-gray-900">
          {toCurrency(product.price_sell)}
        </p>
      </div>
    </div>
  );
}

export function BarcodeSheet({ products, onClose }: BarcodeSheetProps) {
  const [storeName, setStoreName] = useState('');
  const [labelSize, setLabelSize] = useState<LabelSizeKey>('33x25');
  const [barcodeType, setBarcodeType] = useState('CODE128');

  useEffect(() => {
    const saved = localStorage.getItem('toko_info');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.nama) setStoreName(parsed.nama);
      } catch (e) { }
    }
  }, []);

  const config = LABEL_CONFIGS[labelSize];
  const handlePrint = () => window.print();

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const lastPinchDistance = useRef<number | null>(null);

  useEffect(() => {
    const scrollArea = scrollAreaRef.current;
    if (!scrollArea) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setScale(prev => Math.min(Math.max(prev + delta, 0.2), 3));
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const dist = Math.hypot(
          e.touches[0].pageX - e.touches[1].pageX,
          e.touches[0].pageY - e.touches[1].pageY
        );

        if (lastPinchDistance.current !== null) {
          const delta = (dist - lastPinchDistance.current) / 100;
          setScale(prev => Math.min(Math.max(prev + delta, 0.2), 3));
        }
        lastPinchDistance.current = dist;
      }
    };

    const handleTouchEnd = () => {
      lastPinchDistance.current = null;
    };

    const updateInitialScale = () => {
      if (scrollAreaRef.current && paperRef.current) {
        const containerWidth = scrollAreaRef.current.clientWidth - 48;
        const paperWidth = paperRef.current.offsetWidth;
        if (containerWidth < paperWidth) {
          setScale(containerWidth / paperWidth);
        }
      }
    };

    updateInitialScale();
    scrollArea.addEventListener('wheel', handleWheel, { passive: false });
    scrollArea.addEventListener('touchmove', handleTouchMove, { passive: false });
    scrollArea.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('resize', updateInitialScale);

    return () => {
      scrollArea.removeEventListener('wheel', handleWheel);
      scrollArea.removeEventListener('touchmove', handleTouchMove);
      scrollArea.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('resize', updateInitialScale);
    };
  }, [labelSize]);

  return (
    <div className="barcode-sheet-wrapper fixed inset-0 bottom-16 z-50 bg-background flex flex-col overflow-hidden">
      <style>{`
        @media print {
          body { visibility: hidden; background: white !important; margin: 0; padding: 0; }
          .barcode-sheet-wrapper { 
            visibility: visible !important; position: absolute !important; left: 0 !important; top: 0 !important;
            width: 100% !important; height: auto !important; overflow: visible !important; background: white !important; z-index: 9999 !important;
          }
          .barcode-sheet-wrapper * { visibility: visible !important; }
          nav, .barcode-sheet-header, .barcode-sheet-info, .barcode-sheet-controls { display: none !important; }
          .barcode-scroll-area { overflow: visible !important; height: auto !important; padding: 0 !important; margin: 0 !important; }
          .barcode-paper-container { transform: none !important; margin: 0 !important; padding: 0 !important; box-shadow: none !important; width: 100% !important; }
          .barcode-grid { 
            display: grid !important; 
            grid-template-columns: repeat(${config.columns}, ${config.width}) !important;
            gap: 2mm !important; 
            padding: 5mm !important;
          }
          .barcode-label { 
            border: 1px solid #eee !important; box-shadow: none !important;
            page-break-inside: avoid !important; break-inside: avoid !important; 
            background: white !important; visibility: visible !important;
          }
          .barcode-label p, .barcode-label div, .barcode-label svg { visibility: visible !important; color: black !important; }
        }
      `}</style>

      <header className="barcode-sheet-header flex items-center min-h-16 pt-[env(safe-area-inset-top)] border-b bg-card px-2 shrink-0 gap-1">
        <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-sm font-bold ml-1 shrink-0 hidden xs:block">Cetak Barcode</h1>
        
        <div className="flex-1 flex items-center justify-center gap-1.5 px-1 barcode-sheet-controls overflow-hidden">
          <Select value={labelSize} onValueChange={(v) => setLabelSize(v as LabelSizeKey)}>
            <SelectTrigger className="flex-1 min-w-[90px] max-w-[140px] h-9 text-[10px] px-2">
              <SelectValue placeholder="Ukuran" />
            </SelectTrigger>
            <SelectContent className="w-[200px]" side="bottom" align="start" sideOffset={4}>
              <SelectGroup>
                <SelectLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">Ritel</SelectLabel>
                <SelectItem value="33x15">33x15mm</SelectItem>
                <SelectItem value="30x40">30x40mm</SelectItem>
                <SelectItem value="32x64">No. 103</SelectItem>
              </SelectGroup>
              <SelectGroup>
                <SelectLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">Gudang</SelectLabel>
                <SelectItem value="33x25">33x25mm</SelectItem>
                <SelectItem value="48x33">48x33mm</SelectItem>
                <SelectItem value="38x76">No. 121</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>

          <Select value={barcodeType} onValueChange={(v) => v && setBarcodeType(v)}>
            <SelectTrigger className="flex-1 min-w-[80px] max-w-[120px] h-9 text-[10px] px-2">
              <SelectValue placeholder="Format" />
            </SelectTrigger>
            <SelectContent className="w-[200px]" side="bottom" align="start" sideOffset={4}>
              <SelectGroup>
                <SelectLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">Ritel</SelectLabel>
                <SelectItem value="EAN13">EAN-13</SelectItem>
                <SelectItem value="EAN8">EAN-8</SelectItem>
                <SelectItem value="UPC">UPC-A</SelectItem>
              </SelectGroup>
              <SelectGroup>
                <SelectLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">Logistik</SelectLabel>
                <SelectItem value="CODE128">Code 128</SelectItem>
                <SelectItem value="CODE39">Code 39</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <Button size="sm" className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3 shrink-0" onClick={handlePrint}>
          <Printer className="h-4 w-4" /> <span className="hidden xs:inline">Cetak</span>
        </Button>
      </header>

      <div ref={scrollAreaRef} className="barcode-scroll-area flex-1 overflow-auto p-4 md:p-8 bg-slate-100/50 flex flex-col items-center">
        <div 
          ref={paperRef}
          className="barcode-paper-container bg-white shadow-xl p-[10mm] min-h-[297mm] w-fit origin-top transition-transform duration-300"
          style={{ transform: `scale(${scale})` }}
        >
          <div 
            className="barcode-grid"
            style={{ 
              display: 'grid', 
              gridTemplateColumns: `repeat(${config.columns}, ${config.width})`,
              gap: '4mm'
            }}
          >
            {products.map(p => (
              <BarcodeLabel key={p.id} product={p} storeName={storeName} config={config} barcodeType={barcodeType} />
            ))}
          </div>
        </div>
        
        {scale < 1 && (
          <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md text-white text-[10px] px-3 py-1 rounded-full font-bold uppercase tracking-widest print:hidden">
            Tampilan disesuaikan ({Math.round(scale * 100)}%)
          </div>
        )}
      </div>
    </div>
  );
}
