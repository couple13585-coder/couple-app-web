(() => {
  'use strict';
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const base = new URL('.', document.baseURI);
  let preparing, readyRegistration;
  const prepare = () => {
    if (!supported) return Promise.resolve(null);
    return preparing ??= navigator.serviceWorker.register(new URL('couple_push_service_worker.js', base), { scope: new URL('push/', base).pathname }).then(async (registration) => {
      if (!registration.active) {
        const worker = registration.installing || registration.waiting;
        if (worker) await new Promise((resolve, reject) => {
          const changed = () => { if (worker.state === 'activated') resolve(); else if (worker.state === 'redundant') reject(new Error('Worker installation failed')); };
          worker.addEventListener('statechange', changed); changed();
        });
      }
      readyRegistration = registration;
      return registration;
    }).catch((error) => { preparing = undefined; throw error; });
  };
  const disable = async () => {
    try { const registration = await prepare(); const subscription = await registration?.pushManager.getSubscription(); if (subscription) await subscription.unsubscribe(); }
    finally { localStorage.removeItem('couple_push_owner'); }
  };
  let identity = Promise.resolve();
  const ensureOwner = (owner) => identity = identity.then(async () => {
    const previous = localStorage.getItem('couple_push_owner');
    if (previous && previous !== owner) await disable();
  }).catch(() => {});
  window.couplePush = {
    supported,
    ready: prepare,
    disable,
    ensureOwner,
    enable: async (key, owner) => {
      if (!supported) return JSON.stringify({ status: 'unsupported' });
      if (!readyRegistration) { prepare().catch(() => {}); return JSON.stringify({ status: 'initializing' }); }
      const previousOwner = localStorage.getItem('couple_push_owner');
      if (previousOwner && previousOwner !== owner) { await ensureOwner(owner); return JSON.stringify({ status: 'initializing' }); }
      const raw = atob(key.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - key.length % 4) % 4));
      let subscription;
      try {
        // Subscribe immediately inside the tap. Safari requires this user gesture.
        const request = readyRegistration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: Uint8Array.from(raw, (c) => c.charCodeAt(0)) });
        subscription = await request;
      } catch (error) {
        if (Notification.permission === 'denied' || error.name === 'NotAllowedError') return JSON.stringify({ status: 'denied' });
        throw error;
      }
      let device = localStorage.getItem('couple_push_device');
      if (!device) { device = crypto.randomUUID(); localStorage.setItem('couple_push_device', device); }
      localStorage.setItem('couple_push_owner', owner);
      return JSON.stringify({ status: 'subscribed', device, subscription: subscription.toJSON() });
    },
  };
  prepare().catch(() => {});
})();
