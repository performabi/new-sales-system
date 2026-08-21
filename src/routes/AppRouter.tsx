import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

import AppLayout from '../components/Layout/AppLayout';
import AdminLayout from '../pages/admin/AdminLayout';
import TerminalLayout from '../components/Layout/TerminalLayout';
import ForceChangePassword from '../components/Auth/ForceChangePassword';

import Landing from '../pages/Landing';
import ResetPassword from '../pages/ResetPassword';
import TenantSelect from '../pages/TenantSelect';

import AdminDashboard from '../pages/admin/Dashboard';
import AdminTenants from '../pages/admin/Tenants';
import AdminTenantProvision from '../pages/admin/TenantProvision';
import AdminSuperUsers from '../pages/admin/SuperUsers';
import AdminPlans from '../pages/admin/Plans';
import AdminSettings from '../pages/admin/Settings';
import AdminTenantDetail from '../pages/admin/TenantDetail';

import Dashboard from '../pages/app/Dashboard';
import Stores from '../pages/app/Stores';
import Users from '../pages/app/Users';
import Inventory from '../pages/app/Inventory';
import Plu from '../pages/app/Plu';
import PluCategories from '../pages/app/PluCategories';
import ItemSizing from '../pages/app/ItemSizing';
import Logbook from '../pages/app/Logbook';
import Suppliers from '../pages/app/Suppliers';
import PurchaseOrders from '../pages/app/PurchaseOrders';
import PurchaseOrderCreate from '../pages/app/PurchaseOrderCreate';
import StoreChecklists from '../pages/app/StoreChecklists';
import CurrencyConfig from '../pages/app/CurrencyConfig';
import CashbackConfig from '../pages/app/CashbackConfig';
import DeviceSettings from '../pages/app/DeviceSettings';
import LoyaltyCards from '../pages/app/LoyaltyCards';
import LoyaltyNotifications from '../pages/app/LoyaltyNotifications';
import Sales from '../pages/app/Sales';
import Reporting from '../pages/app/Reporting';

import PosDashboard from '../pages/pos/Dashboard';
import PosEntry from '../pages/pos/PosEntry';
import PosClock from '../pages/pos/Clock';
import PosChecklists from '../pages/pos/Checklists';
import PosGoodsIn from '../pages/pos/GoodsIn';
import PosTill from '../pages/pos/Till';
import PosTransactions from '../pages/pos/Transactions';
import LoyaltyRegister from '../pages/loyalty/Register';
import Faq from '../pages/help/Faq';
import Terms from '../pages/help/Terms';

function LoadingSpinner() {
  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="spinner" style={{ borderColor: 'var(--border-medium)', borderTopColor: 'var(--primary)' }}></div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, profile, loading, isRecoveryMode } = useAuthStore();

  if (loading) return <LoadingSpinner />;
  if (!session) return <Navigate to="/" replace />;
  if (isRecoveryMode) return <Navigate to="/reset-password" replace />;

  if (profile?.requires_password_change) {
    return <ForceChangePassword />;
  }

  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { session, superUser, userType, loading, isRecoveryMode } = useAuthStore();

  if (loading) return <LoadingSpinner />;
  if (!session) return <Navigate to="/" replace />;
  if (isRecoveryMode) return <Navigate to="/reset-password" replace />;

  if (!superUser || !(userType === 'super_admin' || userType === 'support')) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <h2>Access Denied</h2>
        <p>Only system administrators can access this area.</p>
        <button className="btn btn-primary" onClick={() => useAuthStore.getState().signOut()} style={{ marginTop: '20px' }}>
          Logout
        </button>
      </div>
    );
  }

  return <>{children}</>;
}

function AdminOnlyRoute({ children }: { children: React.ReactNode }) {
  const { session, userType, loading } = useAuthStore();

  if (loading) return <LoadingSpinner />;
  if (!session) return <Navigate to="/" replace />;

  if (userType !== 'super_admin') {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <h2>Access Denied</h2>
        <p>Only super admins can perform this action.</p>
        <button className="btn btn-primary" onClick={() => useAuthStore.getState().signOut()} style={{ marginTop: '20px' }}>
          Logout
        </button>
      </div>
    );
  }

  return <>{children}</>;
}

async function fetchTenantSlug(): Promise<string | null> {
  const state = useAuthStore.getState();
  const schema = state.activeTenantSchema || state.user?.user_metadata?.tenant_schema as string | undefined;
  if (!schema) return null;
  try {
    const headers = new Headers();
    if (state.session?.access_token) headers.set('Authorization', `Bearer ${state.session.access_token}`);
    const res = await fetch(`/api/app/tenant-info?tenant_schema=${encodeURIComponent(schema)}`, { headers });
    if (!res.ok) return null;
    const tenant = await res.json();
    return tenant.slug as string;
  } catch {
    return null;
  }
}

