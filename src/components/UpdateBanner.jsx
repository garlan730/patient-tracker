import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

// The installed (home-screen) app can keep showing an old version: iPhones resume it instead of
// reloading, and GitHub Pages lets the page be cached for 10 minutes. On start and whenever the app
// comes back to the front, compare the live page's script file with the one running; if they differ,
// offer a reload (a banner, not an automatic reload, so nobody loses what they were typing).
const scriptOf = (html) => html.match(/assets\/index-[\w-]+\.js/)?.[0];

export default function UpdateBanner() {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    const running = scriptOf(document.documentElement.innerHTML);
    if (!running) return; // dev server: no hashed build files

    let checking = false;
    const check = async () => {
      if (checking || document.visibilityState !== 'visible') return;
      checking = true;
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}index.html?v=${Date.now()}`, { cache: 'no-store' });
        const live = scriptOf(await res.text());
        if (live && live !== running) setAvailable(true);
      } catch {
        // offline or blocked: try again next time
      } finally {
        checking = false;
      }
    };

    check();
    document.addEventListener('visibilitychange', check);
    const timer = setInterval(check, 15 * 60 * 1000);
    return () => {
      document.removeEventListener('visibilitychange', check);
      clearInterval(timer);
    };
  }, []);

  if (!available) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] flex justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="flex w-full max-w-md items-center gap-3 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-xl">
        <RefreshCw size={16} className="shrink-0" />
        <span className="flex-1">A new version of the app is available.</span>
        <button onClick={() => window.location.reload()} className="rounded-lg bg-white px-3 py-1.5 font-medium text-slate-900 hover:bg-slate-100">
          Update
        </button>
      </div>
    </div>
  );
}
