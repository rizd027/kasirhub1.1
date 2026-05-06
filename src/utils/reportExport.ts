import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType, HeadingLevel, ImageRun } from 'docx';
import { db } from '@/lib/dexie';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

// No need for prototype extension if using autoTable(doc, ...)

const getBase64ImageFromURL = (url: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.setAttribute('crossOrigin', 'anonymous');
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0);
      const dataURL = canvas.toDataURL('image/png');
      resolve(dataURL);
    };
    img.onerror = error => reject(error);
    img.src = url;
  });
};

export const fetchAllReportData = async () => {
  const transactions = await db.transactions.toArray();
  const products = await db.products.toArray();
  const categories = await db.categories.toArray();
  const tokoInfo = JSON.parse(localStorage.getItem('toko_info') || '{}');

  // Arus Kas & Laba Rugi data
  const totalRevenue = transactions.reduce((acc, tx) => acc + tx.total_amount, 0);
  const totalCOGS = transactions.reduce((acc, tx) => {
    return acc + tx.items.reduce((sum, item) => sum + ((item.price_cost || 0) * item.quantity), 0);
  }, 0);
  const totalDiscount = transactions.reduce((acc, tx) => acc + tx.discount_total, 0);
  const netProfit = totalRevenue - totalCOGS - totalDiscount;

  // Rekap Penjualan (Daily)
  const dailyRecapMap: Record<string, { count: number; total: number }> = {};
  transactions.forEach(tx => {
    const date = format(new Date(tx.created_at), 'yyyy-MM-dd');
    if (!dailyRecapMap[date]) dailyRecapMap[date] = { count: 0, total: 0 };
    dailyRecapMap[date].count += 1;
    dailyRecapMap[date].total += tx.total_amount;
  });
  const dailyRecap = Object.entries(dailyRecapMap).map(([date, stats]) => ({ date, ...stats }));

  // Analisis Terlaris
  const productSales: Record<string, { count: number; revenue: number }> = {};
  transactions.forEach(tx => {
    tx.items.forEach(item => {
      if (!productSales[item.name]) productSales[item.name] = { count: 0, revenue: 0 };
      productSales[item.name].count += item.quantity;
      productSales[item.name].revenue += item.price * item.quantity;
    });
  });
  const bestSellers = Object.entries(productSales)
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Stok Kritis
  const threshold = parseInt(localStorage.getItem('stockThreshold') || '10', 10);
  const criticalStock = products.filter(p => !p.deleted_at && ((p.stock_store || 0) + (p.stock_warehouse || 0)) <= threshold);

  // Nilai Stok
  const stockValue = products
    .filter(p => !p.deleted_at)
    .map(p => ({
      name: p.name,
      sku: p.sku,
      stock: ((p.stock_store || 0) + (p.stock_warehouse || 0)),
      cost: p.price_cost || 0,
      value: ((p.stock_store || 0) + (p.stock_warehouse || 0)) * (p.price_cost || 0)
    }));
  const totalStockValue = stockValue.reduce((acc, item) => acc + item.value, 0);

  // Performa Kategori
  const categoryStats: Record<string, number> = {};
  transactions.forEach(tx => {
    tx.items.forEach(item => {
      const catId = item.category_id || 'uncategorized';
      categoryStats[catId] = (categoryStats[catId] || 0) + (item.price * item.quantity);
    });
  });
  const categoryPerformance = categories.map(c => ({
    name: c.name,
    revenue: categoryStats[c.id] || 0
  })).sort((a, b) => b.revenue - a.revenue);

  return {
    tokoInfo,
    summary: { totalRevenue, totalCOGS, totalDiscount, netProfit, totalStockValue },
    dailyRecap,
    bestSellers,
    criticalStock,
    stockValue,
    categoryPerformance,
    exportDate: format(new Date(), 'EEEE, d MMMM yyyy HH:mm:ss', { locale: id })
  };
};

