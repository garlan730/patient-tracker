import { useState } from 'react';
import { Plus, Pencil, KeyRound, UserX, UserCheck, Download, Upload, Loader2 } from 'lucide-react';
import { PROGRAMS, ROLES } from '../lib/constants.js';
import { fmtDate } from '../lib/dates.js';
import { useAuth } from '../lib/auth.jsx';
import { useData } from '../lib/data.jsx';
import { hasRealEmail } from '../lib/firebase.js';
import { t } from '../lib/i18n.jsx';
import { Button, Card, Field, Input, Modal, PageHeader, Select, cx, useConfirm } from '../components/ui.jsx';

export default function UsersPage() {
  const { users, user: me, addUser, updateUser, resetPassword } = useAuth();
  const { downloadBackup } = useData();
  const confirm = useConfirm();
  const [modal, setModal] = useState(null); // null | { user?: object }
  const [resetting, setResetting] = useState(null); // username account whose password is being reset
  const [notice, setNotice] = useState('');

  const tell = (msg) => confirm({ title: t('Notice'), message: msg, confirmLabel: t('OK') });

  const toggleActive = async (u) => {
    if (u.active) {
      const ok = await confirm({
        title: t('Deactivate user?'),
        message: t('{name} will be signed out and can no longer sign in. You can reactivate them later.', { name: u.name }),
        confirmLabel: t('Deactivate'),
        danger: true,
      });
      if (!ok) return;
    }
    try {
      await updateUser(u.id, { active: !u.active });
    } catch (err) {
      await tell(err.message);
    }
  };

  const sendReset = async (u) => {
    if (!hasRealEmail(u.email)) return setResetting(u);
    try {
      await resetPassword(u.email);
      setNotice(t('Password reset email sent to {email}.', { email: u.email }));
    } catch (err) {
      await tell(err.message);
    }
  };

  return (
    <div className="max-w-5xl">
      <PageHeader
        title={t('Users')}
        description={t('Who can sign in and what they can do.')}
        actions={<Button onClick={() => setModal({})}><Plus size={16} /> {t('Add user')}</Button>}
      />

      {notice && <p className="mb-4 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">{notice}</p>}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">{t('Name')}</th>
                <th className="px-4 py-3">{t('Username')}</th>
                <th className="px-4 py-3">{t('Role')}</th>
                <th className="px-4 py-3">{t('Status')}</th>
                <th className="px-4 py-3">{t('Added')}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id} className={u.active ? '' : 'text-slate-400'}>
                  <td className="px-4 py-3 font-medium">
                    <span className={u.active ? 'text-slate-800' : ''}>{u.name}</span>
                    {u.id === me.id && <span className="ml-1 text-xs font-normal text-slate-400">{t('(you)')}</span>}
                  </td>
                  <td className="px-4 py-3">{u.username}</td>
                  <td className="px-4 py-3">
                    <span className={cx('rounded-full px-2 py-0.5 text-xs font-medium', u.role === 'admin' ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-600')}>
                      {ROLES[u.role]?.label || u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs">{u.active ? t('Active') : t('Deactivated')}</td>
                  <td className="px-4 py-3 text-slate-500">{fmtDate(u.createdAt?.slice(0, 10))}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => setModal({ user: u })} aria-label={t('Edit')} title={t('Edit')}><Pencil size={15} /></Button>
                      {u.id !== me.id && (
                        <Button size="icon" variant="ghost" onClick={() => sendReset(u)} aria-label={t('Reset password')} title={t('Reset password')}><KeyRound size={15} /></Button>
                      )}
                      {u.id !== me.id && (
                        <Button
                          size="icon"
                          variant={u.active ? 'danger-ghost' : 'ghost'}
                          onClick={() => toggleActive(u)}
                          aria-label={u.active ? t('Deactivate') : t('Reactivate')}
                          title={u.active ? t('Deactivate') : t('Reactivate')}
                        >
                          {u.active ? <UserX size={15} /> : <UserCheck size={15} />}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="mt-6 p-4">
        <h2 className="text-sm font-semibold text-slate-900">{t('Role permissions')}</h2>
        <ul className="mt-2 space-y-1 text-sm text-slate-600">
          {Object.values(ROLES).map((r) => (
            <li key={r.label}><span className="font-medium text-slate-800">{r.label}:</span> {r.description}</li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-slate-500">
          {t('Deactivated users are blocked immediately. To delete a login completely, remove it in the Firebase console under Authentication → Users.')}
        </p>
      </Card>

      <Card className="mt-6 p-4">
        <h2 className="text-sm font-semibold text-slate-900">{t('Backup')}</h2>
        <p className="mt-1 text-sm text-slate-600">
          {t('Download all patients, treatment dates, notes, doctors and users as a file. Do this regularly and keep the file somewhere safe — it contains patient data.')}
        </p>
        <Button variant="secondary" size="sm" className="mt-3" onClick={downloadBackup}><Download size={14} /> {t('Download backup')}</Button>
      </Card>

      <ImportCard />

      <ResetPasswordModal user={resetting} onClose={() => setResetting(null)} onDone={(u) => setNotice(t('Password for {name} has been reset. Share the new password privately.', { name: u.username }))} />

      <UserModal
        state={modal}
        isSelf={modal?.user?.id === me.id}
        onClose={() => setModal(null)}
        onSave={(data) =>
          modal?.user ? updateUser(modal.user.id, { name: data.name.trim(), role: data.role }) : addUser(data)
        }
      />
    </div>
  );
}

function UserModal({ state, isSelf, onClose, onSave }) {
  const editing = state?.user;
  const [form, setForm] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [lastState, setLastState] = useState(null);

  if (state !== lastState) {
    setLastState(state);
    setForm(editing ? { name: editing.name, username: editing.username, role: editing.role } : { name: '', username: '', role: 'staff', password: '' });
    setError('');
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!editing && form.password.length < 6) return setError(t('Password must be at least 6 characters.'));
    setBusy(true);
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={!!state}
      onClose={onClose}
      title={editing ? t('Edit user') : t('Add user')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{t('Cancel')}</Button>
          <Button type="submit" form="user-form" disabled={busy}>{editing ? t('Save changes') : t('Add user')}</Button>
        </>
      }
    >
      <form id="user-form" onSubmit={submit} className="space-y-4">
        <Field label={t('Full name')}><Input value={form.name || ''} onChange={set('name')} required autoFocus /></Field>
        <Field label={t('Username')} hint={editing ? t('Username can’t be changed.') : t('They sign in with this. Lowercase letters, numbers, dot, dash or underscore.')}>
          <Input value={form.username || ''} onChange={set('username')} required disabled={!!editing} autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder={t('e.g. sinta')} />
        </Field>
        <Field label={t('Role')} hint={isSelf ? t('You can’t remove the last admin.') : undefined}>
          <Select value={form.role || 'staff'} onChange={set('role')}>
            {Object.entries(ROLES).map(([k, r]) => <option key={k} value={k}>{r.label} — {r.description}</option>)}
          </Select>
        </Field>
        {!editing && (
          <Field label={t('Temporary password')} hint={t('At least 6 characters. Share it privately; they can change it after signing in.')}>
            <Input type="password" value={form.password || ''} onChange={set('password')} autoComplete="new-password" required />
          </Field>
        )}
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </form>
    </Modal>
  );
}

// Reads a patient import file ({ format: 'patient-tracker-import', program, patients: [{ name, firstDate?, phone?, note? }] }),
// shows what will happen, then adds the patients.
function ImportCard() {
  const { importPatients } = useData();
  const [file, setFile] = useState(null); // { name, program, patients }
  const [status, setStatus] = useState({ busy: false, error: '', result: '' });

  const pick = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    setStatus({ busy: false, error: '', result: '' });
    setFile(null);
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (data.format !== 'patient-tracker-import' || !PROGRAMS[data.program] || !Array.isArray(data.patients)) {
        throw new Error('This is not a patient import file.');
      }
      setFile({ name: f.name, program: data.program, source: data.source, patients: data.patients });
    } catch (err) {
      setStatus({ busy: false, error: err instanceof SyntaxError ? t('Could not read the file (invalid JSON).') : err.message, result: '' });
    }
  };

  const run = async () => {
    setStatus({ busy: true, error: '', result: '' });
    try {
      const { added, skipped } = await importPatients(file.program, file.patients);
      setStatus({ busy: false, error: '', result: skipped ? t('Imported {n} patient(s); skipped {skipped} already in the tracker.', { n: added, skipped }) : t('Imported {n} patient(s).', { n: added }) });
      setFile(null);
    } catch (err) {
      setStatus({ busy: false, error: err.message, result: '' });
    }
  };

  const withDate = file?.patients.filter((p) => p.firstDate).length || 0;
  const withNote = file?.patients.filter((p) => p.note).length || 0;

  return (
    <Card className="mt-6 p-4">
      <h2 className="text-sm font-semibold text-slate-900">{t('Import patients')}</h2>
      <p className="mt-1 text-sm text-slate-600">{t('Add many patients at once from an import file. Patients already in the tracker (same name) are skipped.')}</p>
      {file ? (
        <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
          <p className="font-medium">{file.name}</p>
          {file.source && <p className="text-xs text-slate-500">{file.source}</p>}
          <ul className="mt-2 list-disc pl-5 text-slate-600">
            <li>{t('{n} patients', { n: file.patients.length })} → {PROGRAMS[file.program].label}</li>
            <li>{t('{n} with a {step} date', { n: withDate, step: PROGRAMS[file.program].steps[0].label })}</li>
            <li>{t('{n} with a note', { n: withNote })}</li>
            <li>{t('No doctor assigned — set it later by editing each patient')}</li>
          </ul>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={run} disabled={status.busy}>
              {status.busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} {t('Import {n} patients', { n: file.patients.length })}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setFile(null)} disabled={status.busy}>{t('Cancel')}</Button>
          </div>
        </div>
      ) : (
        <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50">
          <Upload size={14} /> {t('Choose import file…')}
          <input type="file" accept=".json,application/json" className="hidden" onChange={pick} />
        </label>
      )}
      {status.error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{status.error}</p>}
      {status.result && <p className="mt-2 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">{status.result}</p>}
    </Card>
  );
}

// Two-step reset for username accounts (they have no mailbox for a reset email).
function ResetPasswordModal({ user, onClose, onDone }) {
  const { recreateLogin } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState(null);

  if (user !== last) {
    setLast(user);
    setPassword('');
    setError('');
  }

  const submit = async (e) => {
    e.preventDefault();
    if (password.length < 6) return setError(t('Password must be at least 6 characters.'));
    setBusy(true);
    try {
      await recreateLogin(user, password);
      onDone(user);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={!!user}
      onClose={onClose}
      title={`${t('Reset password')} · ${user?.username}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{t('Cancel')}</Button>
          <Button type="submit" form="reset-form" disabled={busy}>{t('Reset password')}</Button>
        </>
      }
    >
      <form id="reset-form" onSubmit={submit} className="space-y-4 text-sm text-slate-600">
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            {t('Open')} <a className="text-brand-700 underline" href="https://console.firebase.google.com/project/patient-tracker-8a04c/authentication/users" target="_blank" rel="noreferrer">Firebase console → Authentication → Users</a>,{' '}
            {t('find')} <code className="rounded bg-slate-100 px-1 text-xs">{user?.email}</code>, {t('open its ⋮ menu and choose')} <b>Delete account</b>.
          </li>
          <li>{t('Enter a new temporary password here and click')} <b>{t('Reset password')}</b>. {t('Their name and role stay the same.')}</li>
        </ol>
        <Field label={t('New temporary password')} hint={t('At least 6 characters. Share it privately.')}>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required />
        </Field>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </form>
    </Modal>
  );
}
