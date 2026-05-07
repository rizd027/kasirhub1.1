import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';

export const generateReceiptImage = async (elementId: string) => {
  const element = document.getElementById(elementId);
  if (!element) return;

  const canvas = await html2canvas(element, { useCORS: true });
  return canvas.toDataURL('image/png');
};

export const generateReceiptPDF = async (elementId: string) => {
  const element = document.getElementById(elementId);
  if (!element) throw new Error('Elemen nota tidak ditemukan');

  // Safety: Timeout after 8 seconds if html2canvas hangs
  const canvas = await Promise.race([
    html2canvas(element, { 
      useCORS: true, 
      scale: 2,
      logging: false,
      backgroundColor: '#ffffff'
    }),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Gagal memproses gambar nota (Timeout)')), 8000))
  ]);

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
  const fileReader = new FileReader();
  
  fileReader.onload = async () => {
    const base64Data = fileReader.result as string;

    if (Capacitor.isNativePlatform()) {
      try {
        console.log('Attempting native share...');
        // On Android, sharing a base64 as 'url' might fail if too large.
        // We try to share it as a file if possible, but since we don't have Filesystem plugin yet,
        // we'll try to share it as 'url' and hope it's small enough (thermal receipts usually are).
        await Share.share({
          title: 'Nota Transaksi',
          text: 'Nota Transaksi KasirHub',
          url: base64Data,
          dialogTitle: 'Bagikan/Cetak Nota',
        });
      } catch (err) {
        console.error('Capacitor Share failed:', err);
        alert('Gagal membuka menu bagi. Pastikan izin penyimpanan aktif.');
      }
    } else if (navigator.share) {
      // Standard Web Share
      const shareFile = new File([file], `${fileName}.pdf`, { type: 'application/pdf' });
      try {
        await navigator.share({
          files: [shareFile],
          title: 'Nota Transaksi',
          text: 'Nota Transaksi KasirHub',
        });
      } catch (err) {
        console.error('Web Share failed:', err);
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

  fileReader.readAsDataURL(file);
};

