import type { IScale, ScaleEventHandlers, ScaleConfig } from './interfaces';

interface ParsedWeight {
  weight: number | null;
  unit: 'kg' | 'g';
}

function parseProtocol(line: string, config: ScaleConfig): ParsedWeight {
  if (config.protocol === 'custom' && config.customRegex) {
    try {
      const m = new RegExp(config.customRegex).exec(line);
      const raw = m?.[1];
      if (raw === undefined) return { weight: null, unit: 'kg' };
      const w = parseFloat(raw);
      return isNaN(w) ? { weight: null, unit: 'kg' } : { weight: w, unit: 'kg' };
    } catch {
      return { weight: null, unit: 'kg' };
    }
  }
  if (config.protocol === 'bare') {
    const m = line.trim().match(/^[-+]?\d+(\.\d+)?$/);
    if (!m) return { weight: null, unit: 'kg' };
    const w = parseFloat(m[0]);
    return isNaN(w) ? { weight: null, unit: 'kg' } : { weight: w, unit: 'kg' };
  }
  // 'ascii' — continuous frame e.g. "ST,GS,+ 0.000kg" (Mettler/Sartorius-style)
  const m = line.match(/([-+]?\d+(?:\.\d+)?)\s*(kg|g|kglb|g|lb)/i);
  if (!m) return { weight: null, unit: 'kg' };
  const w = parseFloat(m[1]);
  if (isNaN(w)) return { weight: null, unit: 'kg' };
  const unit = (m[2] || '').toLowerCase();
  return { weight: w, unit: unit === 'g' ? 'g' : 'kg' };
}

/**
 * Web Serial scale driver. Opens the browser's serial chooser on connect()
 * and parses the continuous stream per the configured protocol preset.
 * Falls back gracefully when navigator.serial is unavailable (non-Chromium).
 */
export class ScaleSerialDriver implements IScale {
  private connected = false;
  private port: SerialPort | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private handlers?: ScaleEventHandlers;
  private buffer = '';
  private latest: ParsedWeight = { weight: null, unit: 'kg' };
  private stable = false;
  private stableStreak = 0;
  private readonly stableThreshold = 3;

  constructor(config: ScaleConfig) { this.config = config; }
  private config: ScaleConfig;

  private get serialSupported(): boolean {
    return typeof navigator !== 'undefined' && 'serial' in navigator;
  }

  async connect(): Promise<boolean> {
    if (this.connected) return true;
    if (!this.serialSupported) {
      this.handlers?.onError('Web Serial not supported in this browser');
      return false;
    }
    try {
      const serial = navigator.serial;
      const port = await serial.requestPort();
      await port.open({ baudRate: this.config.baud || 9600 });
      this.port = port;
      this.connected = true;
      this.handlers?.onConnect();
      this.readLoop();
      return true;
    } catch (err) {
      this.handlers?.onError(`Scale connect failed: ${(err as Error).message}`);
      this.connected = false;
      return false;
    }
  }

  private async readLoop() {
    if (!this.port) return;
    const reader = this.port.readable?.getReader();
    if (!reader) return;
    this.reader = reader;
    try {
      while (this.connected && this.port) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          const text = new TextDecoder().decode(value);
          this.buffer += text;
          this.consumeBuffer();
        }
      }
    } catch {
      // stream closed / port removed
    } finally {
      reader.releaseLock();
      if (this.connected) this.disconnect();
    }
  }

  private consumeBuffer() {
    const chunks = this.buffer.split(/\r?\n/);
    this.buffer = chunks.pop() || '';
    for (const line of chunks) {
      const parsed = parseProtocol(line, this.config);
      if (parsed.weight !== null) {
        const prev = this.latest.weight;
        this.latest = parsed;
        this.stableStreak = prev !== null && parsed.weight === prev ? this.stableStreak + 1 : 0;
        this.stable = this.stableStreak >= this.stableThreshold;
        this.handlers?.onWeight({ weight: parsed.weight, unit: parsed.unit, stable: this.stable });
      }
    }
  }

  disconnect(): void {
    this.connected = false;
    this.reader?.cancel().catch(() => {});
    this.reader?.releaseLock();
    this.reader = null;
    this.port?.close().catch(() => {});
    this.port = null;
    this.buffer = '';
    this.handlers?.onDisconnect();
  }

  isConnected(): boolean { return this.connected; }

  subscribe(handlers: ScaleEventHandlers): void { this.handlers = handlers; }

  unsubscribe(): void {
    this.handlers = undefined;
    this.disconnect();
  }

  async readWeight(): Promise<number | null> {
    return this.latest.weight;
  }
}