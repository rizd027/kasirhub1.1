/**
 * KasirHub Printer Service
 * Handles ESC/POS command generation and device connectivity (Web Bluetooth/USB)
 */

import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { LocalTransaction } from '@/db/dexie';

export const PRINTER_COMMANDS = {
  ESC: '\u001b',
  GS: '\u001d',
  INIT: '\u001b@',
  LF: '\u000a',
  ALIGN_LEFT: '\u001ba0',
  ALIGN_CENTER: '\u001ba1',
  ALIGN_RIGHT: '\u001ba2',
  BOLD_ON: '\u001bE1',
  BOLD_OFF: '\u001bE0',
  DOUBLE_HEIGHT: '\u001b! \u0010',
  NORMAL_SIZE: '\u001b!\u0000',
  CUT: '\u001dV\u0042\u0000', // Partial cut
};

export async function generateTestReceipt(paperSize: string = '58mm') {
  const encoder = new TextEncoder();
  let commands = '';

  commands += PRINTER_COMMANDS.INIT;
  commands += PRINTER_COMMANDS.ALIGN_CENTER;
  commands += PRINTER_COMMANDS.BOLD_ON;
  commands += "KASIRHUB TEST PRINT\n";
  commands += PRINTER_COMMANDS.BOLD_OFF;
  commands += "--------------------------------\n";
  commands += PRINTER_COMMANDS.ALIGN_LEFT;
  commands += `Waktu: ${new Date().toLocaleString()}\n`;
  commands += `Kertas: ${paperSize}\n`;
  commands += "Status: BERHASIL TERHUBUNG\n";
  commands += "--------------------------------\n";
  commands += PRINTER_COMMANDS.LF;
  commands += PRINTER_COMMANDS.ALIGN_CENTER;
  commands += "Terima kasih sudah mencoba!\n";
  commands += "www.kasirhub.id\n";
  commands += PRINTER_COMMANDS.LF;
  commands += PRINTER_COMMANDS.LF;
  commands += PRINTER_COMMANDS.LF;
  commands += PRINTER_COMMANDS.CUT;

  return encoder.encode(commands);
}

export async function testPrintBluetooth() {
  const nav = navigator as any;
  if (!nav.bluetooth) {
    throw new Error("Browser Anda tidak mendukung Web Bluetooth.");
  }

  try {
    const device = await nav.bluetooth.requestDevice({
      filters: [{ services: ['000018f0-0000-1000-8000-00805f9b34fb'] }], // Standard POS service
      optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb']
    });

    const server = await device.gatt?.connect();
    const service = await server?.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
    const characteristic = await service?.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');

    const data = await generateTestReceipt();
    
    // Split into 20-byte chunks for BLE transmission compatibility
    const chunkSize = 20;
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      await characteristic?.writeValue(chunk);
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    return true;
  } catch (error: any) {
    console.error("Bluetooth Print Error:", error);
    throw error;
  }
}

export async function testPrintUSB() {
  const nav = navigator as any;
  if (!nav.usb) {
    throw new Error("Browser Anda tidak mendukung WebUSB.");
  }

  try {
    const device = await nav.usb.requestDevice({ filters: [] });
    await device.open();
    await device.selectConfiguration(1);
    await device.claimInterface(0);
    
    const data = await generateTestReceipt();
    
    const chunkSize = 64;
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      await device.transferOut(1, chunk);
    }
    
    return true;
  } catch (error: any) {
    console.error("USB Print Error:", error);
    throw error;
  }
}

/**
 * Formats a transaction into raw ESC/POS commands
 */
