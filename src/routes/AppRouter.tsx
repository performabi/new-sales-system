// src/routes/AppRouter.tsx
import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

import AppLayout from '../components/Layout/AppLayout';
import TerminalLayout from '../components/Layout/TerminalLayout';
import ForceChangePassword from '../components/Auth/ForceChangePassword';
import Landing from '../pages/Landing';
import Dashboard from '../pages/Dashboard';
import Stores from '../pages/Stores';
import Users from '../pages/Users';
import Inventory from '../pages/Inventory';
import Plu from '../pages/Plu';
import PluCategories from '../pages/PluCategories';
import ItemSizing from '../pages/ItemSizing';
import Logbook from '../pages/Logbook';
import Suppliers from '../pages/Suppliers';
import PurchaseOrders from '../pages/PurchaseOrders';
import PurchaseOrderCreate from '../pages/PurchaseOrderCreate';
import PosDashboard from '../pages/pos/Dashboard';
import PosStoreSelect from '../pages/pos/StoreSelect';
import PosClock from '../pages/pos/Clock';
import PosChecklists from '../pages/pos/Checklists';
import PosGoodsIn from '../pages/pos/GoodsIn';
import PosTill from '../pages/pos/Till';
import PosTransactions from '../pages/pos/Transactions';
import StoreChecklists from '../pages/headoffice/StoreChecklists';
import CurrencyConfig from '../pages/headoffice/CurrencyConfig';
import CashbackConfig from '../pages/headoffice/CashbackConfig';
import LoyaltyCards from '../pages/headoffice/LoyaltyCards';
import LoyaltyNotifications from '../pages/headoffice/LoyaltyNotifications';
import LoyaltyRegister from '../pages/loyalty/Register';
import Faq from '../pages/help/Faq';

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
    return <Navigate to="/" replace />;
  }

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
        <Route path="/" element={<Landing />} />

        <Route
          path="/headoffice"
          element={
            <ProtectedRoute requireAdmin={true}>
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
