

export const generateReceiptImage = async (elementId: string) => {
  const element = document.getElementById(elementId);
  if (!element) return;

  const html2canvas = (await import('html2canvas-pro')).default;
  const canvas = await html2canvas(element, { useCORS: true });
  return canvas.toDataURL('image/png');
};

export const generateReceiptPDF = async (elementId: string, paperSize: string = '80mm') => {
  const element = document.getElementById(elementId);
  if (!element) throw new Error('Elemen nota tidak ditemukan');

  const html2canvas = (await import('html2canvas-pro')).default;
  const { jsPDF } = await import('jspdf');

  // Get exact dimensions
  const width = element.clientWidth;
  const height = element.clientHeight;

  // Determine width based on Indonesian standards
  let pdfWidth = 80;
  if (paperSize === '58mm') pdfWidth = 58;        // Mini Thermal (UMKM/EDC)
  if (paperSize === '80mm') pdfWidth = 80;        // Standard Thermal (Ritel)
  if (paperSize === '1/8 Folio') pdfWidth = 85;   // Nota Mini / Olshop
  if (paperSize === '1/4 Folio') pdfWidth = 105;  // Nota Kecil / Bon Kontan
  if (paperSize === 'A5') pdfWidth = 148;         // Nota Sedang / Setengah HVS
  if (paperSize === '1/2 A5') pdfWidth = 165;     // Struk Sedang
  if (paperSize === '1/2 Folio') pdfWidth = 215;  // Nota Besar / Kontan Full
  if (paperSize === 'A4') pdfWidth = 210;         // Nota Besar / Invoice Full

  // Process canvas
  const canvas = await Promise.race([
    html2canvas(element, { 
      useCORS: true, 
      allowTaint: true,
      scale: 2,
      logging: false,
      backgroundColor: '#ffffff',
      width: width,
      height: height,
      windowWidth: document.documentElement.clientWidth,
      windowHeight: document.documentElement.clientHeight,
    }),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Gagal memproses gambar nota (Timeout)')), 10000))
  ]);

  const imgData = canvas.toDataURL('image/jpeg', 1.0);
  const pdfHeight = (height * pdfWidth) / width;

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [pdfWidth, pdfHeight]
  });
  
  pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
  return pdf.output('blob');
};

export const shareReceipt = async (file: Blob, fileName: string) => {
  if (typeof navigator !== 'undefined' && navigator.share) {
    // Standard Web Share
    const shareFile = new File([file], `${fileName}.pdf`, { type: 'application/pdf' });
    try {
      await navigator.share({
        files: [shareFile],
        title: 'Nota Transaksi',
        text: 'Nota Transaksi KasirHub',
      });
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Web Share failed:', err);
        // Fallback to download if share fails for reasons other than user cancel
        downloadReceipt(file, fileName);
      }
    }
  } else {
    downloadReceipt(file, fileName);
  }
};

export const printReceipt = (file: Blob) => {
  const url = URL.createObjectURL(file);
  const iframe = document.createElement('iframe');
  
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.src = url;
  
  document.body.appendChild(iframe);
  
  iframe.onload = () => {
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      
      setTimeout(() => {
        document.body.removeChild(iframe);
        URL.revokeObjectURL(url);
      }, 3000);
    }, 500);
  };
};

export const printReceiptHTML = (elementId: string, paperSize: string = '80mm') => {
  const element = document.getElementById(elementId);
  if (!element) {
    window.print();
    return;
  }

  // Determine width
  let printWidth = '80mm';
  if (paperSize === '58mm') printWidth = '58mm';
  if (paperSize === '80mm') printWidth = '80mm';
  if (paperSize === '1/8 Folio') printWidth = '85mm';
  if (paperSize === '1/4 Folio') printWidth = '105mm';
  if (paperSize === 'A5') printWidth = '148mm';
  if (paperSize === '1/2 A5') printWidth = '165mm';
  if (paperSize === '1/2 Folio') printWidth = '215mm';
  if (paperSize === 'A4') printWidth = '210mm';

  // Create iframe
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document || iframe.contentDocument;
  if (!doc) {
    window.print();
    return;
  }

  // Write content
  doc.open();
  doc.write('<html><head><title>Cetak Nota</title>');
  
  // Copy stylesheets
  const stylesheets = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'));
  stylesheets.forEach(sheet => {
    doc.write(sheet.outerHTML);
  });

  // Inject custom print styles for the iframe
  doc.write(`
    <style>
      @media print {
        @page {
          margin: 0;
          size: auto;
        }
        body {
          margin: 0;
          padding: 0;
          background: white;
        }
        /* Safeguard: Ensure the receipt root and body elements are visible */
        body > * {
          display: block !important;
        }
      }
      #${elementId} {
        display: block !important;
        width: ${printWidth} !important;
        max-width: ${printWidth} !important;
        margin: 0 auto !important;
        box-shadow: none !important;
        border: none !important;
        padding: 4mm !important;
      }
      .no-print {
        display: none !important;
      }
    </style>
  `);
  doc.write('</head><body>');
  doc.write(element.outerHTML);
  doc.write('</body></html>');
  doc.close();

  // Print
  iframe.onload = () => {
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.error('Print iframe failed, falling back to window.print', err);
        window.print();
      }
      setTimeout(() => {
        if (iframe.parentNode) {
          document.body.removeChild(iframe);
        }
      }, 1000);
    }, 300);
  };
};

const downloadReceipt = (file: Blob, fileName: string) => {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileName}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
};
