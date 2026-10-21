import { useState } from 'react';
import { useAuth } from '../lib/auth.jsx';
import { Button, Field, Input, Modal } from './ui.jsx';

export default function ChangePasswordModal({ open, onClose }) {
  const { changePassword } = useAuth();
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const close = () => {
    setForm({ current: '', next: '', confirm: '' });
    setError('');
    setDone(false);
    onClose();
  };
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (form.next.length < 6) return setError('New password must be at least 6 characters.');
    if (form.next !== form.confirm) return setError('The new passwords don’t match.');
    setBusy(true);
    setError('');
    try {
      await changePassword(form.current, form.next);
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Change password"
      footer={
        done ? (
          <Button onClick={close}>Done</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={close}>Cancel</Button>
            <Button type="submit" form="password-form" disabled={busy}>Change password</Button>
          </>
        )
      }
    >
      {done ? (
        <p className="text-sm text-slate-600">Your password has been changed.</p>
      ) : (
        <form id="password-form" onSubmit={submit} className="space-y-4">
          <Field label="Current password">
            <Input type="password" value={form.current} onChange={set('current')} autoComplete="current-password" required autoFocus />
          </Field>
          <Field label="New password" hint="At least 6 characters.">
            <Input type="password" value={form.next} onChange={set('next')} autoComplete="new-password" required />
          </Field>
          <Field label="Confirm new password">
            <Input type="password" value={form.confirm} onChange={set('confirm')} autoComplete="new-password" required />
          </Field>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        </form>
      )}
    </Modal>
  );
}
