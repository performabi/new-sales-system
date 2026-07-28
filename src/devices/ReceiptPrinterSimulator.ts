import type { IReceiptPrinter, ReceiptLine } from './interfaces';

export class ReceiptPrinterSimulator implements IReceiptPrinter {
  private status: 'ready' | 'busy' | 'error' | 'offline' = 'ready';

  async print(lines: ReceiptLine[]): Promise<boolean> {
    this.status = 'busy';
    console.log('[ReceiptPrinter] Printing receipt:', lines);
    await new Promise((r) => setTimeout(r, 500));
    this.status = 'ready';
    return true;
  }

  getStatus() { return this.status; }
}
