import type { IBarcodeScanner } from './interfaces';

type BarcodeHandler = (barcode: string) => void;

export class BarcodeScannerSimulator implements IBarcodeScanner {
  private handler?: BarcodeHandler;
  private active = false;

  onBarcode(handler: BarcodeHandler): void { this.handler = handler; }

  start(): void { this.active = true; }

  stop(): void { this.active = false; }

  /** Call this from the ScanInput UI to simulate a scan */
  simulateScan(barcode: string): void {
    if (this.active && this.handler) {
      this.handler(barcode);
    }
  }
}
