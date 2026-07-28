import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

import AppLayout from '../components/Layout/AppLayout';
import AdminLayout from '../pages/admin/AdminLayout';
import TerminalLayout from '../components/Layout/TerminalLayout';
import ForceChangePassword from '../components/Auth/ForceChangePassword';

import Landing from '../pages/Landing';
import ResetPassword from '../pages/ResetPassword';

import AdminDashboard from '../pages/admin/Dashboard';
import AdminTenants from '../pages/admin/Tenants';
import AdminTenantProvision from '../pages/admin/TenantProvision';
import AdminSuperUsers from '../pages/admin/SuperUsers';
import AdminPlans from '../pages/admin/Plans';
import AdminSettings from '../pages/admin/Settings';

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
import LoyaltyCards from '../pages/app/LoyaltyCards';
import LoyaltyNotifications from '../pages/app/LoyaltyNotifications';

import PosDashboard from '../pages/pos/Dashboard';
import PosStoreSelect from '../pages/pos/StoreSelect';
import PosClock from '../pages/pos/Clock';
import PosChecklists from '../pages/pos/Checklists';
import PosGoodsIn from '../pages/pos/GoodsIn';
import PosTill from '../pages/pos/Till';
import PosTransactions from '../pages/pos/Transactions';
import LoyaltyRegister from '../pages/loyalty/Register';
import Faq from '../pages/help/Faq';

function LoadingSpinner() {
  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="spinner" style={{ borderColor: 'var(--border-medium)', borderTopColor: 'var(--primary)' }}></div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, profile, loading } = useAuthStore();

  if (loading) return <LoadingSpinner />;
  if (!session) return <Navigate to="/" replace />;

  if (profile?.requires_password_change) {
    return <ForceChangePassword />;
  }

  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { session, superUser, userType, loading } = useAuthStore();

  if (loading) return <LoadingSpinner />;
  if (!session) return <Navigate to="/" replace />;

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
        </Route>

        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
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
          <Route path="loyalty-cards" element={<LoyaltyCards />} />
          <Route path="loyalty-notifications" element={<LoyaltyNotifications />} />
          <Route path="help/faq" element={<Faq />} />
        </Route>

        <Route path="/pos/select-store" element={<PosStoreSelect />} />
        <Route path="/loyalty/register" element={<LoyaltyRegister />} />

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
