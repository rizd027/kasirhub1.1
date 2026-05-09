'use client';

import { useEffect, useRef, useState } from 'react';
import { db, LocalProduct } from '@/db/dexie';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import JsBarcode from 'jsbarcode';
import { SettingsLayout } from '@/features/settings/SettingsLayout';

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
    case 'EAN13': return digits.padStart(13, '0').slice(-13);
    case 'EAN8': return digits.padStart(8, '0').slice(-8);
    case 'UPC': return digits.padStart(12, '0').slice(-12);
    case 'ITF14': return digits.padStart(14, '0').slice(-14);
    default: return sku;
  }
}

function BarcodeLabel({ product, storeName, config, barcodeType }: { 
  product: LocalProduct; 
  storeName: string; 
  config: typeof LABEL_CONFIGS['33x15'];
  barcodeType: string;
}) {
  const [imgSrc, setImgSrc] = useState<string>('');
  const [isNormalized, setIsNormalized] = useState(false);
  const [isFallback, setIsFallback] = useState(false);

  useEffect(() => {
    if (product.sku) {
      const canvas = document.createElement('canvas');
      const tryRender = (data: string, format: string) => {
        try {
          JsBarcode(canvas, data, {
            format: format,
            width: config.width === '33mm' ? 1.5 : 2,
            height: config.barcodeHeight,
            displayValue: false,
            margin: 0,
            background: 'white',
          });
          setImgSrc(canvas.toDataURL('image/png'));
          return true;
        } catch (e) { return false; }
      };

      setIsNormalized(false);
      setIsFallback(false);

      if (tryRender(product.sku, barcodeType)) return;
      const normalizedData = normalizeSkuForFormat(product.sku, barcodeType);
      if (normalizedData !== product.sku && tryRender(normalizedData, barcodeType)) {
        setIsNormalized(true);
        return;
      }
      if (tryRender(product.sku, 'CODE128')) setIsFallback(true);
    }
  }, [product.sku, barcodeType, config]);

  const toCurrency = (v: number) => `Rp ${v.toLocaleString('id-ID')}`;

  return (
    <div
      className="barcode-label border border-black/10 rounded flex flex-col items-center bg-white shadow-sm overflow-hidden"
      style={{ width: config.width, height: config.height, pageBreakInside: 'avoid', breakInside: 'avoid', padding: '1mm' }}
    >
      <div className="w-full text-center pb-0.5 mb-0.5">
        <p style={{ fontSize: `calc(${config.fontSize} - 2px)` }} className="font-black uppercase tracking-tighter text-gray-800 truncate px-0.5">
          {storeName || 'KASIRHUB'}
        </p>
      </div>
      <p style={{ fontSize: config.fontSize }} className="font-bold text-center leading-none text-gray-900 truncate w-full px-0.5 mb-0.5">
        {product.name}
      </p>
      <div className="flex-1 w-full flex items-center justify-center py-0.5 overflow-hidden relative">
        {imgSrc && (
          <img 
            src={imgSrc} 
            className="barcode-image max-w-full" 
            style={{ height: `${config.barcodeHeight}px`, width: 'auto' }}
            alt="barcode" 
          />
        )}
      </div>
      <div className="w-full flex justify-between items-end px-0.5 mt-0.5 pt-0.5">
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

export default function BarcodePage() {
  const [products, setProducts] = useState<LocalProduct[]>([]);
  const [storeName, setStoreName] = useState('');
  const [labelSize, setLabelSize] = useState<LabelSizeKey>('33x25');
  const [barcodeType, setBarcodeType] = useState('CODE128');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const p = await db.products.filter(item => !item.deleted_at).toArray();
      setProducts(p);
      setLoading(false);

      const saved = localStorage.getItem('toko_info');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.nama) setStoreName(parsed.nama);
        } catch (e) { }
      }
    };
    fetchData();
  }, []);

  const config = LABEL_CONFIGS[labelSize];
  const printFrameRef = useRef<HTMLIFrameElement>(null);

  const handlePrint = () => {
    const printContent = document.querySelector('.print-only-content');
    if (!printContent || !printFrameRef.current) return;

    const iframe = printFrameRef.current;
    const iframeDoc = iframe.contentWindow?.document;
    if (!iframeDoc) return;

    const html = `
      <html>
        <head>
          <title>Cetak Barcode - KasirHub</title>
          <style>
            @page { size: auto; margin: 0; }
            body { 
              margin: 0; 
              padding: 0; 
              background: white; 
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .barcode-grid { 
              display: grid; 
              grid-template-columns: repeat(auto-fill, ${config.width});
              gap: 1mm; 
              padding: 5mm;
              justify-content: start;
              background: white;
            }
            .barcode-label { 
              display: flex;
              flex-direction: column;
              align-items: center;
              border: 1px solid rgba(0,0,0,0.1);
              border-radius: 6px;
              background: white;
              width: ${config.width};
              height: ${config.height};
              padding: 1mm;
              box-sizing: border-box;
              page-break-inside: avoid;
              break-inside: avoid;
              overflow: hidden;
              box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
            }
            .barcode-image {
              display: block;
              height: ${config.barcodeHeight}px;
              width: auto;
              margin: 0 auto;
            }
            
            /* Tailwind Replication */
            .w-full { width: 100%; }
            .flex { display: flex; }
            .flex-col { flex-direction: column; }
            .items-center { align-items: center; }
            .items-end { align-items: flex-end; }
            .justify-center { justify-content: center; }
            .justify-between { justify-content: space-between; }
            .flex-1 { flex: 1 1 0%; }
            .text-center { text-align: center; }
            .truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .uppercase { text-transform: uppercase; }
            .font-black { font-weight: 900; }
            .font-bold { font-weight: 700; }
            .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
            .leading-none { line-height: 1; }
            .tracking-tighter { letter-spacing: -0.05em; }
            .relative { position: relative; }
            
            /* Borders & Colors */
            .border-b { border-bottom-width: 1px; border-bottom-style: solid; }
            .border-t { border-top-width: 1px; border-top-style: solid; }
            .border-dashed { border-style: dashed; }
            .border-black\\/10 { border-color: rgba(0,0,0,0.1); }
            .text-gray-800 { color: #1f2937; }
            .text-gray-900 { color: #111827; }
            .text-gray-500 { color: #6b7280; }
            .text-muted-foreground { color: #64748b; }
            .bg-white { background-color: #ffffff; }
            
            /* Spacing */
            .pb-0\\.5 { padding-bottom: 0.125rem; }
            .pt-0\\.5 { padding-top: 0.125rem; }
            .py-0\\.5 { padding-top: 0.125rem; padding-bottom: 0.125rem; }
            .px-0\\.5 { padding-left: 0.125rem; padding-right: 0.125rem; }
            .mb-0\\.5 { margin-bottom: 0.125rem; }
            .mt-0\\.5 { margin-top: 0.125rem; }
            
            /* Custom Label Sizes */
            .barcode-label p { margin: 0; }
          </style>
        </head>
        <body>
          <div class="barcode-grid">
            ${printContent.innerHTML}
          </div>
          <script>
            window.onload = () => {
              const imgs = document.getElementsByTagName('img');
              const promises = Array.from(imgs).map(img => {
                if (img.complete) return Promise.resolve();
                return new Promise(resolve => { img.onload = resolve; img.onerror = resolve; });
              });
              Promise.all(promises).then(() => {
                setTimeout(() => {
                  window.print();
                }, 500);
              });
            };
          </script>
        </body>
      </html>
    `;

    iframeDoc.open();
    iframeDoc.write(html);
    iframeDoc.close();
  };

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const updateInitialScale = () => {
      if (scrollAreaRef.current && paperRef.current) {
        const containerWidth = scrollAreaRef.current.clientWidth - 48;
        const paperWidth = paperRef.current.offsetWidth;
        if (containerWidth < paperWidth) {
          setScale(containerWidth / paperWidth);
        } else {
          setScale(1);
        }
      }
    };
    updateInitialScale();
    window.addEventListener('resize', updateInitialScale);
    return () => window.removeEventListener('resize', updateInitialScale);
  }, [labelSize, loading]);

  if (loading) return null;

  return (
    <SettingsLayout
      title="Cetak Barcode"
      rightAction={
        <div className="flex items-center gap-2 md:gap-4">
          <div className="hidden md:flex items-center gap-4">
            <Select value={labelSize} onValueChange={(v) => setLabelSize(v as LabelSizeKey)}>
              <SelectTrigger className="w-[140px] h-9 text-xs bg-white rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(LABEL_CONFIGS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={barcodeType} onValueChange={(v) => v && setBarcodeType(v)}>
              <SelectTrigger className="w-[120px] h-9 text-xs bg-white rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CODE128">Code 128</SelectItem>
                <SelectItem value="EAN13">EAN-13</SelectItem>
                <SelectItem value="EAN8">EAN-8</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handlePrint} className="h-9 px-4 md:px-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg flex items-center gap-2">
            <Printer className="size-4" /> <span className="font-bold text-xs">CETAK</span>
          </Button>
        </div>
      }
    >
      {/* Hidden iframe for robust printing */}
      <iframe
        ref={printFrameRef}
        style={{ position: 'absolute', width: 0, height: 0, border: 'none', visibility: 'hidden' }}
        title="Print Barcode"
      />

      <div ref={scrollAreaRef} className="barcode-scroll-area flex-1 overflow-auto p-4 md:p-8 pb-24 md:pb-8 bg-slate-50 flex flex-col items-center min-h-[calc(100vh-100px)]">
        <div 
          ref={paperRef} 
          className="print-only-content barcode-grid origin-top transition-transform duration-300 w-full" 
          style={{ 
            display: 'grid', 
            gridTemplateColumns: `repeat(auto-fill, minmax(${config.width}, 1fr))`, 
            gridAutoColumns: config.width,
            gap: '4mm',
            justifyContent: 'start',
            transform: `scale(${scale})` 
          }}
        >
          <style dangerouslySetInnerHTML={{ __html: `
            @media (max-width: 640px) {
              .barcode-grid {
                grid-template-columns: repeat(3, 1fr) !important;
                gap: 2mm !important;
              }
            }
          `}} />
          {products.map(p => (
            <BarcodeLabel key={p.id} product={p} storeName={storeName} config={config} barcodeType={barcodeType} />
          ))}
        </div>
      </div>

      {/* Mobile Bottom Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 p-3 z-50 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
        <div className="flex gap-2">
          <div className="flex-1">
            <Select value={labelSize} onValueChange={(v) => setLabelSize(v as LabelSizeKey)}>
              <SelectTrigger className="w-full h-10 text-xs bg-slate-50 border-none rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(LABEL_CONFIGS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <Select value={barcodeType} onValueChange={(v) => v && setBarcodeType(v)}>
              <SelectTrigger className="w-full h-10 text-xs bg-slate-50 border-none rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CODE128">Code 128</SelectItem>
                <SelectItem value="EAN13">EAN-13</SelectItem>
                <SelectItem value="EAN8">EAN-8</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </SettingsLayout>
  );
}
