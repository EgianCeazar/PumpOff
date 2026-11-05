import { emptyLog, parseLog } from '@pumpoff/core';

// The workout log lives in this browser's storage, so it works offline
// and needs no account. It stays on this device and browser only; use
// Export on the Progress screen to back it up.
const KEY = 'pumpoff.log.v1';

export function loadLog() {
  try {
    const text = localStorage.getItem(KEY);
    return text ? parseLog(text) : emptyLog();
  } catch {
    return emptyLog();
  }
}

export function saveLog(log) {
  try {
    localStorage.setItem(KEY, JSON.stringify(log));
    return true;
  } catch {
    return false;
  }
}

// Asks the browser not to clear this site's storage when space runs low.
export function requestPersistentStorage() {
  try {
    navigator.storage?.persist?.().catch(() => {});
  } catch {
    // Not supported; storage still works, it just may be cleared under pressure.
  }
}
