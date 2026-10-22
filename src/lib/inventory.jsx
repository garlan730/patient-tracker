import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { format } from 'date-fns';
import { db, friendlyError } from './firebase.js';
import { useAuth } from './auth.jsx';

// Firestore layout:
//   inventory/{id}                  { name, category, unit, stock, minStock, updatedAt, updatedBy }
//   inventory/{id}/history/{id}     { change, stockAfter, reason, note, by, byId, at }
//   inventoryRequests/{id}          { number, items: [{ itemId, name, unit, qty }], note, status,
//                                     requestedBy, requestedById, createdAt, updatedAt, ... }
//   settings/inventory              { whatsappNumber }

export const STOCK_REASONS = {
  used: { label: 'Used', sign: -1 },
  received: { label: 'Received', sign: 1 },
  correction: { label: 'Stock count correction', sign: 0 },
};

export const REQUEST_STATUS = {
  requested: { label: 'Requested', className: 'bg-amber-50 text-amber-700 ring-amber-200' },
  ordered: { label: 'Ordered', className: 'bg-sky-50 text-sky-700 ring-sky-200' },
  received: { label: 'Received', className: 'bg-brand-50 text-brand-700 ring-brand-200' },
  cancelled: { label: 'Cancelled', className: 'bg-slate-100 text-slate-500 ring-slate-200' },
};

export const isLow = (item) => item.stock <= (item.minStock || 0);

// "0812-3456-7890", "+62 812…" and "812…" all become "6281234567890" for wa.me links.
export function normalizeWhatsapp(input = '') {
  let digits = input.replace(/\D/g, '');
  if (digits.startsWith('0')) digits = '62' + digits.slice(1);
  else if (digits.startsWith('8')) digits = '62' + digits;
  return digits;
}

export function requestMessage(req, clinicName) {
  const lines = [
    `*Material Request ${req.number}*`,
    clinicName,
    `Date: ${format(new Date(req.createdAt), 'dd MMM yyyy, HH:mm')}`,
    `Requested by: ${req.requestedBy}`,
    '',
    ...req.items.map((it, i) => `${i + 1}. ${it.name} — ${it.qty} ${it.unit}`),
  ];
  if (req.note) lines.push('', `Note: ${req.note}`);
  return lines.join('\n');
}

export const whatsappUrl = (number, text) => `https://wa.me/${number}?text=${encodeURIComponent(text)}`;

const InventoryContext = createContext(null);
const NONE = { items: false, requests: false, settings: false };

