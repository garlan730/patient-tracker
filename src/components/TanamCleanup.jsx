import { useMemo, useState } from 'react';
import { AlertTriangle, Archive, Loader2, Upload } from 'lucide-react';
import { programOf } from '../lib/constants.js';
import { useData } from '../lib/data.jsx';
import { namesMatch } from '../lib/matchNames.js';
import { t } from '../lib/i18n.jsx';
import { Button, Card, Modal, cx } from './ui.jsx';

// Admin tool: archive active Tanam patients who aren't on the upgraded-patient list
// ({ format: 'tanam-keep-list', patients: [{ name }] }). Names are matched loosely, so the result is
// shown for review with a tick box per patient before anything is archived. Archiving can be undone.
export default function TanamCleanup() {
  const { patients, setArchived } = useData();
  const [list, setList] = useState(null); // { fileName, names }
  const [keep, setKeep] = useState({}); // patientId -> true to keep
  const [status, setStatus] = useState({ busy: false, error: '', result: '' });

  const active = useMemo(
    () => patients.filter((p) => programOf(p) === 'tanam' && !p.archived).sort((a, b) => a.name.localeCompare(b.name)),
    [patients]
  );

  // For each patient: which list names match it. For each list name: how many patients it matches.
  const review = useMemo(() => {
    if (!list) return null;
    const rows = active.map((p) => ({ p, hits: list.names.filter((n) => namesMatch(n, p.name)) }));
    const perName = Object.fromEntries(list.names.map((n) => [n, rows.filter((r) => r.hits.includes(n)).length]));
    return { rows, notFound: list.names.filter((n) => !perName[n]), shared: new Set(list.names.filter((n) => perName[n] > 1)) };
  }, [list, active]);

  const pick = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    setStatus({ busy: false, error: '', result: '' });
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (data.format !== 'tanam-keep-list' || !Array.isArray(data.patients)) throw new Error(t('This is not an upgraded-patient list file.'));
      const names = data.patients.map((p) => p.name?.trim()).filter(Boolean);
      const initial = {};
      active.forEach((p) => { initial[p.id] = names.some((n) => namesMatch(n, p.name)); });
      setKeep(initial);
      setList({ fileName: f.name, names });
    } catch (err) {
      setStatus({ busy: false, error: err instanceof SyntaxError ? t('Could not read the file (invalid JSON).') : err.message, result: '' });
    }
  };

  const toArchive = review ? review.rows.filter((r) => !keep[r.p.id]).map((r) => r.p) : [];

  const run = async () => {
    setStatus({ busy: true, error: '', result: '' });
    try {
      await setArchived(toArchive.map((p) => p.id), true);
      setStatus({ busy: false, error: '', result: t('{n} Tanam patient(s) archived. Find them under Filter → Show → Archived patients.', { n: toArchive.length }) });
      setList(null);
    } catch (err) {
      setStatus({ busy: false, error: err.message, result: '' });
    }
  };

  return (
    <Card className="mt-6 p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Archive size={16} /> {t('Tidy up Tanam patients')}</h2>
      <p className="mt-1 text-sm text-slate-600">
        {t('Archive Tanam patients who are not on the upgraded-patient list. You review the result before anything changes, and archived patients can be restored.')}
      </p>
      <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50">
        <Upload size={14} /> {t('Choose upgraded-patient list…')}
        <input type="file" accept=".json,application/json" className="hidden" onChange={pick} />
      </label>
      {status.error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{status.error}</p>}
      {status.result && <p className="mt-2 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">{status.result}</p>}

      <Modal
        open={!!review}
        onClose={() => setList(null)}
        size="lg"
        title={t('Review Tanam patients')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setList(null)} disabled={status.busy}>{t('Cancel')}</Button>
            <Button variant="danger" onClick={run} disabled={status.busy || !toArchive.length}>
              {status.busy ? <Loader2 size={14} className="animate-spin" /> : <Archive size={14} />} {t('Archive {n} patients', { n: toArchive.length })}
            </Button>
          </>
        }
      >
        {review && (
          <div className="space-y-4 text-sm">
            <p className="text-slate-600">
              {t('{keep} of {total} active Tanam patients match a name on the list ({file}). Untick anyone who should be archived, tick anyone who should stay.', {
                keep: review.rows.length - toArchive.length, total: review.rows.length, file: list.fileName,
              })}
            </p>
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {review.rows.map(({ p, hits }) => {
                const shared = hits.some((h) => review.shared.has(h));
                return (
                  <li key={p.id}>
                    <label className={cx('flex cursor-pointer items-start gap-3 px-3 py-2', !keep[p.id] && 'bg-red-50/50')}>
                      <input
                        type="checkbox"
                        className="mt-1 accent-brand-600"
                        checked={!!keep[p.id]}
                        onChange={(e) => setKeep((k) => ({ ...k, [p.id]: e.target.checked }))}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="font-medium text-slate-800">{p.name}</span>
                        <span className="block text-xs text-slate-500">
                          {hits.length ? t('Matches list name: {names}', { names: hits.join(', ') }) : t('Not on the list')}
                        </span>
                        {shared && (
                          <span className="mt-0.5 flex items-center gap-1 text-xs text-amber-700">
                            <AlertTriangle size={12} /> {t('This list name matches more than one patient — check which one upgraded.')}
                          </span>
                        )}
                      </span>
                      <span className={cx('shrink-0 text-xs font-medium', keep[p.id] ? 'text-brand-700' : 'text-red-600')}>
                        {keep[p.id] ? t('Stays') : t('Archive')}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
            {review.notFound.length > 0 && (
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="font-medium text-slate-700">{t('On the list but not found in the tracker ({n})', { n: review.notFound.length })}</p>
                <p className="mt-1 text-xs text-slate-500">{t('They may be spelled differently or not added yet. Nothing happens to them.')}</p>
                <p className="mt-2 text-slate-600">{review.notFound.join(', ')}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </Card>
  );
}
