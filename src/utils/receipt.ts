import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';

export const generateReceiptImage = async (elementId: string) => {
  const element = document.getElementById(elementId);
  if (!element) return;

  const canvas = await html2canvas(element, { useCORS: true });
  return canvas.toDataURL('image/png');
};

export const generateReceiptPDF = async (elementId: string) => {
  const element = document.getElementById(elementId);
  if (!element) return;

  const canvas = await html2canvas(element, { useCORS: true });
  const imgData = canvas.toDataURL('image/png');
  
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [58, 100] // Thermal printer size
  });
  
  const imgProps = pdf.getImageProperties(imgData);
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
  
  pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
  return pdf.output('blob');
};

export const shareReceipt = async (file: Blob, fileName: string) => {
  if (navigator.share) {
    const shareFile = new File([file], `${fileName}.pdf`, { type: 'application/pdf' });
    try {
      await navigator.share({
        files: [shareFile],
        title: 'Nota Transaksi',
        text: 'Terima kasih telah berbelanja di KasirHub!',
      });
    } catch (err) {
      console.error('Share failed:', err);
    }
  } else {
    // Fallback: download
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName}.pdf`;
    a.click();
  }
};
