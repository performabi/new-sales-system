import type { ICashDrawer } from './interfaces';

export class CashDrawerSimulator implements ICashDrawer {
  private _open = false;

  async open(): Promise<boolean> {
    this._open = true;
    console.log('[CashDrawer] Drawer opened');
    setTimeout(() => { this._open = false; }, 5000);
    return true;
  }

  isOpen(): boolean { return this._open; }
}
