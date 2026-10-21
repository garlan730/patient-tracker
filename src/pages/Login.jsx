import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';
import { Button, Field, Input } from '../components/ui.jsx';
import logo from '../assets/logo.png';

export default function Login() {
  const { user, login, ready, authError } = useAuth();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={location.state?.from || '/'} replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(username, password);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const shownError = error || authError;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-900 via-brand-800 to-brand-700 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl">
        <div className="mb-8 flex flex-col items-center text-center">
          <img src={logo} alt="Klinik Utama Baruga Medical Center logo" className="mb-4 h-16 w-16 object-contain" />
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Klinik Utama</p>
          <h1 className="text-xl font-semibold text-slate-900">Baruga Medical Center</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in to the Patient Tracker</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Username">
            <Input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} required autoFocus />
          </Field>
          <Field label="Password">
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          </Field>
          {shownError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{shownError}</p>}
          <Button type="submit" className="w-full" disabled={busy || !ready}>
            {(busy || !ready) && <Loader2 size={16} className="animate-spin" />}
            Sign in
          </Button>
          <p className="text-center text-xs text-slate-500">Forgot your password? Ask a clinic admin to reset it.</p>
        </form>
      </div>
    </div>
  );
}
