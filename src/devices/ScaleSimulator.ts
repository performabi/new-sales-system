import type { IScale, ScaleEventHandlers } from './interfaces';

export class ScaleSimulator implements IScale {
  private connected = false;
  private handlers?: ScaleEventHandlers;
  private timer?: ReturnType<typeof setInterval>;

  async connect(): Promise<boolean> {
    this.connected = true;
    this.handlers?.onConnect();
    this.timer = setInterval(() => {
      if (!this.connected) return;
      const weight = Math.round((Math.random() * 5 + 0.1) * 1000) / 1000;
      this.handlers?.onWeight({ weight, unit: 'kg', stable: Math.random() > 0.7 });
    }, 800);
    return true;
  }

  disconnect(): void {
    this.connected = false;
    clearInterval(this.timer);
    this.handlers?.onDisconnect();
  }

  isConnected(): boolean { return this.connected; }

  subscribe(handlers: ScaleEventHandlers): void { this.handlers = handlers; }

  unsubscribe(): void {
    this.handlers = undefined;
    this.disconnect();
  }

  async readWeight(): Promise<number | null> {
    if (!this.connected) return null;
    return Math.round((Math.random() * 5 + 0.1) * 1000) / 1000;
  }
}
