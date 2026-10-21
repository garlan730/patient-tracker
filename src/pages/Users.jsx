import { useState } from 'react';
import { Plus, Pencil, Trash2, RotateCcw } from 'lucide-react';
import { ROLES } from '../lib/constants.js';
import { fmtDate } from '../lib/dates.js';
import { useAuth } from '../lib/auth.jsx';
import { useData } from '../lib/data.jsx';
import { Button, Card, Field, Input, Modal, PageHeader, Select, useConfirm } from '../components/ui.jsx';

export default function UsersPage() {
  const { users, user: me, addUser, updateUser, deleteUser } = useAuth();
  const { resetDemoData } = useData();
  const confirm = useConfirm();
  const [modal, setModal] = useState(null); // null | { user?: object }

  const handleDelete = async (u) => {
    if (!(await confirm({ title: 'Delete user?', message: `${u.name} (${u.username}) will no longer be able to sign in.`, confirmLabel: 'Delete', danger: true }))) return;
    try {
      deleteUser(u.id);
    } catch (err) {
      await confirm({ title: 'Cannot delete', message: err.message, confirmLabel: 'OK' });
    }
  };

  const handleReset = async () => {
    if (await confirm({
      title: 'Reset demo data?',
      message: 'All patients, dates, notes and doctors will be replaced with the original demo data. User accounts are kept.',
      confirmLabel: 'Reset',
      danger: true,
    })) resetDemoData();
  };

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Users"
        description="Who can sign in and what they can do."
        actions={<Button onClick={() => setModal({})}><Plus size={16} /> Add user</Button>}
      />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Username</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {u.name} {u.id === me.id && <span className="ml-1 text-xs font-normal text-slate-400">(you)</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{u.username}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${u.role === 'admin' ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-600'}`}>
                      {ROLES[u.role].label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{fmtDate(u.createdAt?.slice(0, 10))}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => setModal({ user: u })} aria-label="Edit"><Pencil size={15} /></Button>
                      {u.id !== me.id && (
                        <Button size="icon" variant="danger-ghost" onClick={() => handleDelete(u)} aria-label="Delete"><Trash2 size={15} /></Button>
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
        <div className="mt-4 border-t border-slate-100 pt-4">
          <Button variant="danger-ghost" size="sm" onClick={handleReset}><RotateCcw size={14} /> Reset demo data</Button>
        </div>
      </Card>

      <UserModal
        state={modal}
        onClose={() => setModal(null)}
        onSave={async (data) => (modal?.user ? updateUser(modal.user.id, data) : addUser(data))}
      />
    </div>
  );
}

function UserModal({ state, onClose, onSave }) {
  const editing = state?.user;
  const [form, setForm] = useState({});
  const [error, setError] = useState('');
  const [lastState, setLastState] = useState(null);

  if (state !== lastState) {
    setLastState(state);
    setForm(editing ? { name: editing.name, username: editing.username, role: editing.role, password: '' } : { name: '', username: '', role: 'staff', password: '' });
    setError('');
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!editing && form.password.length < 6) return setError('Password must be at least 6 characters.');
    if (editing && form.password && form.password.length < 6) return setError('Password must be at least 6 characters.');
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      setError(err.message);
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
          <Button type="submit" form="user-form">{editing ? 'Save changes' : 'Add user'}</Button>
        </>
      }
    >
      <form id="user-form" onSubmit={submit} className="space-y-4">
        <Field label="Full name"><Input value={form.name || ''} onChange={set('name')} required autoFocus /></Field>
        <Field label="Username">
          <Input value={form.username || ''} onChange={set('username')} required disabled={!!editing} autoComplete="off" />
        </Field>
        <Field label="Role">
          <Select value={form.role || 'staff'} onChange={set('role')}>
            {Object.entries(ROLES).map(([k, r]) => <option key={k} value={k}>{r.label} — {r.description}</option>)}
          </Select>
        </Field>
        <Field label={editing ? 'New password' : 'Password'} hint={editing ? 'Leave blank to keep the current password.' : 'At least 6 characters.'}>
          <Input type="password" value={form.password || ''} onChange={set('password')} autoComplete="new-password" required={!editing} />
        </Field>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </form>
    </Modal>
  );
}
