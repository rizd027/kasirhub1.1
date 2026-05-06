/**
 * KasirHub Printer Service
 * Handles ESC/POS command generation and device connectivity (Web Bluetooth/USB)
 */

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
    await characteristic?.writeValue(data);
    
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
    await device.transferOut(1, data);
    
    return true;
  } catch (error: any) {
    console.error("USB Print Error:", error);
    throw error;
  }
}
