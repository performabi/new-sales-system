import type { IScale, IBarcodeScanner, ICashDrawer, IReceiptPrinter, ICardTerminal } from './interfaces';
import { ScaleSimulator } from './ScaleSimulator';
import { BarcodeScannerSimulator } from './BarcodeScannerSimulator';
import { CashDrawerSimulator } from './CashDrawerSimulator';
import { ReceiptPrinterSimulator } from './ReceiptPrinterSimulator';
import { CardTerminalSimulator } from './CardTerminalSimulator';

class DeviceManager {
  private scale: IScale;
  private scanner: IBarcodeScanner;
  private drawer: ICashDrawer;
  private printer: IReceiptPrinter;
  private terminal: ICardTerminal;

  constructor() {
    this.scale = new ScaleSimulator();
    this.scanner = new BarcodeScannerSimulator();
    this.drawer = new CashDrawerSimulator();
    this.printer = new ReceiptPrinterSimulator();
    this.terminal = new CardTerminalSimulator();
  }

  getScale(): IScale { return this.scale; }
  getScanner(): IBarcodeScanner { return this.scanner; }
  getDrawer(): ICashDrawer { return this.drawer; }
  getPrinter(): IReceiptPrinter { return this.printer; }
  getTerminal(): ICardTerminal { return this.terminal; }
}

export const deviceManager = new DeviceManager();
