const STORAGE_KEY = 'telyx-live-handoff-sync';
const CHANNEL_NAME = 'telyx-live-handoff-sync';

function safeParse(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function publishLiveHandoffSync(payload = {}) {
  const event = {
    ...payload,
    emittedAt: new Date().toISOString(),
  };

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(event));
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage sync failures.
    }
  }

  if (typeof BroadcastChannel !== 'undefined') {
    try {
      const channel = new BroadcastChannel(CHANNEL_NAME);
      channel.postMessage(event);
      channel.close();
    } catch {
      // Ignore BroadcastChannel failures.
    }
  }
}

export function subscribeLiveHandoffSync(callback) {
  if (typeof window === 'undefined' || typeof callback !== 'function') {
    return () => {};
  }

  const handleStorage = (event) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    const payload = safeParse(event.newValue);
    if (payload) callback(payload);
  };

  window.addEventListener('storage', handleStorage);

  let channel = null;
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = (event) => {
        if (event?.data) callback(event.data);
      };
    } catch {
      channel = null;
    }
  }

  return () => {
    window.removeEventListener('storage', handleStorage);
    if (channel) {
      channel.close();
    }
  };
}