export function InventoryProvider({ children }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [requests, setRequests] = useState([]);
  const [settings, setSettings] = useState({});
  const [loaded, setLoaded] = useState(NONE);
  const [error, setError] = useState('');

  const userId = user?.id;
  useEffect(() => {
    setItems([]);
    setRequests([]);
    setSettings({});
    setLoaded(NONE);
    if (!userId) return;
    const done = (key) => setLoaded((l) => (l[key] ? l : { ...l, [key]: true }));
    const fail = (err) => setError(friendlyError(err));
    const unsubs = [
      onSnapshot(collection(db, 'inventory'), (snap) => {
        setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.name.localeCompare(b.name)));
        done('items');
      }, fail),
      onSnapshot(query(collection(db, 'inventoryRequests'), orderBy('createdAt', 'desc'), limit(200)), (snap) => {
        setRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        done('requests');
      }, fail),
      onSnapshot(doc(db, 'settings', 'inventory'), (snap) => {
        setSettings(snap.exists() ? snap.data() : {});
        done('settings');
      }, fail),
    ];
    return () => unsubs.forEach((u) => u());
  }, [userId]);

  const wrap = useCallback(async (fn) => {
    try {
      return await fn();
    } catch (err) {
      throw new Error(err.message && !err.code ? err.message : friendlyError(err));
    }
  }, []);

  const saveItem = useCallback((id, data) => wrap(async () => {
    const fields = {
      name: data.name.trim(),
      category: data.category?.trim() || '',
      unit: data.unit?.trim() || 'pcs',
      minStock: Number(data.minStock) || 0,
    };
    if (id) {
      await updateDoc(doc(db, 'inventory', id), fields);
    } else {
      // New items start at their initial stock, recorded as the first history entry.
      const ref = doc(collection(db, 'inventory'));
      const stock = Math.max(0, Number(data.stock) || 0);
      const at = new Date().toISOString();
      await runTransaction(db, async (tx) => {
        tx.set(ref, { ...fields, stock, updatedAt: at, updatedBy: user.name });
        tx.set(doc(collection(db, 'inventory', ref.id, 'history')), {
          change: stock, stockAfter: stock, reason: 'correction', note: 'Initial stock', by: user.name, byId: user.id, at,
        });
      });
    }
  }), [wrap, user]);

  const deleteItem = useCallback((id) => wrap(() => deleteDoc(doc(db, 'inventory', id))), [wrap]);

  // reason "correction" sets the stock to `amount`; "used"/"received" subtract/add it.
  const adjustStock = useCallback((id, reason, amount, note = '') => wrap(() =>
    runTransaction(db, async (tx) => {
      const ref = doc(db, 'inventory', id);
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error('This item no longer exists.');
      const before = snap.data().stock || 0;
      const qty = Math.abs(Number(amount) || 0);
      const after = reason === 'correction' ? qty : before + STOCK_REASONS[reason].sign * qty;
      if (after < 0) throw new Error(`Only ${before} in stock — can't use ${qty}.`);
      const at = new Date().toISOString();
      tx.update(ref, { stock: after, updatedAt: at, updatedBy: user.name });
      tx.set(doc(collection(db, 'inventory', id, 'history')), {
        change: after - before, stockAfter: after, reason, note: note.trim(), by: user.name, byId: user.id, at,
      });
    })
  ), [wrap, user]);

  const loadHistory = useCallback((id) => wrap(async () => {
    const snap = await getDocs(query(collection(db, 'inventory', id, 'history'), orderBy('at', 'desc'), limit(100)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }), [wrap]);

  // Saves the request and returns it (with a short number) so the caller can open WhatsApp.
  const createRequest = useCallback((lines, note) => {
    const ref = doc(collection(db, 'inventoryRequests'));
    const now = new Date().toISOString();
    const req = {
      number: `REQ-${format(new Date(), 'yyMMdd')}-${ref.id.slice(0, 4).toUpperCase()}`,
      items: lines.map((l) => ({ itemId: l.itemId, name: l.name, unit: l.unit, qty: Number(l.qty) })),
      note: note.trim(),
      status: 'requested',
      requestedBy: user.name,
      requestedById: user.id,
      createdAt: now,
      updatedAt: now,
    };
    const saved = wrap(() => setDoc(ref, req));
    return { req: { id: ref.id, ...req }, saved };
  }, [wrap, user]);

  const setRequestStatus = useCallback((req, status) => wrap(() =>
    runTransaction(db, async (tx) => {
      const ref = doc(db, 'inventoryRequests', req.id);
      const snap = await tx.get(ref);
      if (snap.data()?.status === 'received') throw new Error('This request was already received.');
      const at = new Date().toISOString();
      const changes = { status, updatedAt: at, [`${status}At`]: at, [`${status}By`]: user.name };
      if (status === 'received') {
        // Receiving adds every requested quantity to stock, with a history entry per item.
        const itemRefs = req.items.map((it) => doc(db, 'inventory', it.itemId));
        const itemSnaps = await Promise.all(itemRefs.map((r) => tx.get(r)));
        itemSnaps.forEach((s, i) => {
          if (!s.exists()) return;
          const qty = req.items[i].qty;
          const after = (s.data().stock || 0) + qty;
          tx.update(itemRefs[i], { stock: after, updatedAt: at, updatedBy: user.name });
          tx.set(doc(collection(db, 'inventory', s.id, 'history')), {
            change: qty, stockAfter: after, reason: 'received', note: `Request ${req.number}`, by: user.name, byId: user.id, at,
          });
        });
      }
      tx.update(ref, changes);
    })
  ), [wrap, user]);

  const saveSettings = useCallback((changes) => wrap(() => setDoc(doc(db, 'settings', 'inventory'), changes, { merge: true })), [wrap]);

  const lowStock = useMemo(() => items.filter(isLow), [items]);

  const value = {
    loading: !(loaded.items && loaded.requests && loaded.settings),
    error,
    clearError: () => setError(''),
    items,
    lowStock,
    requests,
    settings,
    saveItem,
    deleteItem,
    adjustStock,
    loadHistory,
    createRequest,
    setRequestStatus,
    saveSettings,
  };

  return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>;
}

export const useInventory = () => useContext(InventoryContext);
