export interface ScaleConfig {
  enabled: boolean;
  protocol: 'ascii' | 'bare' | 'custom';
  customRegex?: string;
  baud: number;
}

export interface PrinterConfig {
  enabled: boolean;
  transport: 'usb' | 'serial';
  vendorId?: number;
  productId?: number;
  model: string;
  baud?: number;
}

export interface DrawerConfig {
  enabled: boolean;
  mode: 'chained' | 'standalone';
  port?: string;
  baud?: number;
}

export interface DeviceConfig {
  scale: ScaleConfig;
  printer: PrinterConfig;
  drawer: DrawerConfig;
}

export const DEFAULT_DEVICE_CONFIG: DeviceConfig = {
  scale: { enabled: false, protocol: 'ascii', baud: 9600 },
  printer: { enabled: false, transport: 'usb', model: '' },
  drawer: { enabled: false, mode: 'chained' },
};

export function normalizeDeviceConfig(raw: Partial<DeviceConfig> | null | undefined): DeviceConfig {
  const r = raw ?? {};
  return {
    scale: { ...DEFAULT_DEVICE_CONFIG.scale, ...(r.scale ?? {}) },
    printer: { ...DEFAULT_DEVICE_CONFIG.printer, ...(r.printer ?? {}) },
    drawer: { ...DEFAULT_DEVICE_CONFIG.drawer, ...(r.drawer ?? {}) },
  };
}

export interface WeightReading {
  weight: number;
  unit: 'kg' | 'g';
  stable: boolean;
}

export interface ScaleEventHandlers {
  onWeight: (reading: WeightReading) => void;
  onError: (error: string) => void;
  onConnect: () => void;
  onDisconnect: () => void;
}

export interface IScale {
  connect(): Promise<boolean>;
  disconnect(): void;
  isConnected(): boolean;
  subscribe(handlers: ScaleEventHandlers): void;
  unsubscribe(): void;
  readWeight(): Promise<number | null>;
}

export interface IBarcodeScanner {
  onBarcode(handler: (barcode: string) => void): void;
  start(): void;
  stop(): void;
}

export interface ICashDrawer {
  open(): Promise<boolean>;
  isOpen(): boolean;
}

export interface ReceiptLine {
  type: 'header' | 'item' | 'discount' | 'total' | 'payment' | 'footer' | 'barcode';
  text: string;
  value?: string;
}

export interface IReceiptPrinter {
  print(lines: ReceiptLine[]): Promise<boolean>;
  getStatus(): 'ready' | 'busy' | 'error' | 'offline';
}

export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  authCode?: string;
  message: string;
}

export interface ICardTerminal {
  processPayment(amount: number): Promise<PaymentResult>;
  cancel(): void;
  getStatus(): 'idle' | 'processing' | 'ready' | 'error';
}
