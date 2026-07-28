import type { ICardTerminal, PaymentResult } from './interfaces';

type StatusCallback = (result: PaymentResult) => void;

export class CardTerminalSimulator implements ICardTerminal {
  private status: 'idle' | 'processing' | 'ready' | 'error' = 'idle';
  private onComplete?: StatusCallback;

  async processPayment(_amount: number): Promise<PaymentResult> {
    this.status = 'processing';
    return new Promise((resolve) => {
      this.onComplete = resolve;
    });
  }

  /** Call from UI to simulate card terminal result */
  completeWith(result: PaymentResult): void {
    this.status = result.success ? 'ready' : 'error';
    this.onComplete?.(result);
    this.onComplete = undefined;
    setTimeout(() => { this.status = 'idle'; }, 2000);
  }

  cancel(): void {
    this.status = 'idle';
    this.onComplete?.({ success: false, message: 'Cancelled' });
    this.onComplete = undefined;
  }

  getStatus() { return this.status; }
}
