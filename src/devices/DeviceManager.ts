import type { IScale, IBarcodeScanner, ICashDrawer, IReceiptPrinter, ICardTerminal, DeviceConfig } from './interfaces';
import { ScaleSimulator } from './ScaleSimulator';
import { BarcodeScannerSimulator } from './BarcodeScannerSimulator';
import { CashDrawerSimulator } from './CashDrawerSimulator';
import { ReceiptPrinterSimulator } from './ReceiptPrinterSimulator';
import { CardTerminalSimulator } from './CardTerminalSimulator';
import { ScaleSerialDriver } from './ScaleSerialDriver';
import { ReceiptPrinterDriver } from './ReceiptPrinterDriver';
import { CashDrawerDriver } from './CashDrawerDriver';

export interface DeviceManagerState {
  scaleConnected: boolean;
  printerConnected: boolean;
  drawerConnected: boolean;
  scaleIsSimulator: boolean;
  printerIsSimulator: boolean;
  drawerIsSimulator: boolean;
  serialSupported: boolean;
  usbSupported: boolean;
}

type Listener = (state: DeviceManagerState) => void;

class DeviceManager {
  private scale: IScale = new ScaleSimulator();
  private scanner: IBarcodeScanner = new BarcodeScannerSimulator();
  private drawer: ICashDrawer = new CashDrawerSimulator();
  private printer: IReceiptPrinter = new ReceiptPrinterSimulator();
  private terminal: ICardTerminal = new CardTerminalSimulator();

  private listeners: Set<Listener> = new Set();
  private state: DeviceManagerState = {
    scaleConnected: false,
    printerConnected: false,
    drawerConnected: false,
    scaleIsSimulator: true,
    printerIsSimulator: true,
    drawerIsSimulator: true,
    serialSupported: typeof navigator !== 'undefined' && 'serial' in navigator,
    usbSupported: typeof navigator !== 'undefined' && 'usb' in navigator,
  };

  registerScale(driver: IScale) {
    this.scale = driver;
    this.update({ scaleIsSimulator: false });
  }

  registerPrinter(driver: IReceiptPrinter) {
    this.printer = driver;
    this.update({ printerIsSimulator: false });
  }

  registerDrawer(driver: ICashDrawer) {
    this.drawer = driver;
    this.update({ drawerIsSimulator: false });
  }

  registerTerminal(driver: ICardTerminal) {
    this.terminal = driver;
  }

  getScale(): IScale { return this.scale; }
  getScanner(): IBarcodeScanner { return this.scanner; }
  getDrawer(): ICashDrawer { return this.drawer; }
  getPrinter(): IReceiptPrinter { return this.printer; }
  getTerminal(): ICardTerminal { return this.terminal; }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  getState(): DeviceManagerState { return this.state; }

  private update(patch: Partial<DeviceManagerState>) {
    this.state = { ...this.state, ...patch };
    for (const l of this.listeners) l(this.state);
  }

  /** Poll simulators (scale) and surface connection state to subscribers. */
  syncStatus() {
    const scale = this.scale.isConnected ? this.scale.isConnected() : false;
    const printerConnected = this.printer.getStatus ? this.printer.getStatus() === 'ready' : false;
    const drawerConnected = this.drawer.isOpen ? this.drawer.isOpen() : false;
    this.update({
      scaleConnected: scale,
      printerConnected,
      drawerConnected,
    });
  }

  /** Apply per-store device config: swaps in real drivers when enabled, else falls back to simulators. */
  applyConfig(config: DeviceConfig) {
    if (config.scale?.enabled && this.state.serialSupported) {
      this.registerScale(new ScaleSerialDriver(config.scale));
    }
    if (config.printer?.enabled && (this.state.usbSupported || this.state.serialSupported)) {
      this.registerPrinter(new ReceiptPrinterDriver(config.printer));
    }
    if (config.drawer?.enabled) {
      const drawer = new CashDrawerDriver(config.drawer);
      if (config.drawer.mode === 'chained' && !this.state.printerIsSimulator) {
        drawer.attachPrinter(this.printer as ReceiptPrinterDriver);
      }
      this.registerDrawer(drawer);
    }
  }
}

export const deviceManager = new DeviceManager();