import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, Table2, Stethoscope, Users, LogOut, KeyRound, Menu, Loader2, AlertTriangle, X } from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';
import { useData } from '../lib/data.jsx';
import { ROLES } from '../lib/constants.js';
import { cx } from './ui.jsx';
import logo from '../assets/logo.png';
import ChangePasswordModal from './ChangePasswordModal.jsx';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/tracker', label: 'Patient Tracker', icon: Table2 },
  { to: '/doctors', label: 'Doctors', icon: Stethoscope },
  { to: '/users', label: 'Users', icon: Users, adminOnly: true },
];

export default function Layout() {
  const { user, isAdmin, logout } = useAuth();
  const { loading, error, clearError } = useData();
  const [open, setOpen] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white p-1.5">
          <img src={logo} alt="" className="h-full w-full object-contain" />
        </div>
        <div className="leading-tight">
          <p className="text-[11px] uppercase tracking-wide text-brand-200">Klinik Utama</p>
          <p className="text-sm font-semibold text-white">Baruga Medical Center</p>
          <p className="text-xs text-brand-200">Patient Tracker</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-2">
        {NAV.filter((n) => !n.adminOnly || isAdmin).map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              cx(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive ? 'bg-white/10 text-white' : 'text-brand-100/80 hover:bg-white/5 hover:text-white'
              )
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-white/10 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-700 text-sm font-semibold text-white">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{user.name}</p>
            <p className="text-xs text-brand-200">{ROLES[user.role].label}</p>
          </div>
          <button
            onClick={() => { setOpen(false); setChangingPassword(true); }}
            className="rounded-lg p-2 text-brand-100/80 hover:bg-white/10 hover:text-white"
            title="Change password"
            aria-label="Change password"
          >
            <KeyRound size={18} />
          </button>
          <button
            onClick={logout}
            className="rounded-lg p-2 text-brand-100/80 hover:bg-white/10 hover:text-white"
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 bg-brand-900 lg:block">{sidebar}</aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-brand-900">{sidebar}</aside>
        </div>
      )}

      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
          <button onClick={() => setOpen(true)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100" aria-label="Open menu">
            <Menu size={20} />
          </button>
          <img src={logo} alt="" className="h-6 w-6 object-contain" />
          <span className="truncate text-sm font-semibold text-slate-800">Klinik Utama Baruga Medical Center</span>
        </header>
        <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span className="flex-1">{error}</span>
              <button onClick={clearError} aria-label="Dismiss" className="text-red-400 hover:text-red-700"><X size={16} /></button>
            </div>
          )}
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-24 text-sm text-slate-400">
              <Loader2 size={18} className="animate-spin" /> Loading patients…
            </div>
          ) : (
            <Outlet />
          )}
        </main>
      </div>
      <ChangePasswordModal open={changingPassword} onClose={() => setChangingPassword(false)} />
    </div>
  );
}
