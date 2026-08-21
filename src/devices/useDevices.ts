import { useSyncExternalStore } from 'react';
import { deviceManager, type DeviceManagerState } from './DeviceManager';

export function useDevices() {
  const state = useSyncExternalStore(
    (cb) => deviceManager.subscribe(cb),
    () => deviceManager.getState(),
  );

  return {
    state,
    scale: deviceManager.getScale(),
    printer: deviceManager.getPrinter(),
    drawer: deviceManager.getDrawer(),
    terminal: deviceManager.getTerminal(),
    syncStatus: () => deviceManager.syncStatus(true),
  };
}

export type { DeviceManagerState };