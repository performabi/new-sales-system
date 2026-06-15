// src/routes/AppRouter.tsx
import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

import AppLayout from '../components/Layout/AppLayout';
import ForceChangePassword from '../components/Auth/ForceChangePassword';
import Login from '../pages/Login';
import Dashboard from '../pages/Dashboard';
import Stores from '../pages/Stores';
import Users from '../pages/Users';
import Inventory from '../pages/Inventory';

function ProtectedRoute({ children, requireAdmin = false }: { children: React.ReactNode; requireAdmin?: boolean }) {
  const { session, profile, loading } = useAuthStore();

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" style={{ borderColor: 'var(--border-medium)', borderTopColor: 'var(--primary)' }}></div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // Block standard 'user' role from Head Office Admin pages
  if (requireAdmin && profile?.role === 'user') {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <h2>Access Denied</h2>
        <p>Standard users cannot access the Head Office portal.</p>
        <button className="btn btn-primary" onClick={() => useAuthStore.getState().signOut()} style={{ marginTop: '20px' }}>
          Logout
        </button>
      </div>
    );
  }

  // Force password change if required
  if (profile?.requires_password_change) {
    return <ForceChangePassword />;
  }

  return <>{children}</>;
}

export default function AppRouter() {
  const initialize = useAuthStore((s) => s.initialize);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          path="/"
          element={
            <ProtectedRoute requireAdmin={true}>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="stores" element={<Stores />} />
          <Route path="users" element={<Users />} />
          <Route path="inventory" element={<Inventory />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