function TenantPortal() {
  const { slug } = useParams();
  const location = useLocation();
  const { profile } = useAuthStore();
  const [tenantSlug, setTenantSlug] = useState<string | null>(null);

  if (profile?.role === 'user') return <Navigate to="/pos/dashboard" replace />;

  useEffect(() => {
    let cancelled = false;
    fetchTenantSlug().then((s) => {
      if (!cancelled) setTenantSlug(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (tenantSlug && tenantSlug !== slug) {
    const rest = location.pathname.replace(new RegExp(`^/app/${slug}`), '');
    return <Navigate to={`/app/${tenantSlug}${rest || '/dashboard'}`} replace />;
  }

  return <AppLayout />;
}

function LegacyAppRedirect() {
  const location = useLocation();
  const [slug, setSlug] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchTenantSlug().then((s) => {
      if (!cancelled) {
        if (s) setSlug(s);
        else setFailed(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (failed) return <Navigate to="/" replace />;
  if (!slug) return <LoadingSpinner />;
  const rest = location.pathname.slice(4) || '/dashboard';
  return <Navigate to={`/app/${slug}${rest}`} replace />;
}

function AppCatchAll() {
  const { slug } = useParams();
  return <Navigate to={`/app/${slug}/dashboard`} replace />;
}

function LoyaltyRegisterWithSlug() {
  const { slug } = useParams();
  return <LoyaltyRegister tenantSlug={slug} />;
}

export default function AppRouter() {
  const initialize = useAuthStore((s) => s.initialize);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/terms" element={<Terms />} />
        <Route
          path="/tenant-select"
          element={
            <ProtectedRoute>
              <TenantSelect />
            </ProtectedRoute>
          }
        />
        <Route
          path="/help"
          element={
            <ProtectedRoute>
              <Faq />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminLayout />
            </AdminRoute>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="tenants" element={<AdminTenants />} />
          <Route path="tenants/:tenantId" element={<AdminTenantDetail />} />
          <Route
            path="tenants/provision"
            element={
              <AdminOnlyRoute>
                <AdminTenantProvision />
              </AdminOnlyRoute>
            }
          />
          <Route path="super-users" element={<AdminSuperUsers />} />
          <Route path="plans" element={<AdminPlans />} />
          <Route path="settings" element={<AdminSettings />} />
          <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
        </Route>

        <Route
          path="/app/:slug"
          element={
            <ProtectedRoute>
              <TenantPortal />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="sales" element={<Sales />} />
          <Route path="reporting" element={<Reporting />} />
          <Route path="stores" element={<Stores />} />
          <Route path="plu" element={<Plu />} />
          <Route path="users" element={<Users />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="inventory/purchase-orders" element={<PurchaseOrders />} />
          <Route path="inventory/purchase-orders/create" element={<PurchaseOrderCreate />} />
          <Route path="setup/categories" element={<PluCategories />} />
          <Route path="setup/item-sizing" element={<ItemSizing />} />
          <Route path="setup/logbook" element={<Logbook />} />
          <Route path="setup/suppliers" element={<Suppliers />} />
          <Route path="setup/store-checklists" element={<StoreChecklists />} />
          <Route path="setup/currency-config" element={<CurrencyConfig />} />
          <Route path="setup/cashback-config" element={<CashbackConfig />} />
          <Route path="setup/devices" element={<DeviceSettings />} />
          <Route path="loyalty-cards" element={<LoyaltyCards />} />
          <Route path="loyalty-notifications" element={<LoyaltyNotifications />} />
          <Route path="*" element={<AppCatchAll />} />
        </Route>

        <Route
          path="/app/*"
          element={
            <ProtectedRoute>
              <LegacyAppRedirect />
            </ProtectedRoute>
          }
        />

        <Route path="/pos/access" element={<PosEntry />} />
        <Route path="/pos/select-store" element={<PosEntry />} />
        <Route path="/loyalty/register" element={<LoyaltyRegister />} />
        <Route path="/loyalty/:slug/register" element={<LoyaltyRegisterWithSlug />} />

        <Route
          path="/pos/:slug/:storeRef"
          element={<TerminalLayout />}
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<PosDashboard />} />
          <Route path="till" element={<PosTill />} />
          <Route path="transactions" element={<PosTransactions />} />
          <Route path="clock" element={<PosClock />} />
          <Route path="checklists" element={<PosChecklists />} />
          <Route path="goods-in" element={<PosGoodsIn />} />
          <Route path="*" element={<Navigate to="dashboard" replace />} />
        </Route>

        <Route
          path="/pos"
          element={<TerminalLayout />}
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<PosDashboard />} />
          <Route path="till" element={<PosTill />} />
          <Route path="transactions" element={<PosTransactions />} />
          <Route path="clock" element={<PosClock />} />
          <Route path="checklists" element={<PosChecklists />} />
          <Route path="goods-in" element={<PosGoodsIn />} />
          <Route path="*" element={<Navigate to="dashboard" replace />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
