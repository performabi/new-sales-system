// src/pages/Dashboard.tsx
import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/appStore';
import StatsCard from '../components/UI/StatsCard';

export default function Dashboard() {
  const profile = useAuthStore((s) => s.profile);
  const { stores, users, inventory, fetchStores, fetchUsers, fetchInventory } = useAppStore();

  useEffect(() => {
    fetchStores();
    fetchUsers();
    fetchInventory();
  }, [fetchStores, fetchUsers, fetchInventory]);

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1>Dashboard Overview</h1>
          <p>Welcome back, {profile?.full_name}</p>
        </div>
      </div>

      <div className="stats-grid">
        <StatsCard
          title="Total Stores"
          value={stores.length}
          icon="🏪"
          variant="primary"
        />
        <StatsCard
          title="Total Users"
          value={users.length}
          icon="👥"
          variant="secondary"
        />
        <StatsCard
          title="Inventory Items"
          value={inventory.length}
          icon="📦"
          variant="info"
        />
        <StatsCard
          title="System Status"
          value="Online"
          icon="✅"
          variant="success"
        />
      </div>

      <div className="card">
        <h3>Recent Activity</h3>
        <div className="empty-state" style={{ padding: '32px' }}>
          <p>Activity feed will appear here as users interact with the system.</p>
        </div>
      </div>
    </div>
  );
}