export function generateReceiptESC_POS(transaction: LocalTransaction, paperSize: string = '58mm'): Uint8Array {
  const encoder = new TextEncoder();
  let commands = '';

  // Load preferences and config
  let tokoInfo = {
    nama: 'KasirHub POS',
    alamat: 'Jl. Raya Digital No. 123',
    telepon: '08123456789',
    pesan_nota: 'Terima kasih sudah berbelanja!',
    kebijakan_pengembalian: '',
    instagram: '',
    tiktok: '',
    email_bisnis: '',
    google_maps_link: '',
  };

  let prefs = {
    currency: 'IDR',
    dateFormat: 'dd/MM/yyyy',
    showCashierName: true,
  };

  let cashierName = 'Administrator';

  if (typeof window !== 'undefined') {
    const savedToko = localStorage.getItem('toko_info');
    if (savedToko) {
      try { tokoInfo = { ...tokoInfo, ...JSON.parse(savedToko) }; } catch (e) {}
    }
    const savedProfile = localStorage.getItem('kasirhub_user_profile');
    if (savedProfile) {
      try {
        const p = JSON.parse(savedProfile);
        if (p.full_name) cashierName = p.full_name;
      } catch (e) {}
    }
    const savedPrefs = localStorage.getItem('kasirhub_prefs');
    if (savedPrefs) {
      try {
        const p = JSON.parse(savedPrefs);
        prefs = { ...prefs, ...p };
        tokoInfo.pesan_nota = p.pesanNota || tokoInfo.pesan_nota;
        tokoInfo.kebijakan_pengembalian = p.kebijakanPengembalian || tokoInfo.kebijakan_pengembalian;
      } catch (e) {}
    }
  }

  // Set line width (32 chars for 58mm, 48 chars for 80mm)
  const charWidth = paperSize === '80mm' ? 48 : 32;
  const divider = '-'.repeat(charWidth) + '\n';
  const currencySymbol = prefs.currency === 'IDR' ? 'Rp' : prefs.currency;

  const formatCurrency = (amount: number) => {
    const val = amount || 0;
    return `${currencySymbol} ${val.toLocaleString('id-ID')}`;
  };

  const formatRow = (left: string, right: string, width: number): string => {
    const spaces = width - left.length - right.length;
    if (spaces > 0) {
      return left + ' '.repeat(spaces) + right + '\n';
    } else {
      if (left.length + right.length > width) {
        const allowedLeftLength = width - right.length - 1;
        const truncatedLeft = left.substring(0, allowedLeftLength);
        const remainingSpaces = width - truncatedLeft.length - right.length;
        return truncatedLeft + ' '.repeat(remainingSpaces) + right + '\n';
      }
      return left + ' ' + right + '\n';
    }
  };

  // Initialize
  commands += PRINTER_COMMANDS.INIT;

  // Header (Centered)
  commands += PRINTER_COMMANDS.ALIGN_CENTER;
  commands += PRINTER_COMMANDS.BOLD_ON;
  commands += `${tokoInfo.nama.toUpperCase()}\n`;
  commands += PRINTER_COMMANDS.BOLD_OFF;
  if (tokoInfo.alamat) {
    commands += `${tokoInfo.alamat}\n`;
  }
  if (tokoInfo.telepon) {
    commands += `Telp: ${tokoInfo.telepon}\n`;
  }
  commands += divider;

  // Meta Info (Left-aligned)
  commands += PRINTER_COMMANDS.ALIGN_LEFT;
  
  let txDateStr = '';
  try {
    txDateStr = format(new Date(transaction.created_at), prefs.dateFormat.replace('yyyy', 'yy').replace('MMMM', 'MMM'), { locale: id });
  } catch (e) {
    txDateStr = new Date(transaction.created_at).toLocaleString('id-ID');
  }

  commands += `Tgl: ${txDateStr}\n`;
  commands += `Nota: ${transaction.id?.toString().slice(-6).toUpperCase() || 'NEW'}\n`;
  if (transaction.customer_name) {
    commands += `Pelanggan: ${transaction.customer_name}\n`;
  }
  if (prefs.showCashierName) {
    commands += `Kasir: ${transaction.cashier_name || cashierName}\n`;
  }
  commands += `Bayar: ${transaction.payment_method === 'cash' ? 'Tunai' : 'Tempo'}\n`;
  commands += divider;

  // Items
  transaction.items.forEach((item: any) => {
    // Line 1: Item Name
    commands += `${item.name_at_time || item.name}\n`;
    // Line 2: Qty x Price = Subtotal
    const qtyPrice = `${item.quantity} x ${formatCurrency(item.price_at_time || item.price)}`;
    const total = formatCurrency((item.price_at_time || item.price) * item.quantity);
    commands += formatRow(`  ${qtyPrice}`, total, charWidth);

    // Item discount if any
    if (item.disc1 > 0 || item.disc2 > 0 || item.nominalDisc > 0) {
      const originalVal = (item.price_at_time || item.price) * item.quantity;
      const finalVal = (item.price_at_time || item.price) * (1 - (item.disc1||0)/100) * (1 - (item.disc2||0)/100) * item.quantity - (item.nominalDisc||0);
      const discountAmount = originalVal - finalVal;
      if (discountAmount > 0) {
        commands += formatRow(`  *Diskon`, `-${formatCurrency(discountAmount)}`, charWidth);
      }
    }
  });
  commands += divider;

  // Summary
  commands += formatRow('Subtotal:', formatCurrency(transaction.subtotal || transaction.total_amount), charWidth);

  if ((transaction.service_charge_amount || 0) > 0) {
    commands += formatRow('Service Charge:', formatCurrency(transaction.service_charge_amount), charWidth);
  }

  if ((transaction.tax_amount || 0) > 0) {
    commands += formatRow('Pajak (PPN):', formatCurrency(transaction.tax_amount), charWidth);
  }

  // Bold TOTAL
  commands += PRINTER_COMMANDS.BOLD_ON;
  commands += formatRow('TOTAL:', formatCurrency(transaction.total_amount), charWidth);
  commands += PRINTER_COMMANDS.BOLD_OFF;

  if (transaction.discount_total > 0) {
    commands += formatRow('Hemat (Diskon):', formatCurrency(transaction.discount_total), charWidth);
  }
  commands += divider;

  // Footer (Centered)
  commands += PRINTER_COMMANDS.ALIGN_CENTER;
  if (tokoInfo.pesan_nota) {
    commands += `${tokoInfo.pesan_nota}\n`;
  }
  if (tokoInfo.kebijakan_pengembalian) {
    commands += `${tokoInfo.kebijakan_pengembalian}\n`;
  }
  
  if (tokoInfo.instagram || tokoInfo.tiktok || tokoInfo.email_bisnis) {
    if (tokoInfo.instagram) commands += `IG: ${tokoInfo.instagram}\n`;
    if (tokoInfo.tiktok) commands += `TikTok: ${tokoInfo.tiktok}\n`;
    if (tokoInfo.email_bisnis) commands += `Email: ${tokoInfo.email_bisnis}\n`;
  }
  
  commands += '\nKasirHub POS - v1.0.0\n';

  // Feed paper & Cut
  commands += PRINTER_COMMANDS.LF;
  commands += PRINTER_COMMANDS.LF;
  commands += PRINTER_COMMANDS.LF;
  commands += PRINTER_COMMANDS.LF;
  commands += PRINTER_COMMANDS.CUT;

  return encoder.encode(commands);
}