export const exportReportPDF = async () => {
  const data = await fetchAllReportData();
  const doc = new jsPDF();
  const { tokoInfo, summary, dailyRecap, bestSellers, criticalStock, categoryPerformance, exportDate } = data;

  // Header with Logo
  let currentY = 15;
  if (tokoInfo.logo_url) {
    try {
      const base64 = await getBase64ImageFromURL(tokoInfo.logo_url);
      doc.addImage(base64, 'PNG', 10, 10, 20, 20);
    } catch (e) { console.error('Logo error', e); }
  }

  doc.setFontSize(18);
  doc.text(tokoInfo.nama || 'KasirHub Report', 105, currentY, { align: 'center' });
  doc.setFontSize(10);
  doc.text(tokoInfo.alamat || '', 105, currentY + 7, { align: 'center' });
  doc.text(tokoInfo.telepon || '', 105, currentY + 12, { align: 'center' });
  doc.line(10, 35, 200, 35);

  doc.setFontSize(12);
  doc.text('LAPORAN BISNIS KESELURUHAN', 105, 45, { align: 'center' });
  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text(`Dicetak pada: ${exportDate}`, 10, 52);
  doc.text(`Pengembang: rizddf`, 200, 52, { align: 'right' });
  doc.setTextColor(0);

  // 1. Ringkasan Keuangan
  doc.setFontSize(11);
  doc.text('1. RINGKASAN KEUANGAN', 10, 62);
  autoTable(doc, {
    startY: 65,
    head: [['Kategori Laporan', 'Nilai Nominal']],
    body: [
      ['Total Pendapatan Kotor (Omzet)', `Rp ${summary.totalRevenue.toLocaleString('id-ID')}`],
      ['Total Modal (HPP)', `Rp ${summary.totalCOGS.toLocaleString('id-ID')}`],
      ['Total Diskon Diberikan', `Rp ${summary.totalDiscount.toLocaleString('id-ID')}`],
      ['Estimasi Laba Bersih', `Rp ${summary.netProfit.toLocaleString('id-ID')}`],
      ['Total Nilai Aset Stok', `Rp ${summary.totalStockValue.toLocaleString('id-ID')}`],
    ],
    theme: 'striped',
    headStyles: { fillColor: [63, 63, 70] }
  });

  // 2. Rekap Penjualan
  doc.text('2. REKAP PENJUALAN HARIAN', 10, (doc as any).lastAutoTable.finalY + 15);
  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 20,
    head: [['Tanggal', 'Jumlah Transaksi', 'Total Omzet']],
    body: dailyRecap.map(r => [r.date, `${r.count} Transaksi`, `Rp ${r.total.toLocaleString('id-ID')}`]),
    headStyles: { fillColor: [79, 70, 229] }
  });

  // 3. Analisis Produk Terlaris
  doc.addPage();
  doc.text('3. ANALISIS PRODUK TERLARIS (TOP 10)', 10, 20);
  autoTable(doc, {
    startY: 25,
    head: [['Peringkat', 'Nama Produk', 'Unit Terjual', 'Total Omzet']],
    body: bestSellers.map((b, i) => [i + 1, b.name, `${b.count} Unit`, `Rp ${b.revenue.toLocaleString('id-ID')}`]),
    headStyles: { fillColor: [245, 158, 11] }
  });

  // 4. Stok Kritis
  doc.text('4. DAFTAR STOK KRITIS (PERLU RE-STOK)', 10, (doc as any).lastAutoTable.finalY + 15);
  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 20,
    head: [['SKU', 'Nama Produk', 'Sisa Stok Unit']],
    body: criticalStock.map(p => [p.sku, p.name, `${(p.stock_store || 0) + (p.stock_warehouse || 0)} Unit`]),
    headStyles: { fillColor: [239, 68, 68] }
  });

  // 5. Performa Kategori
  doc.text('5. PERFORMA KONTRIBUSI KATEGORI', 10, (doc as any).lastAutoTable.finalY + 15);
  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 20,
    head: [['Nama Kategori', 'Total Kontribusi Omzet']],
    body: categoryPerformance.map(c => [c.name, `Rp ${c.revenue.toLocaleString('id-ID')}`]),
    headStyles: { fillColor: [16, 185, 129] }
  });

  doc.save(`Laporan_Lengkap_${tokoInfo.nama || 'KasirHub'}_${format(new Date(), 'yyyyMMdd')}.pdf`);
};

