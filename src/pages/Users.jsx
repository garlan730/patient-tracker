import { useState } from 'react';
import { Plus, Pencil, Mail, UserX, UserCheck, Download, Upload, Loader2 } from 'lucide-react';
import { PROGRAMS, ROLES } from '../lib/constants.js';
import { fmtDate } from '../lib/dates.js';
import { useAuth } from '../lib/auth.jsx';
import { useData } from '../lib/data.jsx';
import { Button, Card, Field, Input, Modal, PageHeader, Select, cx, useConfirm } from '../components/ui.jsx';

export default function UsersPage() {
  const { users, user: me, addUser, updateUser, resetPassword } = useAuth();
  const { downloadBackup } = useData();
  const confirm = useConfirm();
  const [modal, setModal] = useState(null); // null | { user?: object }
  const [notice, setNotice] = useState('');

  const tell = (msg) => confirm({ title: 'Notice', message: msg, confirmLabel: 'OK' });

  const toggleActive = async (u) => {
    if (u.active) {
      const ok = await confirm({
        title: 'Deactivate user?',
        message: `${u.name} will be signed out and can no longer sign in. You can reactivate them later.`,
        confirmLabel: 'Deactivate',
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
    try {
      await resetPassword(u.email);
      setNotice(`Password reset email sent to ${u.email}.`);
    } catch (err) {
      await tell(err.message);
    }
  };

  return (
    <div className="max-w-5xl">
      <PageHeader
        title="Users"
        description="Who can sign in and what they can do."
        actions={<Button onClick={() => setModal({})}><Plus size={16} /> Add user</Button>}
      />

      {notice && <p className="mb-4 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">{notice}</p>}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Added</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id} className={u.active ? '' : 'text-slate-400'}>
                  <td className="px-4 py-3 font-medium">
                    <span className={u.active ? 'text-slate-800' : ''}>{u.name}</span>
                    {u.id === me.id && <span className="ml-1 text-xs font-normal text-slate-400">(you)</span>}
                  </td>
                  <td className="px-4 py-3">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={cx('rounded-full px-2 py-0.5 text-xs font-medium', u.role === 'admin' ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-600')}>
                      {ROLES[u.role]?.label || u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs">{u.active ? 'Active' : 'Deactivated'}</td>
                  <td className="px-4 py-3 text-slate-500">{fmtDate(u.createdAt?.slice(0, 10))}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => setModal({ user: u })} aria-label="Edit" title="Edit"><Pencil size={15} /></Button>
                      <Button size="icon" variant="ghost" onClick={() => sendReset(u)} aria-label="Send password reset email" title="Send password reset email"><Mail size={15} /></Button>
                      {u.id !== me.id && (
                        <Button
                          size="icon"
                          variant={u.active ? 'danger-ghost' : 'ghost'}
                          onClick={() => toggleActive(u)}
                          aria-label={u.active ? 'Deactivate' : 'Reactivate'}
                          title={u.active ? 'Deactivate' : 'Reactivate'}
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
        <h2 className="text-sm font-semibold text-slate-900">Role permissions</h2>
        <ul className="mt-2 space-y-1 text-sm text-slate-600">
          {Object.values(ROLES).map((r) => (
            <li key={r.label}><span className="font-medium text-slate-800">{r.label}:</span> {r.description}</li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-slate-500">
          Deactivated users are blocked immediately. To delete a login completely, remove it in the Firebase console under Authentication → Users.
        </p>
      </Card>

      <Card className="mt-6 p-4">
        <h2 className="text-sm font-semibold text-slate-900">Backup</h2>
        <p className="mt-1 text-sm text-slate-600">
          Download all patients, treatment dates, notes, doctors and users as a file. Do this regularly and keep the file somewhere safe —
          it contains patient data.
        </p>
        <Button variant="secondary" size="sm" className="mt-3" onClick={downloadBackup}><Download size={14} /> Download backup</Button>
      </Card>

      <ImportCard />

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
    setForm(editing ? { name: editing.name, email: editing.email, role: editing.role } : { name: '', email: '', role: 'staff', password: '' });
    setError('');
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!editing && form.password.length < 6) return setError('Password must be at least 6 characters.');
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
      title={editing ? 'Edit user' : 'Add user'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="user-form" disabled={busy}>{editing ? 'Save changes' : 'Add user'}</Button>
        </>
      }
    >
      <form id="user-form" onSubmit={submit} className="space-y-4">
        <Field label="Full name"><Input value={form.name || ''} onChange={set('name')} required autoFocus /></Field>
        <Field label="Email" hint={editing ? 'Email can’t be changed here.' : 'They sign in with this email.'}>
          <Input type="email" value={form.email || ''} onChange={set('email')} required disabled={!!editing} autoComplete="off" />
        </Field>
        <Field label="Role" hint={isSelf ? 'You can’t remove the last admin.' : undefined}>
          <Select value={form.role || 'staff'} onChange={set('role')}>
            {Object.entries(ROLES).map(([k, r]) => <option key={k} value={k}>{r.label} — {r.description}</option>)}
          </Select>
        </Field>
        {!editing && (
          <Field label="Temporary password" hint="At least 6 characters. Share it privately; they can change it with “Forgot password?”.">
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
      setStatus({ busy: false, error: err instanceof SyntaxError ? 'Could not read the file (invalid JSON).' : err.message, result: '' });
    }
  };

  const run = async () => {
    setStatus({ busy: true, error: '', result: '' });
    try {
      const { added, skipped } = await importPatients(file.program, file.patients);
      setStatus({ busy: false, error: '', result: `Imported ${added} patient${added === 1 ? '' : 's'}${skipped ? `; skipped ${skipped} already in the tracker` : ''}.` });
      setFile(null);
    } catch (err) {
      setStatus({ busy: false, error: err.message, result: '' });
    }
  };

  const withDate = file?.patients.filter((p) => p.firstDate).length || 0;
  const withNote = file?.patients.filter((p) => p.note).length || 0;

  return (
    <Card className="mt-6 p-4">
      <h2 className="text-sm font-semibold text-slate-900">Import patients</h2>
      <p className="mt-1 text-sm text-slate-600">Add many patients at once from an import file. Patients already in the tracker (same name) are skipped.</p>
      {file ? (
        <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
          <p className="font-medium">{file.name}</p>
          {file.source && <p className="text-xs text-slate-500">{file.source}</p>}
          <ul className="mt-2 list-disc pl-5 text-slate-600">
            <li>{file.patients.length} patients → {PROGRAMS[file.program].label}</li>
            <li>{withDate} with a {PROGRAMS[file.program].steps[0].label} date</li>
            <li>{withNote} with a note</li>
            <li>No doctor assigned — set it later by editing each patient</li>
          </ul>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={run} disabled={status.busy}>
              {status.busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Import {file.patients.length} patients
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setFile(null)} disabled={status.busy}>Cancel</Button>
          </div>
        </div>
      ) : (
        <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50">
          <Upload size={14} /> Choose import file…
          <input type="file" accept=".json,application/json" className="hidden" onChange={pick} />
        </label>
      )}
      {status.error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{status.error}</p>}
      {status.result && <p className="mt-2 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">{status.result}</p>}
    </Card>
  );
}
