import type { ICashDrawer, DrawerConfig } from './interfaces';
import { drawerKickBytes } from './escpos';

export class CashDrawerDriver implements ICashDrawer {
  private _open = false;
  private printer: { kickDrawer: () => Promise<boolean> } | null = null;
  private port: SerialPort | null = null;
  private config: DrawerConfig;

  constructor(config: DrawerConfig) { this.config = config; }

  /** For chained drawers, supply the printer driver so the kick flows through it. */
  attachPrinter(printer: { kickDrawer: () => Promise<boolean> }) {
    this.printer = printer;
  }

  private get serialSupported(): boolean {
    return typeof navigator !== 'undefined' && 'serial' in navigator;
  }

  async open(): Promise<boolean> {
    if (this.config.mode === 'chained' && this.printer) {
      const ok = await this.printer.kickDrawer();
      if (ok) {
        this._open = true;
        setTimeout(() => { this._open = false; }, 5000);
      }
      return ok;
    }
    if (this.config.mode === 'standalone') {
      if (!this.serialSupported) return false;
      try {
        if (!this.port) {
          this.port = await navigator.serial.requestPort();
          await this.port.open({ baudRate: this.config.baud || 9600 });
        }
        const writer = this.port.writable?.getWriter();
        if (writer) {
          try { await writer.write(drawerKickBytes()); } finally { writer.releaseLock(); }
        }
        this._open = true;
        setTimeout(() => { this._open = false; }, 5000);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  isOpen(): boolean { return this._open; }
}