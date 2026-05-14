

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

  const width = element.clientWidth;
  const height = element.clientHeight;

  let pdfWidth = 80;
  if (paperSize === '58mm') pdfWidth = 58;
  if (paperSize === '80mm') pdfWidth = 80;
  if (paperSize === '1/8 Folio') pdfWidth = 85;
  if (paperSize === '1/4 Folio') pdfWidth = 105;
  if (paperSize === 'A5') pdfWidth = 148;
  if (paperSize === '1/2 A5') pdfWidth = 165;
  if (paperSize === '1/2 Folio') pdfWidth = 215;
  if (paperSize === 'A4') pdfWidth = 210;

  const canvas = await Promise.race([
    html2canvas(element, { 
      useCORS: true, 
      allowTaint: true,
      scale: 3,
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

const downloadReceipt = (file: Blob, fileName: string) => {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileName}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
};