export const exportReportExcel = async () => {
  const data = await fetchAllReportData();
  const workbook = new ExcelJS.Workbook();
  const { summary, dailyRecap, bestSellers, criticalStock, stockValue, categoryPerformance } = data;

  // Summary Sheet
  const sSheet = workbook.addWorksheet('Ringkasan');
  sSheet.columns = [{ header: 'Parameter', key: 'p', width: 30 }, { header: 'Nilai', key: 'v', width: 20 }];
  sSheet.addRows([
    { p: 'Total Pendapatan', v: summary.totalRevenue },
    { p: 'Total HPP', v: summary.totalCOGS },
    { p: 'Total Diskon', v: summary.totalDiscount },
    { p: 'Laba Bersih', v: summary.netProfit },
    { p: 'Total Aset Stok', v: summary.totalStockValue },
  ]);

  // Sales Recap
  const rSheet = workbook.addWorksheet('Rekap Penjualan');
  rSheet.columns = [
    { header: 'Tanggal', key: 'date', width: 20 },
    { header: 'Transaksi', key: 'count', width: 15 },
    { header: 'Omzet', key: 'total', width: 20 }
  ];
  rSheet.addRows(dailyRecap);

  // Best Sellers
  const bSheet = workbook.addWorksheet('Produk Terlaris');
  bSheet.columns = [
    { header: 'Produk', key: 'name', width: 30 },
    { header: 'Terjual', key: 'count', width: 15 },
    { header: 'Omzet', key: 'revenue', width: 20 }
  ];
  bSheet.addRows(bestSellers);

  // Stock
  const stSheet = workbook.addWorksheet('Nilai Stok');
  stSheet.columns = [
    { header: 'SKU', key: 'sku', width: 15 },
    { header: 'Nama', key: 'name', width: 30 },
    { header: 'Stok', key: 'stock', width: 10 },
    { header: 'Modal', key: 'cost', width: 15 },
    { header: 'Total Nilai', key: 'value', width: 20 }
  ];
  stSheet.addRows(stockValue);

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Laporan_Bisnis_${format(new Date(), 'yyyyMMdd')}.xlsx`;
  a.click();
};

export const exportReportWord = async () => {
  const data = await fetchAllReportData();
  const { tokoInfo, summary, dailyRecap, bestSellers, criticalStock, categoryPerformance, exportDate } = data;

  let logoImage;
  if (tokoInfo.logo_url) {
    try {
      const resp = await fetch(tokoInfo.logo_url);
      const buffer = await resp.arrayBuffer();
      logoImage = new ImageRun({
        data: buffer,
        transformation: { width: 80, height: 80 },
        type: "png",
      });
    } catch (e) { console.error('Word logo error', e); }
  }

  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        ...(logoImage ? [new Paragraph({ children: [logoImage], alignment: AlignmentType.CENTER })] : []),
        new Paragraph({
          text: tokoInfo.nama || 'LAPORAN BISNIS KASIRHUB',
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({
          text: `${tokoInfo.alamat || ''} | ${tokoInfo.telepon || ''}`,
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({ text: "" }),
        new Paragraph({
          children: [
            new TextRun({ text: `Dicetak: ${exportDate}`, size: 18, color: "666666" }),
            new TextRun({ text: ` | Pengembang: rizddf`, size: 18, color: "666666" }),
          ],
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({ text: "" }),
        new Paragraph({ text: "1. RINGKASAN KEUANGAN", heading: HeadingLevel.HEADING_2 }),
        new Table({
          width: { size: 100, type: 'pct' },
          rows: [
            new TableRow({ children: [new TableCell({ children: [new Paragraph("Keterangan")] }), new TableCell({ children: [new Paragraph("Nilai Nominal")] })] }),
            new TableRow({ children: [new TableCell({ children: [new Paragraph("Total Pendapatan (Omzet)")] }), new TableCell({ children: [new Paragraph(`Rp ${summary.totalRevenue.toLocaleString('id-ID')}`)] })] }),
            new TableRow({ children: [new TableCell({ children: [new Paragraph("Total Modal (HPP)")] }), new TableCell({ children: [new Paragraph(`Rp ${summary.totalCOGS.toLocaleString('id-ID')}`)] })] }),
            new TableRow({ children: [new TableCell({ children: [new Paragraph("Estimasi Laba Bersih")] }), new TableCell({ children: [new Paragraph(`Rp ${summary.netProfit.toLocaleString('id-ID')}`)] })] }),
            new TableRow({ children: [new TableCell({ children: [new Paragraph("Total Nilai Aset Stok")] }), new TableCell({ children: [new Paragraph(`Rp ${summary.totalStockValue.toLocaleString('id-ID')}`)] })] }),
          ],
        }),
        new Paragraph({ text: "" }),
        new Paragraph({ text: "2. REKAP PENJUALAN HARIAN", heading: HeadingLevel.HEADING_2 }),
        new Table({
          width: { size: 100, type: 'pct' },
          rows: [
            new TableRow({ children: [new TableCell({ children: [new Paragraph("Tanggal")] }), new TableCell({ children: [new Paragraph("Transaksi")] }), new TableCell({ children: [new Paragraph("Omzet")] })] }),
            ...dailyRecap.map(r => new TableRow({
              children: [
                new TableCell({ children: [new Paragraph(r.date)] }),
                new TableCell({ children: [new Paragraph(r.count.toString())] }),
                new TableCell({ children: [new Paragraph(`Rp ${r.total.toLocaleString('id-ID')}`)] })
              ]
            }))
          ]
        }),
        new Paragraph({ text: "" }),
        new Paragraph({ text: "3. PRODUK TERLARIS (TOP 10)", heading: HeadingLevel.HEADING_2 }),
        new Table({
          width: { size: 100, type: 'pct' },
          rows: [
            new TableRow({ children: [new TableCell({ children: [new Paragraph("Nama Produk")] }), new TableCell({ children: [new Paragraph("Terjual")] }), new TableCell({ children: [new Paragraph("Omzet")] })] }),
            ...bestSellers.map(b => new TableRow({
              children: [
                new TableCell({ children: [new Paragraph(b.name)] }),
                new TableCell({ children: [new Paragraph(`${b.count} Unit`)] }),
                new TableCell({ children: [new Paragraph(`Rp ${b.revenue.toLocaleString('id-ID')}`)] })
              ]
            }))
          ]
        }),
        new Paragraph({ text: "" }),
        new Paragraph({ text: "4. STOK KRITIS", heading: HeadingLevel.HEADING_2 }),
        new Table({
          width: { size: 100, type: 'pct' },
          rows: [
            new TableRow({ children: [new TableCell({ children: [new Paragraph("SKU")] }), new TableCell({ children: [new Paragraph("Nama Produk")] }), new TableCell({ children: [new Paragraph("Sisa Stok")] })] }),
            ...criticalStock.map(p => new TableRow({
              children: [
                new TableCell({ children: [new Paragraph(p.sku)] }),
                new TableCell({ children: [new Paragraph(p.name)] }),
                new TableCell({ children: [new Paragraph(`${(p.stock_store || 0) + (p.stock_warehouse || 0)} Unit`)] })
              ]
            }))
          ]
        }),
        new Paragraph({ text: "" }),
        new Paragraph({ text: "5. PERFORMA KATEGORI", heading: HeadingLevel.HEADING_2 }),
        new Table({
          width: { size: 100, type: 'pct' },
          rows: [
            new TableRow({ children: [new TableCell({ children: [new Paragraph("Kategori")] }), new TableCell({ children: [new Paragraph("Omzet")] })] }),
            ...categoryPerformance.map(c => new TableRow({
              children: [
                new TableCell({ children: [new Paragraph(c.name)] }),
                new TableCell({ children: [new Paragraph(`Rp ${c.revenue.toLocaleString('id-ID')}`)] })
              ]
            }))
          ]
        }),
      ],
    }],
  });

  const buffer = await Packer.toBlob(doc);
  const url = window.URL.createObjectURL(buffer);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Laporan_Lengkap_${tokoInfo.nama || 'KasirHub'}_${format(new Date(), 'yyyyMMdd')}.docx`;
  a.click();
};
