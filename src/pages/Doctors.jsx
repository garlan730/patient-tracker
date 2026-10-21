import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil, Trash2, Check, X, Stethoscope } from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';
import { useData } from '../lib/data.jsx';
import { Button, Card, EmptyState, Input, PageHeader, Textarea, useConfirm } from '../components/ui.jsx';

// "Sp. Pros" and "Sp.Pros" count as the same name.
const normalize = (n) => n.toLowerCase().replace(/\s+/g, '');

export default function Doctors() {
  const { doctors, patients, addDoctor, updateDoctor, removeDoctor } = useData();
  const { isAdmin } = useAuth();
  const confirm = useConfirm();
  const [name, setName] = useState('');
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [bulk, setBulk] = useState(null); // null = single-name mode, string = pasted list
  const [info, setInfo] = useState('');

  const countFor = (id) => patients.filter((p) => p.doctorId === id && !p.archived).length;
  const exists = (n, exceptId) => doctors.some((d) => d.id !== exceptId && normalize(d.name) === normalize(n));

  const handleAdd = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (exists(name)) return setError('A doctor with that name already exists.');
    addDoctor(name);
    setName('');
    setError('');
  };

  // One name per line; skips blanks, names already in the list, and repeats within the paste.
  const handleBulkAdd = (e) => {
    e.preventDefault();
    const seen = new Set(doctors.map((d) => normalize(d.name)));
    const toAdd = [];
    let skipped = 0;
    for (const line of bulk.split('\n')) {
      const n = line.trim();
      if (!n) continue;
      if (seen.has(normalize(n))) { skipped++; continue; }
      seen.add(normalize(n));
      toAdd.push(n);
    }
    toAdd.forEach((n) => addDoctor(n));
    setInfo(`Added ${toAdd.length} doctor${toAdd.length === 1 ? '' : 's'}${skipped ? `, skipped ${skipped} already in the list` : ''}.`);
    setBulk(null);
  };

  const saveEdit = () => {
    if (!editing.name.trim() || exists(editing.name, editing.id)) return;
    updateDoctor(editing.id, editing.name);
    setEditing(null);
  };

  const handleRemove = async (d) => {
    const assigned = patients.filter((p) => p.doctorId === d.id).length;
    if (assigned) {
      await confirm({
        title: 'Doctor has patients',
        message: `${d.name} is assigned to ${assigned} patient(s). Reassign them before removing this doctor.`,
        confirmLabel: 'OK',
      });
      return;
    }
    if (await confirm({ title: 'Remove doctor?', message: `Remove ${d.name} from the list?`, confirmLabel: 'Remove', danger: true })) {
      removeDoctor(d.id);
    }
  };

  return (
    <div className="max-w-3xl">
      <PageHeader title="Doctors" description={isAdmin ? 'Manage the doctors patients can be assigned to.' : 'Only admins can change this list.'} />

      {isAdmin && (
        <Card className="mb-4 p-4">
          {bulk === null ? (
            <form onSubmit={handleAdd} className="flex flex-col gap-2 sm:flex-row">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. drg. Tegar Wijaya, Sp.KG" />
              <Button type="submit" disabled={!name.trim()} className="shrink-0"><Plus size={16} /> Add doctor</Button>
            </form>
          ) : (
            <form onSubmit={handleBulkAdd} className="space-y-2">
              <Textarea rows={8} value={bulk} onChange={(e) => setBulk(e.target.value)} placeholder={'One doctor per line, e.g.\ndrg. Tegar Wijaya, Sp.KG\ndrg. Sinta Rahayu, Sp.Pros'} autoFocus />
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setBulk(null)}>Cancel</Button>
                <Button type="submit" disabled={!bulk.trim()}><Plus size={16} /> Add all</Button>
              </div>
            </form>
          )}
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          {info && <p className="mt-2 text-sm text-brand-700">{info}</p>}
          {bulk === null && (
            <button type="button" onClick={() => { setBulk(''); setInfo(''); setError(''); }} className="mt-2 text-sm text-slate-500 hover:text-brand-700">
              Add several at once…
            </button>
          )}
        </Card>
      )}

      <Card>
        {doctors.length === 0 ? (
          <EmptyState icon={Stethoscope} title="No doctors yet" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {doctors.map((d) => (
              <li key={d.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                  <Stethoscope size={16} />
                </div>
                {editing?.id === d.id ? (
                  <>
                    <Input
                      value={editing.name}
                      onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(null); }}
                      autoFocus
                    />
                    <Button size="icon" variant="ghost" onClick={saveEdit} aria-label="Save"><Check size={16} /></Button>
                    <Button size="icon" variant="ghost" onClick={() => setEditing(null)} aria-label="Cancel"><X size={16} /></Button>
                  </>
                ) : (
                  <>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">{d.name}</p>
                      <Link to={`/tracker?doctor=${d.id}`} className="text-xs text-slate-500 hover:text-brand-700 hover:underline">
                        {countFor(d.id)} active patient{countFor(d.id) === 1 ? '' : 's'}
                      </Link>
                    </div>
                    {isAdmin && (
                      <>
                        <Button size="icon" variant="ghost" onClick={() => setEditing({ id: d.id, name: d.name })} aria-label="Edit"><Pencil size={15} /></Button>
                        <Button size="icon" variant="danger-ghost" onClick={() => handleRemove(d)} aria-label="Remove"><Trash2 size={15} /></Button>
                      </>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
