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

// In the installed (home-screen) app, keep the interface at a fixed size: no pinch zoom, double-tap
// zoom or Ctrl/⌘ +/− zoom. iPhones ignore `user-scalable=no` on its own, so the pinch gestures are
// also blocked in code. The normal browser tab is left alone so people can still zoom there.
export function lockZoomInInstalledApp() {
  if (typeof window === 'undefined' || !isStandalone()) return;

  const viewport = document.querySelector('meta[name="viewport"]');
  if (viewport) viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
  document.documentElement.classList.add('app-mode');

  const block = (e) => e.preventDefault();
  // iOS pinch gestures
  ['gesturestart', 'gesturechange', 'gestureend'].forEach((type) => document.addEventListener(type, block, { passive: false }));
  // Two-finger pinch on other touch browsers
  document.addEventListener('touchmove', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
  // Trackpad pinch / Ctrl + scroll and keyboard zoom in the desktop app window
  window.addEventListener('wheel', (e) => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && ['+', '=', '-', '_', '0'].includes(e.key)) e.preventDefault();
  });
}
