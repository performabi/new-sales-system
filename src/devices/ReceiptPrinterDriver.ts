import type { IReceiptPrinter, ReceiptLine, PrinterConfig } from './interfaces';
import { buildReceipt, drawerKickBytes } from './escpos';

export class ReceiptPrinterDriver implements IReceiptPrinter {
  private status: 'ready' | 'busy' | 'error' | 'offline' = 'offline';
  private device: USBDevice | null = null;
  private port: SerialPort | null = null;
  private config: PrinterConfig;

  constructor(config: PrinterConfig) { this.config = config; }

  private get usbSupported(): boolean {
    return typeof navigator !== 'undefined' && 'usb' in navigator;
  }

  private get serialSupported(): boolean {
    return typeof navigator !== 'undefined' && 'serial' in navigator;
  }

  async connect(): Promise<boolean> {
    try {
      if (this.config.transport === 'usb') {
        if (!this.usbSupported) { this.status = 'error'; return false; }
        let filters: USBDeviceFilter[] = [];
        if (this.config.vendorId) {
          const f: USBDeviceFilter = { vendorId: this.config.vendorId };
          if (this.config.productId) f.productId = this.config.productId;
          filters = [f];
        }
        this.device = await navigator.usb.requestDevice({ filters });
        await this.device.open();
        await this.device.selectConfiguration(1);
        const iface = this.device.configuration?.interfaces?.[0];
        if (iface) {
          await this.device.claimInterface(iface.interfaceNumber);
          if (iface.alternate?.endpoints?.[0]?.type === 'bulk') {
            await this.device.selectAlternateInterface(iface.interfaceNumber, 0);
          }
        }
        this.status = 'ready';
        return true;
      }
      if (!this.serialSupported) { this.status = 'error'; return false; }
      this.port = await navigator.serial.requestPort();
      await this.port.open({ baudRate: this.config.baud || 9600 });
      this.status = 'ready';
      return true;
    } catch {
      this.status = 'error';
      return false;
    }
  }

  private async write(bytes: Uint8Array): Promise<void> {
    const payload = new Uint8Array(bytes.byteLength);
    payload.set(bytes);
    if (this.config.transport === 'usb') {
      if (!this.device) throw new Error('Printer not connected');
      await this.device.transferOut(1, payload);
      return;
    }
    if (!this.port) throw new Error('Printer not connected');
    const writer = this.port.writable?.getWriter();
    if (!writer) throw new Error('Printer port not writable');
    try {
      await writer.write(payload);
    } finally {
      writer.releaseLock();
    }
  }

  async print(lines: ReceiptLine[]): Promise<boolean> {
    this.status = 'busy';
    try {
      await this.write(buildReceipt(lines));
      this.status = 'ready';
      return true;
    } catch {
      this.status = 'error';
      return false;
    }
  }

  /** Kick a chained cash drawer through this printer's transport. */
  async kickDrawer(): Promise<boolean> {
    try {
      await this.write(drawerKickBytes());
      return true;
    } catch {
      return false;
    }
  }

  getStatus() { return this.status; }

  disconnect() {
    this.device?.close().catch(() => {});
    this.device = null;
    this.port?.close().catch(() => {});
    this.port = null;
    this.status = 'offline';
  }
}