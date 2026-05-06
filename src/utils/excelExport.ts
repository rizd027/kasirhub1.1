import ExcelJS from 'exceljs';

export const exportToExcel = async (data: any[], fileName: string) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Laporan');

  // Define columns
  worksheet.columns = [
    { header: 'Tanggal', key: 'date', width: 20 },
    { header: 'Omzet', key: 'omzet', width: 15 },
    { header: 'Laba', key: 'laba', width: 15 },
  ];

  // Add rows
  data.forEach(item => {
    worksheet.addRow({
      date: item.name, // Placeholder for actual date
      omzet: item.omzet,
      laba: item.laba
    });
  });

  // Style header
  worksheet.getRow(1).font = { bold: true };

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  
  // Download file
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${fileName}.xlsx`;
  anchor.click();
  window.URL.revokeObjectURL(url);
};

export const exportTransactionsToExcel = async (transactions: any[], fileName: string) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Riwayat Transaksi');

  worksheet.columns = [
    { header: 'Tanggal', key: 'date', width: 20 },
    { header: 'No. Transaksi', key: 'id', width: 25 },
    { header: 'Pelanggan', key: 'customer', width: 20 },
    { header: 'Metode', key: 'method', width: 10 },
    { header: 'Total', key: 'total', width: 15 },
    { header: 'Status', key: 'status', width: 15 },
    { header: 'Item', key: 'items', width: 50 },
  ];

  transactions.forEach(tx => {
    const itemsStr = tx.items.map((i: any) => `${i.quantity}x ${i.name}`).join(', ');
    worksheet.addRow({
      date: new Date(tx.created_at).toLocaleString('id-ID'),
      id: tx.id,
      customer: tx.customer_name || '-',
      method: tx.payment_method === 'cash' ? 'Tunai' : 'Tempo',
      total: tx.total_amount,
      status: tx.synced ? 'Tersinkron' : 'Offline',
      items: itemsStr
    });
  });

  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' }
  };

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${fileName}.xlsx`;
  anchor.click();
  window.URL.revokeObjectURL(url);
};
