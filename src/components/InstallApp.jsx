import { useState } from 'react';
import { Download, Share, SquarePlus } from 'lucide-react';
import { useInstallApp } from '../lib/install.js';
import { Button, Modal, cx } from './ui.jsx';

// "Install app" button: opens the browser's install prompt, or Add to Home Screen steps on iPhone.
// Renders nothing when the app is already installed or the browser can't install it.
export default function InstallApp({ className, children }) {
  const { canInstall, mode, install } = useInstallApp();
  const [showSteps, setShowSteps] = useState(false);
  if (!canInstall) return null;

  return (
    <>
      <button type="button" onClick={() => (mode === 'prompt' ? install() : setShowSteps(true))} className={className}>
        <Download size={16} /> {children || 'Install app'}
      </button>
      <Modal open={showSteps} onClose={() => setShowSteps(false)} title="Add to Home Screen" footer={<Button onClick={() => setShowSteps(false)}>Got it</Button>}>
        <ol className="space-y-4 text-sm text-slate-700">
          <Step n={1}>
            Tap the <b>Share</b> button <Share size={16} className="inline -mt-1 text-sky-600" aria-label="Share icon" /> in the browser bar
            (bottom of the screen in Safari, top right in Chrome).
          </Step>
          <Step n={2}>
            Scroll down and tap <b>Add to Home Screen</b> <SquarePlus size={16} className="inline -mt-1" aria-hidden />.
          </Step>
          <Step n={3}>Tap <b>Add</b>. The Baruga Tracker icon appears on your home screen and opens full screen.</Step>
        </ol>
      </Modal>
    </>
  );
}

function Step({ n, children }) {
  return (
    <li className="flex gap-3">
      <span className={cx('flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-700 text-xs font-semibold text-white')}>{n}</span>
      <span className="leading-relaxed">{children}</span>
    </li>
  );
}