/**
 * Prints a receipt to a Bluetooth printer
 */
export async function printReceiptBluetooth(transaction: LocalTransaction, paperSize: string = '58mm') {
  const nav = navigator as any;
  if (!nav.bluetooth) {
    throw new Error("Browser Anda tidak mendukung Web Bluetooth.");
  }

  try {
    let device: any = null;

    if (nav.bluetooth.getDevices) {
      const devices = await nav.bluetooth.getDevices();
      if (devices && devices.length > 0) {
        device = devices[0];
      }
    }

    if (!device) {
      device = await nav.bluetooth.requestDevice({
        filters: [{ services: ['000018f0-0000-1000-8000-00805f9b34fb'] }], // Standard POS service
        optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb']
      });
    }

    const server = await device.gatt?.connect();
    const service = await server?.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
    const characteristic = await service?.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');

    const data = generateReceiptESC_POS(transaction, paperSize);
    
    // Chunk size: 20 bytes for standard BLE payload
    const chunkSize = 20;
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      await characteristic?.writeValue(chunk);
      await new Promise(resolve => setTimeout(resolve, 10)); // 10ms pacing
    }
    
    return true;
  } catch (error: any) {
    console.error("Bluetooth Print Error:", error);
    throw error;
  }
}

/**
 * Prints a receipt to a USB printer
 */
export async function printReceiptUSB(transaction: LocalTransaction, paperSize: string = '58mm') {
  const nav = navigator as any;
  if (!nav.usb) {
    throw new Error("Browser Anda tidak mendukung WebUSB.");
  }

  try {
    let device: any = null;

    if (nav.usb.getDevices) {
      const devices = await nav.usb.getDevices();
      if (devices && devices.length > 0) {
        device = devices[0];
      }
    }

    if (!device) {
      device = await nav.usb.requestDevice({ filters: [] });
    }

    await device.open();
    await device.selectConfiguration(1);
    await device.claimInterface(0);
    
    const data = generateReceiptESC_POS(transaction, paperSize);
    
    const chunkSize = 64;
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      await device.transferOut(1, chunk);
    }
    
    return true;
  } catch (error: any) {
    console.error("USB Print Error:", error);
    throw error;
  }
}

/**
 * Direct print entrypoint for KasirHub
 */
export async function printReceiptESC_POS(
  transaction: LocalTransaction,
  connectionType: 'bluetooth' | 'usb',
  paperSize: string = '58mm'
) {
  if (connectionType === 'bluetooth') {
    return printReceiptBluetooth(transaction, paperSize);
  } else if (connectionType === 'usb') {
    return printReceiptUSB(transaction, paperSize);
  } else {
    throw new Error(`Koneksi printer tidak didukung: ${connectionType}`);
  }
}
