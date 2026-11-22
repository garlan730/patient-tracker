import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from './lib/auth.jsx';
import { ConfirmProvider } from './components/ui.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Tracker from './pages/Tracker.jsx';
import Doctors from './pages/Doctors.jsx';
import UsersPage from './pages/Users.jsx';
import Inventory from './pages/Inventory.jsx';
import UpdateBanner from './components/UpdateBanner.jsx';
import TvBoard from './pages/TvBoard.jsx';

function RequireAuth({ children, adminOnly, allowViewer }) {
  const { ready, user, isAdmin, isViewer } = useAuth();
  const location = useLocation();
  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-400">
        <Loader2 className="animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (adminOnly && !isAdmin) return <Navigate to="/" replace />;
  // The TV account only ever sees the progress board.
  if (isViewer && !allowViewer) return <Navigate to="/tv" replace />;
  return children;
}

export default function App() {
  return (
    <ConfirmProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/tv" element={<RequireAuth allowViewer><TvBoard /></RequireAuth>} />
        {import.meta.env.DEV && <Route path="/tv-demo" element={<TvBoard demo />} />}
        <Route element={<RequireAuth><Layout /></RequireAuth>}>
          <Route index element={<Dashboard />} />
          <Route path="tracker" element={<Tracker />} />
          <Route path="doctors" element={<Doctors />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="users" element={<RequireAuth adminOnly><UsersPage /></RequireAuth>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <UpdateBanner />
    </ConfirmProvider>
  );
}
