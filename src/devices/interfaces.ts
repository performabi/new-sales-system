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
