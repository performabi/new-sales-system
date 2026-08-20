import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { useDevices } from '../../devices/useDevices';
import { deviceManager } from '../../devices/DeviceManager';
import { normalizeDeviceConfig, type DeviceConfig } from '../../devices/interfaces';

export default function DeviceSettings() {
  const { stores, fetchStores } = useAppStore();
  const { deviceConfig, deviceConfigStoreId, fetchDeviceConfig, updateDeviceConfig } = useAppStore();
  const { state, syncStatus } = useDevices();

  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [config, setConfig] = useState<DeviceConfig>(normalizeDeviceConfig(null));
  const [saving, setSaving] = useState(false);
  const [rawDebug, setRawDebug] = useState<string>('');
  const [debugActive, setDebugActive] = useState(false);
  const debugTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetchStores();
  }, [fetchStores]);

  useEffect(() => {
    syncStatus();
    const t = setInterval(syncStatus, 3000);
    return () => clearInterval(t);
  }, [syncStatus]);

  useEffect(() => {
    if (stores.length > 0 && !selectedStoreId) {
      setSelectedStoreId(stores[0].store_id);
    }
  }, [stores, selectedStoreId]);

  useEffect(() => {
    if (selectedStoreId) {
      fetchDeviceConfig(selectedStoreId);
    }
  }, [selectedStoreId, fetchDeviceConfig]);

  useEffect(() => {
    if (deviceConfig && deviceConfigStoreId === selectedStoreId) {
      const normalized = normalizeDeviceConfig(deviceConfig);
      setConfig(normalized);
      deviceManager.applyConfig(normalized);
    }
  }, [deviceConfig, deviceConfigStoreId, selectedStoreId]);

  useEffect(() => () => {
    if (debugTimer.current) clearInterval(debugTimer.current);
  }, []);

  const handleSave = async () => {
    if (!selectedStoreId) return;
    setSaving(true);
    await updateDeviceConfig(selectedStoreId, config);
    setSaving(false);
  };

  const startScaleDebug = async () => {
    setDebugActive(true);
    setRawDebug('Listening on scale serial port… connect in the chooser.');
    try {
      const scale = deviceManager.getScale();
      await scale.connect();
      if (debugTimer.current) clearInterval(debugTimer.current);
      debugTimer.current = setInterval(async () => {
        const w = await scale.readWeight();
        if (w !== null) setRawDebug(`parsed: ${w.toFixed(3)} kg`);
      }, 800);
    } catch (err) {
      setRawDebug(`error: ${(err as Error).message}`);
      setDebugActive(false);
    }
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <h1>Device Settings</h1>
        <p style={{ color: 'var(--text-muted)' }}>
          Configure the hardware connected to this store's POS terminal: weighing scale, receipt printer, and cash drawer.
        </p>
      </div>

      <div className="card" style={{ maxWidth: '720px', padding: '24px', marginBottom: '20px' }}>
        <div className="form-group">
          <label className="form-label">Store</label>
          <select className="form-input" value={selectedStoreId} onChange={(e) => setSelectedStoreId(e.target.value)}>
            {stores.map((s) => (
              <option key={s.store_id} value={s.store_id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="card" style={{ maxWidth: '720px', padding: '24px', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '1rem', marginBottom: '12px' }}>Connection Status</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
          <div style={{ border: '1px solid var(--border-medium)', borderRadius: '8px', padding: '12px' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Scale</div>
            <div style={{ fontWeight: 700, color: state.scaleConnected ? 'var(--accent)' : 'var(--text-muted)' }}>
              {state.scaleConnected ? '● Connected' : '○ Not connected'}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {state.scaleIsSimulator ? 'simulator' : 'hardware'} · {state.serialSupported ? 'Web Serial OK' : 'Web Serial unavailable'}
            </div>
          </div>
          <div style={{ border: '1px solid var(--border-medium)', borderRadius: '8px', padding: '12px' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Printer</div>
            <div style={{ fontWeight: 700, color: state.printerConnected ? 'var(--accent)' : 'var(--text-muted)' }}>
              {state.printerConnected ? '● Connected' : '○ Not connected'}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {state.printerIsSimulator ? 'simulator' : 'hardware'} · {state.usbSupported ? 'Web USB OK' : 'Web USB unavailable'}
            </div>
          </div>
          <div style={{ border: '1px solid var(--border-medium)', borderRadius: '8px', padding: '12px' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Cash Drawer</div>
            <div style={{ fontWeight: 700, color: state.drawerConnected ? 'var(--accent)' : 'var(--text-muted)' }}>
              {state.drawerConnected ? '● Open' : '○ Closed'}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {state.drawerIsSimulator ? 'simulator' : 'hardware'}
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ maxWidth: '720px', padding: '24px' }}>
        <h2 style={{ fontSize: '1rem', marginBottom: '12px' }}>Configuration</h2>

        <div className="form-group">
          <label className="form-label">Scale (Web Serial)</label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <select className="form-input" style={{ flex: 1 }} value={config.scale.protocol}
              onChange={(e) => setConfig({ ...config, scale: { ...config.scale, protocol: e.target.value as 'ascii' | 'bare' | 'custom' } })}>
              <option value="ascii">Continuous ASCII (e.g. ST,GS,+ 0.000kg)</option>
              <option value="bare">Bare float (e.g. 0.123)</option>
              <option value="custom">Custom regex</option>
            </select>
            <select className="form-input" style={{ width: '110px' }} value={config.scale.baud}
              onChange={(e) => setConfig({ ...config, scale: { ...config.scale, baud: Number(e.target.value) } })}>
              {[9600, 19200, 38400, 57600, 115200].map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          {config.scale.protocol === 'custom' && (
            <input className="form-input" style={{ marginTop: '8px' }} placeholder="regex with capture group 1 = weight"
              value={config.scale.customRegex ?? ''}
              onChange={(e) => setConfig({ ...config, scale: { ...config.scale, customRegex: e.target.value } })} />
          )}
        </div>

        <div className="form-group">
          <label className="form-label">Receipt Printer</label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <select className="form-input" style={{ width: '140px' }} value={config.printer.transport}
              onChange={(e) => setConfig({ ...config, printer: { ...config.printer, transport: e.target.value as 'usb' | 'serial' } })}>
              <option value="usb">Web USB</option>
              <option value="serial">Web Serial</option>
            </select>
            <input className="form-input" style={{ flex: 1 }} placeholder="Model (e.g. Epson TM-T20)"
              value={config.printer.model}
              onChange={(e) => setConfig({ ...config, printer: { ...config.printer, model: e.target.value } })} />
            <input className="form-input" style={{ width: '120px' }} placeholder="USB VID (hex)"
              value={config.printer.vendorId ? `0x${config.printer.vendorId.toString(16)}` : ''}
              onChange={(e) => setConfig({ ...config, printer: { ...config.printer, vendorId: parseInt(e.target.value.replace(/^0x/, ''), 16) || undefined } })} />
            <input className="form-input" style={{ width: '120px' }} placeholder="USB PID (hex)"
              value={config.printer.productId ? `0x${config.printer.productId.toString(16)}` : ''}
              onChange={(e) => setConfig({ ...config, printer: { ...config.printer, productId: parseInt(e.target.value.replace(/^0x/, ''), 16) || undefined } })} />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Cash Drawer</label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select className="form-input" style={{ width: '180px' }} value={config.drawer.mode}
              onChange={(e) => setConfig({ ...config, drawer: { ...config.drawer, mode: e.target.value as 'chained' | 'standalone' } })}>
              <option value="chained">Chained (via printer)</option>
              <option value="standalone">Standalone (own serial)</option>
            </select>
            {config.drawer.mode === 'standalone' && (
              <input className="form-input" style={{ flex: 1 }} placeholder="Serial port / device"
                value={config.drawer.port ?? ''}
                onChange={(e) => setConfig({ ...config, drawer: { ...config.drawer, port: e.target.value } })} />
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !selectedStoreId}>
            {saving ? 'Saving…' : 'Save Device Settings'}
          </button>
          <button className="btn btn-ghost" onClick={() => setConfig(normalizeDeviceConfig(null))}>Reset to Defaults</button>
        </div>
      </div>

      <div className="card" style={{ maxWidth: '720px', padding: '24px', marginTop: '20px' }}>
        <h2 style={{ fontSize: '1rem', marginBottom: '12px' }}>Scale Debug</h2>
        <pre style={{
          background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px',
          fontSize: '0.85rem', fontFamily: 'monospace', whiteSpace: 'pre-wrap', minHeight: '48px',
        }}>{rawDebug || 'Not listening. Click Start Debug to open the serial chooser.'}</pre>
        <button className="btn btn-ghost" style={{ marginTop: '8px' }} onClick={startScaleDebug} disabled={debugActive}>
          {debugActive ? 'Listening…' : 'Start Scale Debug'}
        </button>
      </div>
    </div>
  );
}