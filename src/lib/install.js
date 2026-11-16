import { useEffect, useState } from 'react';

// Android/desktop Chrome fire `beforeinstallprompt` (possibly before React mounts), which lets the app
// show its own Install button. iPhones never fire it, so there we show Add to Home Screen steps instead.
let deferredPrompt = null;
const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notify();
  });
}

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

// iPadOS reports itself as a Mac, so also check for a touch screen.
const isIos = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export function useInstallApp() {
  const [, rerender] = useState(0);
  useEffect(() => {
    const fn = () => rerender((n) => n + 1);
    listeners.add(fn);
    return () => listeners.delete(fn);
  }, []);

  if (isStandalone()) return { canInstall: false };
  if (deferredPrompt) {
    return {
      canInstall: true,
      mode: 'prompt',
      install: async () => {
        const prompt = deferredPrompt;
        deferredPrompt = null;
        notify();
        await prompt.prompt();
      },
    };
  }
  if (isIos()) return { canInstall: true, mode: 'ios' };
  return { canInstall: false };
}
