import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle, History, Loader2, MessageCircle, Minus, Package, Pencil, Plus, Search, Send, Trash2, X,
} from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';
import {
  REQUEST_STATUS, STOCK_REASONS, isLow, normalizeWhatsapp, requestMessage, useInventory, whatsappUrl,
} from '../lib/inventory.jsx';
import { fmtDateTime } from '../lib/dates.js';
import { Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Textarea, cx, useConfirm } from '../components/ui.jsx';

const CLINIC = 'Klinik Utama Baruga Medical Center';

export default function Inventory() {
  const { loading, error, clearError, lowStock, requests } = useInventory();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'requests' ? 'requests' : 'stock';
  const [requesting, setRequesting] = useState(null); // null | prefilled lines
  const open = requests.filter((r) => r.status === 'requested' || r.status === 'ordered').length;

  return (
    <>
      <PageHeader
        title="Inventory"
        description="Material stock, updates and requests."
        actions={
          <Button onClick={() => setRequesting(lowStock.map((it) => ({ itemId: it.id, qty: Math.max(1, (it.minStock || 0) * 2 - it.stock) })))}>
            <Send size={16} /> Request materials
          </Button>
        }
      />

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={clearError} aria-label="Dismiss" className="text-red-400 hover:text-red-700"><X size={16} /></button>
        </div>
      )}

      <div className="mb-4 flex gap-1 border-b border-slate-200" role="tablist">
        {[
          ['stock', 'Stock', lowStock.length ? `${lowStock.length} low` : null],
          ['requests', 'Requests', open ? `${open} open` : null],
        ].map(([key, label, badge]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setParams(key === 'stock' ? {} : { tab: key }, { replace: true })}
            className={cx(
              '-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
              tab === key ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800'
            )}
          >
            {label}
            {badge && <span className={cx('rounded-full px-2 py-0.5 text-xs', key === 'stock' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700')}>{badge}</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-24 text-sm text-slate-400">
          <Loader2 size={18} className="animate-spin" /> Loading inventory…
        </div>
      ) : tab === 'stock' ? (
        <StockTab onRequest={(lines) => setRequesting(lines)} />
      ) : (
        <RequestsTab />
      )}

      <RequestModal lines={requesting} onClose={() => setRequesting(null)} />
    </>
  );
}

// ---------- Stock ----------

function StockTab({ onRequest }) {
  const { items, deleteItem } = useInventory();
  const { isAdmin } = useAuth();
  const confirm = useConfirm();
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const [editing, setEditing] = useState(null); // null | {} (new) | item
  const [adjusting, setAdjusting] = useState(null);
  const [history, setHistory] = useState(null);

  const categories = useMemo(() => [...new Set(items.map((i) => i.category).filter(Boolean))].sort(), [items]);
  const rows = items
    .filter((i) => !q || `${i.name} ${i.category}`.toLowerCase().includes(q.toLowerCase()))
    .filter((i) => !category || i.category === category)
    .filter((i) => !lowOnly || isLow(i))
    .sort((a, b) => Number(isLow(b)) - Number(isLow(a)) || a.name.localeCompare(b.name));

  const remove = async (item) => {
    if (await confirm({ title: 'Delete item?', message: `${item.name} and its stock history will be removed from the list.`, confirmLabel: 'Delete', danger: true })) {
      deleteItem(item.id);
    }
  };

  return (
    <>
      <Card className="mb-4 p-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input className="pl-9" placeholder="Search materials…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select className="md:w-48" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
            <option value="">All categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
          <label className="flex items-center gap-2 whitespace-nowrap px-1 text-sm text-slate-600">
            <input type="checkbox" className="accent-brand-600" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} />
            Low stock only
          </label>
          {isAdmin && <Button variant="secondary" onClick={() => setEditing({})}><Plus size={16} /> Add item</Button>}
        </div>
      </Card>

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState icon={Package} title={items.length ? 'No items match' : 'No materials yet'}>
            {items.length ? 'Try a different search or filter.' : isAdmin ? 'Add your first item to start tracking stock.' : 'Ask an admin to add the materials list.'}
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Material</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3 text-right">In stock</th>
                  <th className="px-4 py-3 text-right">Minimum</th>
                  <th className="px-4 py-3">Last update</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((it) => {
                  const low = isLow(it);
                  return (
                    <tr key={it.id} className={low ? 'bg-red-50/40' : ''}>
                      <td className="px-4 py-3 font-medium text-slate-800">{it.name}</td>
                      <td className="px-4 py-3 text-slate-600">{it.category || '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={cx('inline-flex items-center gap-1 tabular-nums', low ? 'font-semibold text-red-700' : 'text-slate-800')}>
                          {low && <AlertTriangle size={13} aria-label="Low stock" />}
                          {it.stock} <span className="font-normal text-slate-500">{it.unit}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-500">{it.minStock}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{it.updatedAt ? `${fmtDateTime(it.updatedAt)} · ${it.updatedBy}` : '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="secondary" onClick={() => setAdjusting(it)}>Update stock</Button>
                          {low && <Button size="icon" variant="ghost" title="Request this item" aria-label="Request this item" onClick={() => onRequest([{ itemId: it.id, qty: Math.max(1, it.minStock * 2 - it.stock) }])}><Send size={15} /></Button>}
                          <Button size="icon" variant="ghost" title="Stock history" aria-label="Stock history" onClick={() => setHistory(it)}><History size={15} /></Button>
                          {isAdmin && <Button size="icon" variant="ghost" title="Edit item" aria-label="Edit item" onClick={() => setEditing(it)}><Pencil size={15} /></Button>}
                          {isAdmin && <Button size="icon" variant="danger-ghost" title="Delete item" aria-label="Delete item" onClick={() => remove(it)}><Trash2 size={15} /></Button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {isAdmin && <WhatsappSettings />}

      <ItemModal item={editing} categories={categories} onClose={() => setEditing(null)} />
      <AdjustModal item={adjusting} onClose={() => setAdjusting(null)} />
      <HistoryModal item={history} onClose={() => setHistory(null)} />
    </>
  );
}

function ItemModal({ item, categories, onClose }) {
  const { saveItem, items } = useInventory();
  const isNew = item && !item.id;
  const [form, setForm] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!item) return;
    setForm({ name: item.name || '', category: item.category || '', unit: item.unit || 'pcs', minStock: item.minStock ?? 0, stock: 0 });
    setError('');
  }, [item]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    const dup = items.some((i) => i.id !== item.id && i.name.trim().toLowerCase() === form.name.trim().toLowerCase());
    if (dup) return setError('An item with that name already exists.');
    setBusy(true);
    try {
      await saveItem(item.id, form);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={!!item}
      onClose={onClose}
      title={isNew ? 'Add material' : 'Edit material'}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="item-form" disabled={busy}>{isNew ? 'Add item' : 'Save'}</Button></>}
    >
      <form id="item-form" onSubmit={submit} className="space-y-4">
        <Field label="Name"><Input value={form.name || ''} onChange={set('name')} placeholder="e.g. Implant fixture 4.0 × 10 mm" required autoFocus /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <Input value={form.category || ''} onChange={set('category')} list="inventory-categories" placeholder="e.g. Implant" />
            <datalist id="inventory-categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
          </Field>
          <Field label="Unit"><Input value={form.unit || ''} onChange={set('unit')} placeholder="pcs, box, ml…" required /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Minimum stock" hint="At or below this, it's flagged as low.">
            <Input type="number" min="0" value={form.minStock} onChange={set('minStock')} required />
          </Field>
          {isNew && (
            <Field label="Current stock"><Input type="number" min="0" value={form.stock} onChange={set('stock')} required /></Field>
          )}
        </div>
        {!isNew && <p className="text-xs text-slate-500">To change the stock amount, use <b>Update stock</b> so it's recorded in the history.</p>}
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </form>
    </Modal>
  );
}

function AdjustModal({ item, onClose }) {
  const { adjustStock, items } = useInventory();
  const live = item && (items.find((i) => i.id === item.id) || item);
  const [reason, setReason] = useState('used');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!item) return;
    setReason('used');
    setAmount('');
    setNote('');
    setError('');
  }, [item]);

  if (!live) return null;
  const qty = Math.abs(Number(amount) || 0);
  const after = reason === 'correction' ? qty : live.stock + STOCK_REASONS[reason].sign * qty;

  const submit = async (e) => {
    e.preventDefault();
    if (amount === '' || (reason !== 'correction' && qty === 0)) return setError('Enter an amount.');
    setBusy(true);
    try {
      await adjustStock(live.id, reason, qty, note);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Update stock · ${live.name}`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="adjust-form" disabled={busy || after < 0}>Save</Button></>}
    >
      <form id="adjust-form" onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Type of change">
          {[
            ['used', 'Used', Minus],
            ['received', 'Received', Plus],
            ['correction', 'Set count', Pencil],
          ].map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={reason === key}
              onClick={() => setReason(key)}
              className={cx(
                'flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-sm font-medium',
                reason === key ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              )}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
        <Field label={reason === 'correction' ? `Counted stock (${live.unit})` : `Amount (${live.unit})`}>
          <Input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required autoFocus />
        </Field>
        <p className={cx('rounded-lg px-3 py-2 text-sm', after < 0 ? 'bg-red-50 text-red-700' : 'bg-slate-50 text-slate-600')}>
          {live.stock} {live.unit} → <b>{after} {live.unit}</b>
          {after < 0 && ' — not enough stock'}
        </p>
        <Field label="Note" hint="Optional — e.g. patient name, supplier, invoice number.">
          <Input value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </form>
    </Modal>
  );
}

function HistoryModal({ item, onClose }) {
  const { loadHistory } = useInventory();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!item) return;
    setRows(null);
    setError('');
    loadHistory(item.id).then(setRows, (err) => setError(err.message));
  }, [item, loadHistory]);

  return (
    <Modal open={!!item} onClose={onClose} title={`Stock history · ${item?.name}`}>
      {error ? (
        <p className="text-sm text-red-700">{error}</p>
      ) : !rows ? (
        <p className="flex items-center gap-2 text-sm text-slate-400"><Loader2 size={14} className="animate-spin" /> Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-400">No changes recorded yet.</p>
      ) : (
        <ul className="max-h-[60vh] divide-y divide-slate-100 overflow-y-auto">
          {rows.map((h) => (
            <li key={h.id} className="flex items-start justify-between gap-3 py-2.5 text-sm">
              <div className="min-w-0">
                <p className="text-slate-800">{STOCK_REASONS[h.reason]?.label || h.reason}{h.note && <span className="text-slate-500"> · {h.note}</span>}</p>
                <p className="text-xs text-slate-400">{fmtDateTime(h.at)} · {h.by}</p>
              </div>
              <div className="shrink-0 text-right tabular-nums">
                <p className={cx('font-medium', h.change > 0 ? 'text-brand-700' : h.change < 0 ? 'text-red-700' : 'text-slate-500')}>
                  {h.change > 0 ? '+' : ''}{h.change}
                </p>
                <p className="text-xs text-slate-400">→ {h.stockAfter} {item.unit}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

function WhatsappSettings() {
  const { settings, saveSettings } = useInventory();
  const [number, setNumber] = useState('');
  const [saved, setSaved] = useState('');

  useEffect(() => setNumber(settings.whatsappNumber || ''), [settings.whatsappNumber]);

  const submit = async (e) => {
    e.preventDefault();
    const normalized = normalizeWhatsapp(number);
    await saveSettings({ whatsappNumber: normalized });
    setSaved(normalized ? `Saved. Requests go to +${normalized}.` : 'Cleared.');
  };

  return (
    <Card className="mt-6 p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><MessageCircle size={16} /> WhatsApp for material requests</h2>
      <p className="mt-1 text-sm text-slate-600">The number requests are sent to (e.g. purchasing or the supplier). Admins only.</p>
      <form onSubmit={submit} className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Input type="tel" value={number} onChange={(e) => { setNumber(e.target.value); setSaved(''); }} placeholder="e.g. 0812-3456-7890" className="sm:w-64" />
        <Button type="submit" variant="secondary">Save number</Button>
      </form>
      {saved && <p className="mt-2 text-sm text-brand-700">{saved}</p>}
    </Card>
  );
}

// ---------- Requests ----------

function RequestModal({ lines, onClose }) {
  const { items, settings, createRequest } = useInventory();
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState([]);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!lines) return;
    setRows(lines.length ? lines.map((l) => ({ ...l, qty: String(l.qty) })) : [{ itemId: '', qty: '1' }]);
    setNote('');
    setError('');
  }, [lines]);

  const update = (i, changes) => setRows((r) => r.map((row, j) => (j === i ? { ...row, ...changes } : row)));
  const number = settings.whatsappNumber;

  const submit = (e) => {
    e.preventDefault();
    const filled = rows.filter((r) => r.itemId && Number(r.qty) > 0);
    if (!filled.length) return setError('Add at least one material with a quantity.');
    if (!number) return setError(isAdmin ? 'Set the WhatsApp number at the bottom of the Stock tab first.' : 'No WhatsApp number is set yet. Ask an admin to add it.');
    const withNames = filled.map((r) => {
      const it = items.find((x) => x.id === r.itemId);
      return { ...r, name: it.name, unit: it.unit };
    });
    const { req, saved } = createRequest(withNames, note);
    // Open WhatsApp straight from the click so the browser doesn't block it as a pop-up.
    window.open(whatsappUrl(number, requestMessage(req, CLINIC)), '_blank', 'noopener');
    saved.catch((err) => setError(`Request not saved: ${err.message}`));
    onClose();
  };

  return (
    <Modal
      open={!!lines}
      onClose={onClose}
      title="Request materials"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="request-form"><Send size={14} /> Send on WhatsApp</Button></>}
    >
      <form id="request-form" onSubmit={submit} className="space-y-3">
        {rows.map((row, i) => {
          const it = items.find((x) => x.id === row.itemId);
          return (
            <div key={i} className="flex items-end gap-2">
              <Field label={i === 0 ? 'Material' : ''}>
                <Select value={row.itemId} onChange={(e) => update(i, { itemId: e.target.value })}>
                  <option value="">Choose…</option>
                  {items.map((x) => (
                    <option key={x.id} value={x.id}>{x.name} ({x.stock} {x.unit}{isLow(x) ? ', low' : ''})</option>
                  ))}
                </Select>
              </Field>
              <div className="w-24 shrink-0">
                <Field label={i === 0 ? 'Qty' : ''}>
                  <Input type="number" min="1" value={row.qty} onChange={(e) => update(i, { qty: e.target.value })} aria-label={it ? `Quantity in ${it.unit}` : 'Quantity'} />
                </Field>
              </div>
              <Button size="icon" variant="ghost" aria-label="Remove line" onClick={() => setRows((r) => r.filter((_, j) => j !== i))} disabled={rows.length === 1}>
                <X size={16} />
              </Button>
            </div>
          );
        })}
        <Button size="sm" variant="ghost" onClick={() => setRows((r) => [...r, { itemId: '', qty: '1' }])}><Plus size={14} /> Add line</Button>
        <Field label="Note" hint="Optional — e.g. urgent, needed by Friday.">
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <p className="text-xs text-slate-500">
          {number ? <>WhatsApp opens with the request filled in for <b>+{number}</b>; tap <b>Send</b> there.</> : 'No WhatsApp number set yet.'}
        </p>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </form>
    </Modal>
  );
}

function RequestsTab() {
  const { requests, settings, setRequestStatus } = useInventory();
  const confirm = useConfirm();
  const [status, setStatus] = useState('open');
  const [busyId, setBusyId] = useState(null);

  const rows = requests.filter((r) => status === 'all' || (status === 'open' ? ['requested', 'ordered'].includes(r.status) : r.status === status));

  const change = async (req, next) => {
    if (next === 'received') {
      const ok = await confirm({
        title: 'Mark as received?',
        message: `This adds ${req.items.map((i) => `${i.qty} ${i.unit} ${i.name}`).join(', ')} to stock.`,
        confirmLabel: 'Mark received',
      });
      if (!ok) return;
    }
    if (next === 'cancelled' && !(await confirm({ title: 'Cancel request?', message: `${req.number} will be marked as cancelled.`, confirmLabel: 'Cancel request', danger: true }))) return;
    setBusyId(req.id);
    try {
      await setRequestStatus(req, next);
    } catch (err) {
      await confirm({ title: 'Could not update', message: err.message, confirmLabel: 'OK' });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        {[['open', 'Open'], ['received', 'Received'], ['cancelled', 'Cancelled'], ['all', 'All']].map(([k, label]) => (
          <button
            key={k}
            onClick={() => setStatus(k)}
            className={cx('rounded-full px-3 py-1 text-sm', status === k ? 'bg-brand-700 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50')}
          >
            {label}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <Card><EmptyState icon={Send} title="No requests here">Use “Request materials” to send one on WhatsApp.</EmptyState></Card>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <Card key={r.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-900">
                    {r.number}
                    <span className={cx('ml-2 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', REQUEST_STATUS[r.status].className)}>{REQUEST_STATUS[r.status].label}</span>
                  </p>
                  <p className="text-xs text-slate-500">
                    {fmtDateTime(r.createdAt)} · {r.requestedBy}
                    {r.orderedAt && ` · ordered ${fmtDateTime(r.orderedAt)}`}
                    {r.receivedAt && ` · received ${fmtDateTime(r.receivedAt)} by ${r.receivedBy}`}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {settings.whatsappNumber && r.status !== 'cancelled' && (
                    <Button size="sm" variant="ghost" onClick={() => window.open(whatsappUrl(settings.whatsappNumber, requestMessage(r, CLINIC)), '_blank', 'noopener')}>
                      <MessageCircle size={14} /> Resend
                    </Button>
                  )}
                  {r.status === 'requested' && <Button size="sm" variant="secondary" disabled={busyId === r.id} onClick={() => change(r, 'ordered')}>Mark ordered</Button>}
                  {['requested', 'ordered'].includes(r.status) && <Button size="sm" disabled={busyId === r.id} onClick={() => change(r, 'received')}>Mark received</Button>}
                  {['requested', 'ordered'].includes(r.status) && (
                    <Button size="sm" variant="danger-ghost" disabled={busyId === r.id} onClick={() => change(r, 'cancelled')}>Cancel</Button>
                  )}
                </div>
              </div>
              <ul className="mt-3 space-y-1 text-sm text-slate-700">
                {r.items.map((it, i) => <li key={i}>• {it.name} — <b>{it.qty}</b> {it.unit}</li>)}
              </ul>
              {r.note && <p className="mt-2 text-sm text-slate-500">Note: {r.note}</p>}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
